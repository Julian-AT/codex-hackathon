import { describe, it, expect } from 'vitest';
import { validateTrajectories } from './trajectory.js';

const body = 'function addNumbers(args) { return { sum: args.a + args.b }; }';

describe('validateTrajectories', () => {
  it('passes when all 3 trajectories match', async () => {
    const r = await validateTrajectories(body, [
      { userPrompt: 'q1', call: { name: 'addNumbers', arguments: { a: 1, b: 2 } }, result: { sum: 3 } },
      { userPrompt: 'q2', call: { name: 'addNumbers', arguments: { a: 10, b: 5 } }, result: { sum: 15 } },
      { userPrompt: 'q3', call: { name: 'addNumbers', arguments: { a: 0, b: 0 } }, result: { sum: 0 } },
    ]);
    expect(r.pass).toBe(true);
  }, 15000);

  it('fails on any mismatch', async () => {
    const r = await validateTrajectories(body, [
      { userPrompt: 'q1', call: { name: 'addNumbers', arguments: { a: 1, b: 2 } }, result: { sum: 999 } },
      { userPrompt: 'q2', call: { name: 'addNumbers', arguments: { a: 0, b: 0 } }, result: { sum: 0 } },
      { userPrompt: 'q3', call: { name: 'addNumbers', arguments: { a: 0, b: 1 } }, result: { sum: 1 } },
    ]);
    expect(r.pass).toBe(false);
    expect(r.failedGate).toBe('trajectory');
  }, 15000);

  it('fails if <3 trajectories', async () => {
    const r = await validateTrajectories(body, [
      { userPrompt: 'q1', call: { name: 'addNumbers', arguments: { a: 1, b: 2 } }, result: { sum: 3 } },
    ]);
    expect(r.pass).toBe(false);
    expect(r.failedGate).toBe('trajectory');
    expect(r.reason).toMatch(/<3 trajectories/);
  });
});
