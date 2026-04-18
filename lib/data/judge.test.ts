import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { TrainingExample } from './types';

/* ------------------------------------------------------------------ */
/*  Mocks                                                              */
/* ------------------------------------------------------------------ */

vi.mock('ai', () => ({
  generateObject: vi.fn(),
}));

vi.mock('@ai-sdk/openai', () => ({
  openai: vi.fn((id: string) => `mocked-openai:${id}`),
}));

vi.mock('@sentry/nextjs', () => ({
  startSpan: vi.fn((_opts: unknown, fn: () => unknown) => fn()),
}));

/* ------------------------------------------------------------------ */
/*  Fixtures                                                           */
/* ------------------------------------------------------------------ */

function makeExample(content: string): TrainingExample {
  return {
    messages: [
      { role: 'system', content: 'You are a Supabase specialist.' },
      { role: 'user', content },
      { role: 'assistant', content: `Answer about: ${content}` },
    ],
    tools: [],
  };
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe('judgeExample', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns JudgeScore with all four dimensions + judge field', async () => {
    const ai = await import('ai');
    vi.mocked(ai.generateObject).mockResolvedValueOnce({
      object: {
        faithfulness: 5,
        toolCorrectness: 4,
        naturalness: 5,
        grounding: 4,
      },
    } as never);

    const { judgeExample } = await import('./judge.js');
    const score = await judgeExample(makeExample('What is RLS?'), 'gpt-5');

    expect(score.faithfulness).toBe(5);
    expect(score.toolCorrectness).toBe(4);
    expect(score.naturalness).toBe(5);
    expect(score.grounding).toBe(4);
    expect(score.judge).toBe('gpt-5');
  });

  it('uses openai gpt-5-mini for secondary judge', async () => {
    const ai = await import('ai');
    vi.mocked(ai.generateObject).mockResolvedValueOnce({
      object: {
        faithfulness: 3,
        toolCorrectness: 3,
        naturalness: 4,
        grounding: 3,
      },
    } as never);

    const { judgeExample } = await import('./judge.js');
    const score = await judgeExample(
      makeExample('Edge functions?'),
      'gpt-5-mini',
    );

    expect(score.judge).toBe('gpt-5-mini');
    expect(score.faithfulness).toBe(3);
  });
});

describe('judgeJury', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('accepts examples scoring >= 4 on all dimensions', async () => {
    const ai = await import('ai');
    // GPT-5 scores: all 5s (should accept)
    vi.mocked(ai.generateObject).mockResolvedValue({
      object: {
        faithfulness: 5,
        toolCorrectness: 5,
        naturalness: 5,
        grounding: 5,
      },
    } as never);

    const { judgeJury } = await import('./judge.js');
    const examples = [
      makeExample('What is RLS?'),
      makeExample('Edge functions?'),
      makeExample('Auth tokens?'),
    ];
    const result = await judgeJury(examples, {
      concurrency: 2,
      secondaryJudgeSampleRate: 0,
      seed: 'test-accept',
    });

    expect(result.accepted.length).toBe(3);
    expect(result.rejected.length).toBe(0);
  });

  it('rejects examples scoring < 4 on any dimension', async () => {
    const ai = await import('ai');
    let callCount = 0;
    vi.mocked(ai.generateObject).mockImplementation(async () => {
      callCount++;
      // First example: faithfulness=3 (should reject)
      if (callCount === 1) {
        return {
          object: {
            faithfulness: 3,
            toolCorrectness: 5,
            naturalness: 5,
            grounding: 5,
          },
        } as never;
      }
      // Rest: all 5s (should accept)
      return {
        object: {
          faithfulness: 5,
          toolCorrectness: 5,
          naturalness: 5,
          grounding: 5,
        },
      } as never;
    });

    const { judgeJury } = await import('./judge.js');
    const examples = [
      makeExample('Bad example'),
      makeExample('Good example 1'),
      makeExample('Good example 2'),
    ];
    const result = await judgeJury(examples, {
      concurrency: 2,
      secondaryJudgeSampleRate: 0,
      seed: 'test-reject',
    });

    expect(result.rejected.length).toBe(1);
    expect(result.accepted.length).toBe(2);
  });

  it('detects disagreements when GPT-5 and GPT-5 mini differ by > 1', async () => {
    const ai = await import('ai');
    let callCount = 0;
    vi.mocked(ai.generateObject).mockImplementation(async () => {
      callCount++;
      // GPT-5 call (first)
      if (callCount === 1) {
        return {
          object: {
            faithfulness: 5,
            toolCorrectness: 5,
            naturalness: 5,
            grounding: 5,
          },
        } as never;
      }
      // GPT-5 mini call (second) -- disagrees on faithfulness by 2 points
      return {
        object: {
          faithfulness: 3,
          toolCorrectness: 5,
          naturalness: 5,
          grounding: 5,
        },
      } as never;
    });

    const { judgeJury } = await import('./judge.js');
    const examples = [makeExample('Test disagreement')];
    const result = await judgeJury(examples, {
      concurrency: 2,
      secondaryJudgeSampleRate: 1.0,
      seed: 'test-disagree',
    });

    expect(result.disagreements.length).toBeGreaterThanOrEqual(1);
    const disagree = result.disagreements[0];
    expect(disagree.dimension).toBe('faithfulness');
    expect(disagree.gpt5Score).toBe(5);
    expect(disagree.secondaryScore).toBe(3);
  });
});
