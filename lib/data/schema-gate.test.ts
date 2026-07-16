import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>();
  const { resolve } = await import('node:path');
  return {
    ...actual,
    readFileSync: (path: Parameters<typeof actual.readFileSync>[0], options?: unknown) => {
      const selected = String(path).endsWith('/data/adapter-tools.json')
        ? resolve(process.cwd(), 'fixtures/phase-1/validation/adapter-tools.json')
        : path;
      return actual.readFileSync(selected, options as never);
    },
  };
});

import { _resetCache, validateToolCall } from './schema-gate';

beforeEach(() => _resetCache());

describe('validateToolCall', () => {
  it('accepts valid supabase_rls_policy_template args', () => {
    const r = validateToolCall('supabase_rls_policy_template', {
      tableName: 'profiles',
      role: 'authenticated',
      operation: 'select',
    });
    expect(r.valid).toBe(true);
  });

  it('rejects unknown tool name', () => {
    const r = validateToolCall('nonexistent_tool', { x: 1 });
    expect(r.valid).toBe(false);
    expect(r.errors).toContain('unknown tool: nonexistent_tool');
  });

  it('rejects invalid args for known tool', () => {
    const r = validateToolCall('supabase_rls_policy_template', {
      tableName: 123, // should be string
      role: 'badRole', // not in enum
      operation: 'select',
    });
    expect(r.valid).toBe(false);
    expect(r.errors!.length).toBeGreaterThan(0);
  });

  it('rejects missing required args', () => {
    const r = validateToolCall('supabase_rls_policy_template', {});
    expect(r.valid).toBe(false);
  });
});
