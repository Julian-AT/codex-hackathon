import { describe, expect, it } from 'vitest';
import { transformSftToGrpo } from './transformGrpoJsonl';

describe('transformSftToGrpo', () => {
	it('maps tool-call rows to prompt + tool name answer', () => {
		const rows = transformSftToGrpo([
			JSON.stringify({
				messages: [
					{ role: 'system', content: 'You are helpful.' },
					{ role: 'user', content: 'Show the profiles schema.' },
					{
						role: 'assistant',
						content: '',
						tool_calls: [
							{
								id: 'call_1',
								type: 'function',
								function: {
									name: 'get_profiles_schema',
									arguments: '{}',
								},
							},
						],
					},
				],
			}),
		]);

		expect(rows).toEqual([{ prompt: 'Show the profiles schema.', answer: 'get_profiles_schema' }]);
	});

	it('falls back to the final assistant content for plain QA rows', () => {
		const rows = transformSftToGrpo([
			JSON.stringify({
				messages: [
					{ role: 'user', content: 'What is RLS?' },
					{ role: 'assistant', content: 'Row Level Security.' },
				],
			}),
		]);

		expect(rows).toEqual([{ prompt: 'What is RLS?', answer: 'Row Level Security.' }]);
	});
});
