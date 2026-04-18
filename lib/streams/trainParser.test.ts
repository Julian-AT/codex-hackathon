import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseTrainLine } from './trainParser.ts';

test('parses SFT Train loss line', () => {
  assert.deepEqual(parseTrainLine('Iter 5: Train loss 1.234'), { iter: 5, loss: 1.234 });
});

test('parses GRPO Reward line', () => {
  assert.deepEqual(parseTrainLine('Iter 120: Reward 0.87'), { iter: 120, reward: 0.87 });
});

test('returns null on unrelated chatter', () => {
  assert.equal(parseTrainLine('some unrelated stdout chatter'), null);
});

test('lax suffix: still parses Train loss even with trailing garbage', () => {
  assert.deepEqual(parseTrainLine('Iter 10: Train loss 0.5 extra garbage'), { iter: 10, loss: 0.5 });
});

test('empty string returns null', () => {
  assert.equal(parseTrainLine(''), null);
});

test('fallback regex catches bare loss with iter=-1 sentinel', () => {
  assert.deepEqual(parseTrainLine('loss: 1.5'), { iter: -1, loss: 1.5 });
});
