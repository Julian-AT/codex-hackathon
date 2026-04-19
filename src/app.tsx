import { Box, Text, useApp } from 'ink';
import React, { useCallback, useEffect, useState } from 'react';

import { runAdapter } from '@/lib/adapter/run-adapter';
import { runDataGenPipeline } from '@/lib/data/pipeline';
import { runDiscoveryPipeline } from '@/lib/discovery/pipeline';
import { runEval } from '@/lib/eval/run';
import type { TrainPoint } from '@/lib/streams/trainParser';
import { runTraining } from '@/lib/training/run-training';

import { LogView } from './components/log-view';
import { PipelineView, type StageInfo } from './components/pipeline-view';
import { type TrainState, TrainView } from './components/train-view';

type Command =
	| 'pipeline'
	| 'discover'
	| 'data-gen'
	| 'train'
	| 'eval'
	| 'fuse'
	| 'deploy'
	| 'serve';

interface AppProps {
	command: Command;
}

const PIPELINE_STAGES: StageInfo[] = [
	{ id: 'discover', label: 'Discovery swarm', status: 'pending' },
	{ id: 'data-gen', label: 'Data generation', status: 'pending' },
	{ id: 'train-sft', label: 'SFT training', status: 'pending' },
	{ id: 'eval', label: 'Evaluation', status: 'pending' },
	{ id: 'fuse', label: 'Fuse adapter', status: 'pending' },
];

function useLog() {
	const [lines, setLines] = useState<string[]>([]);
	const log = useCallback((msg: string) => {
		setLines((prev) => [...prev, msg]);
	}, []);
	return { lines, log };
}

