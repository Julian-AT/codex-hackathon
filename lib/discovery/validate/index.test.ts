import { describe, it, expect } from 'vitest';
import { validateTool } from './index';
import candidates from '../__fixtures__/mock-candidates.json';
import type { DynamicToolSpec } from '../types';

describe('validateTool integration (all 12 fixtures)', () => {
  for (const c of candidates) {
    const name = (c as any).spec.function.name;
    const expected = (c as any).expectedFailedGate as string | null;

    it(`${name} => ${expected ?? 'pass'}`, async () => {
      const r = await validateTool((c as any).spec as DynamicToolSpec);
      const actual = r.pass ? null : r.failedGate;
      expect(actual).toBe(expected);
    }, 30000);
  }
});
