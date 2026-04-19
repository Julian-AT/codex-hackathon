/**
 * Shared Phase 3 vocabulary.
 * Source of truth: PRD §9.1, §19.3 and plan 03-01.
 * Every downstream discovery plan imports from this file.
 */

export interface Chunk {
	id: string; // e.g. "llms.txt#0042"
	source: 'llms' | 'cli' | 'guides';
	text: string; // raw chunk text
	tokenCount: number; // measured by gpt-tokenizer
	ordinal: number; // 0-based index within source
}

export interface CORPUS {
	chunks: Chunk[];
	byTopic: Record<string, string[]>; // topic -> chunk ids (optional, best-effort)
	fetchedAt: string; // ISO timestamp
	sourceBytes: number;
}

/**
 * OpenAI tool-schema shape + discovery meta sidecar.
 * Pitfall 6 — one shape, end-to-end. Phase 4 reads `.function` directly,
 * Phase 3 reads `.meta` for sandbox execution and trajectory replay.
 */
export interface DynamicToolSpec {
	type: 'function';
	function: {
		name: string;
		description: string;
		parameters: Record<string, unknown>; // JSON Schema draft 2020-12
	};
	meta: {
		jsBody: string;
		requiresNetwork: boolean;
		trajectories: Array<{
			userPrompt: string;
			call: { name: string; arguments: Record<string, unknown> };
			result: unknown;
		}>;
		sourceWorker: string; // worker id that emitted this spec
		sourceChunks: string[]; // ids of chunks that grounded this tool
	};
}

export type GateName = 'schema' | 'parse' | 'sandbox' | 'fuzz' | 'trajectory';

export interface ValidationResult {
	pass: boolean;
	failedGate?: GateName;
	reason?: string;
	details?: unknown;
}
