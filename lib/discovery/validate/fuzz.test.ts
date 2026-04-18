import { describe, it, expect } from 'vitest';
import { validateFuzz, generateFuzzInputs } from './fuzz.js';

describe('generateFuzzInputs', () => {
  it('returns exactly 10 inputs', () => {
    expect(
      generateFuzzInputs({ type: 'object', properties: { x: { type: 'string' } } }),
    ).toHaveLength(10);
  });

  it('returns 10 empty objects for schema with no properties', () => {
    const inputs = generateFuzzInputs({ type: 'object' });
    expect(inputs).toHaveLength(10);
    inputs.forEach((inp) => expect(inp).toEqual({}));
  });
});

describe('validateFuzz', () => {
  it('accepts a robust body', async () => {
    const body = 'function f(args) { return { ok: String(args.x || "") }; }';
    const r = await validateFuzz(body, {
      type: 'object',
      properties: { x: { type: 'string' } },
    });
    expect(r.pass).toBe(true);
  }, 30000);

  it('rejects a throw-prone body', async () => {
    const body = 'function f(args) { return { hit: args.x.toLowerCase().match(/z/)[0] }; }';
    const r = await validateFuzz(body, {
      type: 'object',
      properties: { x: { type: 'string' } },
    });
    expect(r.pass).toBe(false);
    expect(r.failedGate).toBe('fuzz');
  }, 30000);

  it('rejects non-serializable returns', async () => {
    const body = 'function f(_) { return function(){}; }';
    const r = await validateFuzz(body, { type: 'object', properties: {} });
    expect(r.pass).toBe(false);
  }, 30000);
});
