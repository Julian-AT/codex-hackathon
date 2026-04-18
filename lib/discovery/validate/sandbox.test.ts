import { describe, it, expect } from 'vitest';
import { runInSandbox } from './sandbox.js';

describe('runInSandbox', () => {
  it('runs a happy-path body and returns JSON-serialized value', async () => {
    const r = await runInSandbox(
      'function addNumbers(args) { return { sum: args.a + args.b }; }',
      { a: 2, b: 3 },
    );
    expect(r.ok).toBe(true);
    expect(r.value).toEqual({ sum: 5 });
  });

  it('times out on infinite loop in <=3s', async () => {
    const t0 = Date.now();
    const r = await runInSandbox('function loop(_) { while(true){} }', {}, 2000);
    const dt = Date.now() - t0;
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/timeout|timed out|exit/);
    expect(dt).toBeLessThan(3500);
  }, 6000);

  it('rejects non-serializable return', async () => {
    const r = await runInSandbox('function f(_) { return function(){}; }', {});
    expect(r.ok).toBe(false);
  });

  it('rejects large memory allocation (resource cap)', async () => {
    // try to allocate ~200 MB. Worker's 64 MB cap should kill it.
    const r = await runInSandbox(
      'function mem(_) { var a = []; for (var i = 0; i < 2000000; i++) a.push({x: "x".repeat(100)}); return a.length; }',
      {},
      4000,
    );
    expect(r.ok).toBe(false);
  }, 8000);

  it('cannot access process (empty vm context)', async () => {
    const r = await runInSandbox('function f(_) { return typeof process; }', {});
    expect(r.ok).toBe(true);
    expect(r.value).toBe('undefined');
  });

  it('rejects body without named function', async () => {
    const r = await runInSandbox('return 42;', {});
    expect(r.ok).toBe(false);
  });
});
