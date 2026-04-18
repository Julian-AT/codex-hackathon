import { describe, it, expect } from 'vitest';
import { HAND_WRITTEN_SUPABASE_TOOLS } from './hand-written-supabase.js';
import { validateTool } from '../discovery/validate/index.js';

describe('hand-written Supabase fallback set', () => {
  it('has exactly 8 entries', () => {
    expect(HAND_WRITTEN_SUPABASE_TOOLS).toHaveLength(8);
  });

  it('no tool requires network', () => {
    for (const t of HAND_WRITTEN_SUPABASE_TOOLS) {
      expect(t.meta.requiresNetwork).toBe(false);
    }
  });

  it('every tool has >=3 trajectories', () => {
    for (const t of HAND_WRITTEN_SUPABASE_TOOLS) {
      expect(t.meta.trajectories.length).toBeGreaterThanOrEqual(3);
    }
  });

  it('every tool passes the 5-gate validator', async () => {
    for (const t of HAND_WRITTEN_SUPABASE_TOOLS) {
      const result = await validateTool(t);
      if (!result.pass) {
        console.error('FAILED TOOL:', t.function.name, result);
      }
      expect(result.pass, `tool ${t.function.name}: ${result.reason ?? 'ok'}`).toBe(true);
    }
  }, 60_000);

  it('tool names are unique and snake_case (dedup-safe)', () => {
    const names = HAND_WRITTEN_SUPABASE_TOOLS.map((t) => t.function.name);
    expect(new Set(names).size).toBe(names.length);
    for (const n of names) expect(n).toMatch(/^[a-z][a-z0-9_]*$/);
  });
});
