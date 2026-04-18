import { describe, it, expect } from 'vitest';
import { validateParse } from './parse.js';
import candidates from '../__fixtures__/mock-candidates.json';

describe('validateParse', () => {
  it('rejects syntax error (parseBad)', () => {
    const bad = candidates.find((c: any) => c.spec.function.name === 'parseBad')!;
    expect(validateParse(bad.spec.meta.jsBody).pass).toBe(false);
  });

  it('rejects banned identifier fetch (fetchBanned)', () => {
    const bad = candidates.find((c: any) => c.spec.function.name === 'fetchBanned')!;
    const r = validateParse(bad.spec.meta.jsBody);
    expect(r.pass).toBe(false);
    expect(r.reason).toMatch(/fetch/);
  });

  it('rejects Date.now (nondeterministicDate)', () => {
    const bad = candidates.find((c: any) => c.spec.function.name === 'nondeterministicDate')!;
    expect(validateParse(bad.spec.meta.jsBody).pass).toBe(false);
  });

  it('rejects Math.random (nondeterministicRandom)', () => {
    const bad = candidates.find((c: any) => c.spec.function.name === 'nondeterministicRandom')!;
    expect(validateParse(bad.spec.meta.jsBody).pass).toBe(false);
  });

  it('accepts clean body (addNumbers)', () => {
    const good = candidates.find((c: any) => c.spec.function.name === 'addNumbers')!;
    expect(validateParse(good.spec.meta.jsBody).pass).toBe(true);
  });

  it('accepts clean body (listTables)', () => {
    const good = candidates.find((c: any) => c.spec.function.name === 'listTables')!;
    expect(validateParse(good.spec.meta.jsBody).pass).toBe(true);
  });
});
