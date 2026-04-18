import { describe, it, expect } from 'vitest';
import { validateSchema } from './schema.js';
import candidates from '../__fixtures__/mock-candidates.json';

describe('validateSchema', () => {
  it('rejects malformed schema (schemaBad fixture)', () => {
    const bad = candidates.find((c: any) => c.spec.function.name === 'schemaBad')!;
    const r = validateSchema(bad.spec.function.parameters);
    expect(r.pass).toBe(false);
    expect(r.failedGate).toBe('schema');
  });

  it('accepts well-formed schema (addNumbers fixture)', () => {
    const good = candidates.find((c: any) => c.spec.function.name === 'addNumbers')!;
    expect(validateSchema(good.spec.function.parameters).pass).toBe(true);
  });

  it('accepts well-formed schema (listTables fixture)', () => {
    const good = candidates.find((c: any) => c.spec.function.name === 'listTables')!;
    expect(validateSchema(good.spec.function.parameters).pass).toBe(true);
  });
});
