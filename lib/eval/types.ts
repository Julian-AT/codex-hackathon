export type EvalModelKey = 'base' | 'tuned' | 'teacher';

export type EvalSummary = {
  key: EvalModelKey;
  label: string;
  available: boolean;
  score: number | null;
  passed: number;
  total: number;
  latencyMs: number | null;
  notes?: string;
};

export type EvalRunResult = {
  itemCount: number;
  source: string;
  models: EvalSummary[];
};
