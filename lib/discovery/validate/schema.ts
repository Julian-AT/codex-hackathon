import Ajv2020 from 'ajv/dist/2020.js';
import type { ValidationResult } from '../types';

const ajv = new Ajv2020({ strict: false, allErrors: true });

export function validateSchema(parameters: unknown): ValidationResult {
	try {
		ajv.compile(parameters as object);
		return { pass: true };
	} catch (err) {
		return {
			pass: false,
			failedGate: 'schema',
			reason: String((err as Error).message).slice(0, 400),
		};
	}
}
