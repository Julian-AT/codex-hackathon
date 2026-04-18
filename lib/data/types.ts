/**
 * Canonical Phase 4 vocabulary.
 * Source of truth: PRD SS7.1, SS7.3, SS11.3 and plan 04-01.
 * Every downstream data-gen plan imports from this file.
 */

export type { Chunk, DynamicToolSpec } from '../discovery/types';

/* ------------------------------------------------------------------ */
/*  Chat / Training shapes (mlx-lm tools JSONL row)                   */
/* ------------------------------------------------------------------ */

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    /** JSON-stringified arguments — matches OpenAI / mlx-lm tools format */
    arguments: string;
  };
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  name?: string;
}

export interface TrainingExample {
  messages: ChatMessage[];
  tools: import('../discovery/types.js').DynamicToolSpec[];
}

/* ------------------------------------------------------------------ */
/*  Persona / Difficulty                                              */
/* ------------------------------------------------------------------ */

export interface Persona {
  id: string;
  label: string;
  /** One-line system-prompt fragment describing this persona's voice */
  voice: string;
}

export const DIFFICULTIES = ['easy', 'medium', 'hard'] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

/* ------------------------------------------------------------------ */
/*  Judge / Eval                                                      */
/* ------------------------------------------------------------------ */

type Score = 1 | 2 | 3 | 4 | 5;

export interface JudgeScore {
  faithfulness: Score;
  toolCorrectness: Score;
  naturalness: Score;
  grounding: Score;
  judge: 'gpt-5' | 'gemini-2.5-pro';
}

export interface EvalItem {
  id: string;
  kind: 'factual' | 'reasoning' | 'single-turn-tool' | 'multi-turn-tool';
  prompt: string;
  expected?: string;
  expectedToolCalls?: ToolCall[];
  sourceChunks: string[];
}

/* ------------------------------------------------------------------ */
/*  Generation metadata                                               */
/* ------------------------------------------------------------------ */

export interface DataGenMeta {
  persona: string;       // persona id
  difficulty: Difficulty;
  sourceChunks: string[];
  generator: 'opus-4-7';
}
