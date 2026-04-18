export type { Chunk, DynamicToolSpec } from '../discovery/types';

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
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

export interface Persona {
  id: string;
  label: string;
  voice: string;
}

export const DIFFICULTIES = ['easy', 'medium', 'hard'] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

type Score = 1 | 2 | 3 | 4 | 5;

export interface JudgeScore {
  faithfulness: Score;
  toolCorrectness: Score;
  naturalness: Score;
  grounding: Score;
  judge: 'gpt-5' | 'gpt-5-mini';
}

export interface EvalItem {
  id: string;
  kind: 'factual' | 'reasoning' | 'single-turn-tool' | 'multi-turn-tool';
  prompt: string;
  expected?: string;
  expectedToolCalls?: ToolCall[];
  sourceChunks: string[];
}

export interface DataGenMeta {
  persona: string;
  difficulty: Difficulty;
  sourceChunks: string[];
  generator: string;
}
