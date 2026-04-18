import { runInSandbox } from './sandbox.js';
import type { ValidationResult } from '../types.js';

const STRING_PRIMS = ['', 'a', '0', 'x'.repeat(1000), '\u{1F984}\u{1F680}', 'null', 'undefined', 'true', '  ', '\n'];
const NUMBER_PRIMS = [0, 1, -1, 1.5, -1.5, 1e308, -1e308, Number.MAX_SAFE_INTEGER, 0.1 + 0.2, Number.EPSILON];
const INT_PRIMS = [0, 1, -1, 100, -100, 2 ** 31 - 1, -(2 ** 31), 42, 7, 13];
const ARRAY_PRIMS = [[], [1], [1, 2, 3], new Array(100).fill(0), [''], [null], [[]], [{}], [1, 'x'], Array.from({ length: 10 }, (_, i) => i)];

function oneValue(propSchema: any, idx: number): unknown {
  const t = propSchema?.type;
  if (t === 'string') return STRING_PRIMS[idx % STRING_PRIMS.length];
  if (t === 'number') return NUMBER_PRIMS[idx % NUMBER_PRIMS.length];
  if (t === 'integer') return INT_PRIMS[idx % INT_PRIMS.length];
  if (t === 'boolean') return idx % 2 === 0;
  if (t === 'array') return ARRAY_PRIMS[idx % ARRAY_PRIMS.length];
  if (t === 'object') return generateOne(propSchema ?? {}, idx);
  return null;
}

function generateOne(schema: any, idx: number): Record<string, unknown> {
  const props = schema?.properties ?? {};
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(props)) out[key] = oneValue(props[key], idx);
  return out;
}

export function generateFuzzInputs(schema: any): Array<Record<string, unknown>> {
  return Array.from({ length: 10 }, (_, i) => generateOne(schema, i));
}

export async function validateFuzz(jsBody: string, schema: any): Promise<ValidationResult> {
  const inputs = generateFuzzInputs(schema);
  const results = await Promise.all(inputs.map((args) => runInSandbox(jsBody, args, 2000)));
  const throws = results.filter((r) => !r.ok).length;
  const serializable = results.filter((r) => r.ok).length;
  if (throws > 0) {
    return { pass: false, failedGate: 'fuzz', reason: `${throws}/10 threw`, details: results };
  }
  if (serializable < 8) {
    return { pass: false, failedGate: 'fuzz', reason: `${serializable}/10 serializable (need >=8)`, details: results };
  }
  return { pass: true };
}
