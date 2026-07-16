import { getModel } from '@/lib/model';
import { streamText } from 'ai';
import type { ContextStore } from './context-store';

function buildSystemPrompt(context: ContextStore): string {
	const parts: string[] = [
		'MLX — the personal coding dataset and model pipeline retains this assistant only as unreachable brownfield code.',
		'You help the user operate a pipeline that discovers tools, generates training data,',
		'fine-tunes a local Gemma model, and deploys adapters to an iPhone.',
		'',
		'Available slash commands:',
		'  /discover  — run discovery swarm',
		'  /data-gen  — generate training data',
		'  /train     — run SFT/GRPO training',
		'  /eval      — run evaluation harness',
		'  /pipeline  — run full pipeline',
		'  /fuse      — fuse adapter weights',
		'  /deploy    — deploy to device',
		'  /serve     — manage model server',
		'  /config    — view/edit settings',
		'  /status    — show pipeline state',
		'  /help      — list commands',
		'',
	];

	if (context.has('lastDiscovery')) {
		const d = context.get<{ tools: unknown[]; source: string }>('lastDiscovery');
		parts.push(`Last discovery: ${d.tools.length} tools found (source: ${d.source})`);
	}
	if (context.has('lastTraining')) {
		const t = context.get<{ mode: string; iters: number; finalLoss?: number }>('lastTraining');
		parts.push(
			`Last training: ${t.mode} mode, ${t.iters} iterations, final loss: ${t.finalLoss?.toFixed(4) ?? 'unknown'}`,
		);
	}
	if (context.has('lastEval')) {
		const e = context.get<{
			models: Array<{ label: string; available: boolean; score?: number }>;
		}>('lastEval');
		for (const m of e.models) {
			if (m.available) parts.push(`Eval ${m.label}: ${m.score?.toFixed(1)}%`);
		}
	}
	if (context.has('lastDataGen')) {
		const d = context.get<{ training: { count: number }; eval: { count: number } }>('lastDataGen');
		parts.push(`Last data gen: ${d.training.count} training, ${d.eval.count} eval examples`);
	}

	parts.push('', 'Answer concisely. If the user should run a command, suggest the slash command.');
	return parts.join('\n');
}

export interface ConversationOptions {
	userMessage: string;
	history: Array<{ role: 'user' | 'assistant'; content: string }>;
	context: ContextStore;
	signal: AbortSignal;
	onChunk: (chunk: string) => void;
	onComplete: (fullText: string) => void;
}

export async function streamConversation(opts: ConversationOptions): Promise<void> {
	const { userMessage, history, context, signal, onChunk, onComplete } = opts;

	const systemPrompt = buildSystemPrompt(context);
	const messages = [...history.slice(-20), { role: 'user' as const, content: userMessage }];

	const result = streamText({
		model: getModel(),
		system: systemPrompt,
		messages,
		maxOutputTokens: 2048,
		abortSignal: signal,
	});

	let fullText = '';
	for await (const chunk of result.textStream) {
		fullText += chunk;
		onChunk(chunk);
	}

	onComplete(fullText);
}
