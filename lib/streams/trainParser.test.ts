import { describe, expect, it } from 'vitest';
import { parseTrainLine } from './trainParser';

describe('parseTrainLine', () => {
	it('parses SFT Train loss line', () => {
		expect(parseTrainLine('Iter 5: Train loss 1.234')).toEqual({
			iter: 5,
			loss: 1.234,
		});
	});

	it('parses GRPO reward from the actual total_rewards_mean log shape', () => {
		expect(
			parseTrainLine(
				'Iter 1: Val loss 0.000, Val total_rewards_mean 0.000, Val total_rewards_std 0.000',
			),
		).toEqual({ iter: 1, reward: 0 });
	});

	it('parses GRPO reward lines with longer per-function suffixes', () => {
		expect(
			parseTrainLine(
				'Iter 8: Val loss 1.250, Val total_rewards_mean 0.375, Val total_rewards_std 0.111, Val r1_accuracy_reward_func_mean 0.500',
			),
		).toEqual({ iter: 8, reward: 0.375 });
	});

	it('returns null on unrelated chatter', () => {
		expect(parseTrainLine('some unrelated stdout chatter')).toBeNull();
	});

	it('still parses Train loss with trailing garbage', () => {
		expect(parseTrainLine('Iter 10: Train loss 0.5 extra garbage')).toEqual({
			iter: 10,
			loss: 0.5,
		});
	});

	it('empty string returns null', () => {
		expect(parseTrainLine('')).toBeNull();
	});

	it('fallback regex catches bare loss with iter=-1 sentinel', () => {
		expect(parseTrainLine('loss: 1.5')).toEqual({ iter: -1, loss: 1.5 });
	});
});
