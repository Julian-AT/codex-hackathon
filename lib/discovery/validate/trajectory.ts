import equal from 'fast-deep-equal';
import type { ValidationResult } from '../types';
import { runInSandbox } from './sandbox';

export interface Trajectory {
	userPrompt: string;
	call: { name: string; arguments: Record<string, unknown> };
	result: unknown;
}

export async function validateTrajectories(
	jsBody: string,
	trajectories: Trajectory[],
): Promise<ValidationResult> {
	if (trajectories.length < 3) {
		return {
			pass: false,
			failedGate: 'trajectory',
			reason: `<3 trajectories (have ${trajectories.length})`,
		};
	}
	for (let i = 0; i < trajectories.length; i++) {
		const t = trajectories[i];
		const actual = await runInSandbox(jsBody, t.call.arguments, 2000);
		if (!actual.ok) {
			return {
				pass: false,
				failedGate: 'trajectory',
				reason: `trajectory[${i}] sandbox err: ${actual.error}`,
			};
		}
		if (!equal(actual.value, t.result)) {
			return {
				pass: false,
				failedGate: 'trajectory',
				reason: `trajectory[${i}] mismatch`,
				details: { expected: t.result, actual: actual.value },
			};
		}
	}
	return { pass: true };
}
