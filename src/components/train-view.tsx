import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import React from 'react';

export interface TrainState {
	mode: 'sft' | 'grpo';
	iter: number;
	totalIters: number;
	loss?: number;
	tokPerSec?: number;
	status: 'running' | 'done' | 'error' | 'rollback';
	message?: string;
}

interface TrainViewProps {
	state: TrainState;
}

export function TrainView({ state }: TrainViewProps) {
	const pct = state.totalIters > 0 ? Math.round((state.iter / state.totalIters) * 100) : 0;
	const barWidth = 30;
	const filled = Math.round((pct / 100) * barWidth);
	const bar = '█'.repeat(filled) + '░'.repeat(barWidth - filled);

	return (
		<Box flexDirection="column" paddingX={1}>
			<Box gap={1}>
				{state.status === 'running' && (
					<Text color="cyan">
						<Spinner type="dots" />
					</Text>
				)}
				{state.status === 'done' && <Text color="green">●</Text>}
				{state.status === 'error' && <Text color="red">✕</Text>}
				{state.status === 'rollback' && <Text color="yellow">↺</Text>}
				<Text bold>Training ({state.mode.toUpperCase()})</Text>
			</Box>

			<Box gap={1}>
				<Text color="cyan">{bar}</Text>
				<Text>
					{state.iter}/{state.totalIters} ({pct}%)
				</Text>
			</Box>

			<Box gap={2}>
				{state.loss !== undefined && (
					<Text>
						loss: <Text color="yellow">{state.loss.toFixed(4)}</Text>
					</Text>
				)}
				{state.tokPerSec !== undefined && (
					<Text>
						tok/s: <Text color="green">{state.tokPerSec.toFixed(1)}</Text>
					</Text>
				)}
			</Box>

			{state.message && <Text dimColor>{state.message}</Text>}
		</Box>
	);
}
