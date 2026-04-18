import type { TrainingExample } from './types';

/** Extract all unique tool names invoked across messages in an example. */
export function extractToolNames(example: TrainingExample): string[] {
  const names = new Set<string>();
  for (const msg of example.messages) {
    if (msg.tool_calls) {
      for (const tc of msg.tool_calls) {
        names.add(tc.function.name);
      }
    }
  }
  return [...names];
}

export interface StratificationResult {
  pass: boolean;
  deficit: Record<string, number>; // tool -> shortfall from minPerTool
  surplus: Record<string, number>; // tool -> excess above minPerTool
  counts: Record<string, number>; // tool -> actual count
}

/**
 * Check that every tool appearing in the training set has >= minPerTool examples.
 * An "example" for a tool = any TrainingExample whose messages contain at least
 * one tool_call with that tool name.
 */
export function checkStratification(
  examples: TrainingExample[],
  knownToolNames: string[],
  minPerTool = 30,
): StratificationResult {
  const counts: Record<string, number> = {};
  for (const name of knownToolNames) counts[name] = 0;

  for (const ex of examples) {
    const names = extractToolNames(ex);
    for (const n of names) {
      counts[n] = (counts[n] ?? 0) + 1;
    }
  }

  const deficit: Record<string, number> = {};
  const surplus: Record<string, number> = {};
  let pass = true;

  for (const [name, count] of Object.entries(counts)) {
    if (count < minPerTool) {
      deficit[name] = minPerTool - count;
      pass = false;
    } else {
      surplus[name] = count - minPerTool;
    }
  }
  return { pass, deficit, surplus, counts };
}
