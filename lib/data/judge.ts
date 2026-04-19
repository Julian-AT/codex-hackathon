/**
 * Judge-jury quality gate — DAT-04 + DAT-05.
 * GPT-5 judges ALL examples on 4 Likert dimensions (faithfulness, toolCorrectness,
 * naturalness, grounding). GPT-5 mini cross-checks a 20% random sample.
 *
 * Jury score = GPT-5 (primary). Secondary judge is cross-check only.
 * Examples with ANY dimension < 4 are rejected.
 * Disagreements > 1 Likert point on any dimension are logged.
 *
 * Anti-leakage: judges (GPT-5 + GPT-5 mini) != generator (Opus 4.7). PRD §7.2 #4.
 * Temperature 0 for all judge calls.
 *
 * Plan 04-05, Task 1.
 */

import { generateObject } from 'ai';
import { getModel } from '@/lib/model';
import pLimit from 'p-limit';
import { z } from 'zod';
import type { TrainingExample, JudgeScore } from './types';
import { makeRng } from './personas';

/* ------------------------------------------------------------------ */
/*  Schema                                                             */
/* ------------------------------------------------------------------ */

export const JUDGE_SCHEMA = z.object({
  faithfulness: z.number().int().min(1).max(5),
  toolCorrectness: z.number().int().min(1).max(5),
  naturalness: z.number().int().min(1).max(5),
  grounding: z.number().int().min(1).max(5),
});

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatExampleForJudge(ex: TrainingExample): string {
  return ex.messages
    .map((m) => {
      let line = `[${m.role}]: ${m.content}`;
      if (m.tool_calls) line += `\n  tool_calls: ${JSON.stringify(m.tool_calls)}`;
      return line;
    })
    .join('\n');
}

const JUDGE_SYSTEM = `You are evaluating training data quality for a specialist LLM. Rate the following conversation on four dimensions (1=terrible, 5=excellent):
- faithfulness: Are all claims factually correct and grounded in documentation?
- toolCorrectness: Are tool calls invoked with correct names and valid arguments? (5 if no tool calls and none needed)
- naturalness: Does the conversation flow naturally? Would a real user ask this?
- grounding: Is the answer supported by the provided context, not hallucinated?
Rate each dimension as an integer 1-5. Be strict — only rate 4 or 5 if the example is genuinely good.`;

/* ------------------------------------------------------------------ */
/*  Single-example judge                                               */
/* ------------------------------------------------------------------ */

export async function judgeExample(
  example: TrainingExample,
  _judgeModel: 'gpt-5' | 'gpt-5-mini',
): Promise<JudgeScore> {
  const model = getModel();
  const formatted = formatExampleForJudge(example);

  const { object } = await generateObject({
    model,
    schema: JUDGE_SCHEMA,
    system: JUDGE_SYSTEM,
    prompt: formatted,
    temperature: 0,
    experimental_telemetry: {
      isEnabled: true,
      functionId: 'judge',
    },
  });

  return { ...object, judge: _judgeModel } as JudgeScore;
}

/* ------------------------------------------------------------------ */
/*  Jury (GPT-5 on ALL + GPT-5 mini on 20% sample)                    */
/* ------------------------------------------------------------------ */

export interface JuryResult {
  scores: Map<number, JudgeScore[]>; // index -> scores array
  disagreements: Array<{
    exampleIndex: number;
    dimension: string;
    gpt5Score: number;
    secondaryScore: number;
  }>;
  accepted: TrainingExample[];
  rejected: TrainingExample[];
}

export async function judgeJury(
  examples: TrainingExample[],
  opts: {
    concurrency?: number;
    /** Fraction of examples to also score with GPT-5 mini (cross-judge). */
    secondaryJudgeSampleRate?: number;
    seed?: string;
  } = {},
): Promise<JuryResult> {
  const {
    concurrency = 15,
    secondaryJudgeSampleRate = 0.2,
    seed = 'jury-v1',
  } = opts;
  const limit = pLimit(concurrency);
  const rng = makeRng(seed);
  const scores = new Map<number, JudgeScore[]>();
  const disagreements: JuryResult['disagreements'] = [];

  // GPT-5 judges ALL examples
  const gpt5Scores = await Promise.all(
    examples.map((ex, i) =>
      limit(async () => {
        const score = await judgeExample(ex, 'gpt-5');
        scores.set(i, [score]);
        return { index: i, score };
      }),
    ),
  );

  // GPT-5 mini judges a random sample (cross-check)
  const secondaryIndices = examples
    .map((_, i) => i)
    .filter(() => rng() < secondaryJudgeSampleRate);

  if (secondaryIndices.length > 0) {
    await Promise.all(
      secondaryIndices.map((i) =>
        limit(async () => {
          const secondaryScore = await judgeExample(examples[i], 'gpt-5-mini');
          scores.get(i)!.push(secondaryScore);
          // Check for disagreements > 1 Likert point
          const gpt5Score = gpt5Scores.find((s) => s.index === i)!.score;
          for (const dim of [
            'faithfulness',
            'toolCorrectness',
            'naturalness',
            'grounding',
          ] as const) {
            const diff = Math.abs(gpt5Score[dim] - secondaryScore[dim]);
            if (diff > 1) {
              disagreements.push({
                exampleIndex: i,
                dimension: dim,
                gpt5Score: gpt5Score[dim],
                secondaryScore: secondaryScore[dim],
              });
            }
          }
        }),
      ),
    );
  }

  // Accept/reject based on GPT-5 scores (primary judge)
  const accepted: TrainingExample[] = [];
  const rejected: TrainingExample[] = [];
  for (const { index, score } of gpt5Scores) {
    const pass =
      score.faithfulness >= 4 &&
      score.toolCorrectness >= 4 &&
      score.naturalness >= 4 &&
      score.grounding >= 4;
    if (pass) {
      accepted.push(examples[index]);
    } else {
      rejected.push(examples[index]);
    }
  }

  return { scores, disagreements, accepted, rejected };
}
