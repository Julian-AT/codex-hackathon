import { describe, it, expect } from 'vitest';
import { validateSchema } from './schema';
import candidates from '../__fixtures__/mock-candidates.json';

describe('validateSchema', () => {
  it('rejects malformed schema (schemaBad fixture)', () => {
    const bad = candidates.find((c: any) => c.spec.function.name === 'schemaBad')!;
    const r = validateSchema(bad.spec.function.parameters);
    expect(r.pass).toBe(false);
    expect(r.failedGate).toBe('schema');
  });

  it('accepts well-formed schema (add_numbers fixture)', () => {
    const good = candidates.find((c: any) => c.spec.function.name === 'add_numbers')!;
    expect(validateSchema(good.spec.function.parameters).pass).toBe(true);
  });

  it('accepts well-formed schema (list_tables fixture)', () => {
    const good = candidates.find((c: any) => c.spec.function.name === 'list_tables')!;
    expect(validateSchema(good.spec.function.parameters).pass).toBe(true);
  });
});