export function App({ command }: AppProps) {
	const { exit } = useApp();
	const { lines, log } = useLog();
	const [stages, setStages] = useState<StageInfo[]>(PIPELINE_STAGES);
	const [trainState, setTrainState] = useState<TrainState | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [done, setDone] = useState(false);

	const updateStage = useCallback((id: string, update: Partial<StageInfo>) => {
		setStages((prev) => prev.map((s) => (s.id === id ? { ...s, ...update } : s)));
	}, []);

	useEffect(() => {
		const controller = new AbortController();

		(async () => {
			try {
				switch (command) {
					case 'pipeline':
						await runFullPipeline(controller.signal);
						break;
					case 'discover':
						await runDiscoverOnly(controller.signal);
						break;
					case 'data-gen':
						await runDataGenOnly(controller.signal);
						break;
					case 'train':
						await runTrainOnly(controller.signal);
						break;
					case 'eval':
						await runEvalOnly();
						break;
					case 'fuse':
						await runFuseOnly(controller.signal);
						break;
					case 'deploy':
						await runDeployOnly(controller.signal);
						break;
					default:
						log(`Unknown command: ${command}`);
				}
				setDone(true);
			} catch (e) {
				setError((e as Error).message);
			}
		})();

		return () => controller.abort();
	}, [command, log]);

	async function runDiscoverOnly(_signal: AbortSignal) {
		log('Starting discovery swarm...');
		const result = await runDiscoveryPipeline({
			corpus: await loadCorpus(log),
			onEvent: (ev) =>
				log(`[discover] ${ev.type}${'workerId' in ev && ev.workerId ? ` (${ev.workerId})` : ''}`),
		});
		log(`Discovery complete: ${result.tools.length} tools (source: ${result.source})`);
	}

	async function runDataGenOnly(_signal: AbortSignal) {
		log('Starting data generation...');
		const result = await runDataGenPipeline({
			onEvent: (ev) =>
				log(`[data-gen] ${ev.stage}: ${ev.status}${ev.detail ? ` — ${ev.detail}` : ''}`),
		});
		log(`Data gen complete: ${result.training.count} training, ${result.eval.count} eval examples`);
	}

	async function runTrainOnly(signal: AbortSignal) {
		const iters = 400;
		setTrainState({
			mode: 'sft',
			iter: 0,
			totalIters: iters,
			status: 'running',
		});
		await runTraining({
			mode: 'sft',
			iters,
			signal,
			onData: (pt: TrainPoint) => handleTrainPoint(pt, iters),
		});
		setTrainState((prev) => (prev ? { ...prev, status: 'done' } : prev));
	}

	async function runEvalOnly() {
		log('Running evaluation...');
		const result = await runEval();
		for (const m of result.models) {
			if (m.available) {
				log(`${m.label}: ${m.score?.toFixed(1)}% (${m.passed}/${m.total}) avg ${m.latencyMs}ms`);
			} else {
				log(`${m.label}: unavailable — ${m.notes}`);
			}
		}
	}

	async function runFuseOnly(signal: AbortSignal) {
		log('Fusing adapter weights...');
		await runAdapter({
			action: 'fuse',
			signal,
			onStep: (_id, line) => log(`[fuse] ${line}`),
		});
		log('Fuse complete.');
	}

	async function runDeployOnly(signal: AbortSignal) {
		log('Deploying to device...');
		await runAdapter({
			action: 'deploy',
			signal,
			onStep: (_id, line) => log(`[deploy] ${line}`),
		});
		log('Deploy complete.');
	}

	async function runFullPipeline(signal: AbortSignal) {
		// Stage 1: Discover
		updateStage('discover', { status: 'running' });
		log('Starting discovery swarm...');
		const discoverResult = await runDiscoveryPipeline({
			corpus: await loadCorpus(log),
			onEvent: (ev) => log(`[discover] ${ev.type}`),
		});
		updateStage('discover', {
			status: 'done',
			detail: `${discoverResult.tools.length} tools`,
		});

		if (signal.aborted) return;

		// Stage 2: Data gen
		updateStage('data-gen', { status: 'running' });
		log('Starting data generation...');
		const dataResult = await runDataGenPipeline({
			onEvent: (ev) => log(`[data-gen] ${ev.stage}: ${ev.status}`),
		});
		updateStage('data-gen', {
			status: 'done',
			detail: `${dataResult.training.count} examples`,
		});

		if (signal.aborted) return;

		// Stage 3: Train SFT
		updateStage('train-sft', { status: 'running' });
		const sftIters = 400;
		setTrainState({
			mode: 'sft',
			iter: 0,
			totalIters: sftIters,
			status: 'running',
		});
		await runTraining({
			mode: 'sft',
			iters: sftIters,
			signal,
			onData: (pt: TrainPoint) => handleTrainPoint(pt, sftIters),
		});
		setTrainState((prev) => (prev ? { ...prev, status: 'done' } : prev));
		updateStage('train-sft', { status: 'done' });

		if (signal.aborted) return;

		// Stage 4: Eval
		updateStage('eval', { status: 'running' });
		log('Running evaluation...');
		const evalResult = await runEval();
		for (const m of evalResult.models) {
			if (m.available) {
				log(`  ${m.label}: ${m.score?.toFixed(1)}%`);
			}
		}
		updateStage('eval', { status: 'done' });

		if (signal.aborted) return;

		// Stage 5: Fuse
		updateStage('fuse', { status: 'running' });
		await runAdapter({
			action: 'fuse',
			signal,
			onStep: (_id, line) => log(`[fuse] ${line}`),
		});
		updateStage('fuse', { status: 'done' });
	}

	function handleTrainPoint(pt: TrainPoint, totalIters: number) {
		if (pt.aborted) {
			setTrainState((prev) =>
				prev
					? {
							...prev,
							status: pt.aborted?.startsWith('rollback') ? 'rollback' : 'error',
							message: pt.aborted,
						}
					: prev,
			);
			return;
		}
		setTrainState((prev) => ({
			mode: prev?.mode ?? 'sft',
			iter: pt.iter,
			totalIters,
			loss: pt.loss ?? prev?.loss,
			tokPerSec: prev?.tokPerSec,
			status: 'running',
		}));
	}

	return (
		<Box flexDirection="column" padding={1}>
			<Text bold color="magenta">
				codex — offline specialist LLM pipeline
			</Text>
			<Text dimColor>command: {command}</Text>

			{command === 'pipeline' && <PipelineView stages={stages} />}
			{trainState && <TrainView state={trainState} />}
			<LogView lines={lines} />

			{error && (
				<Text color="red" bold>
					Error: {error}
				</Text>
			)}
			{done && (
				<Text color="green" bold>
					Done.
				</Text>
			)}
		</Box>
	);
}

async function loadCorpus(log: (msg: string) => void) {
	const { fetchCorpus } = await import('@/lib/discovery/corpus');
	log('Loading corpus...');
	return fetchCorpus();
}
