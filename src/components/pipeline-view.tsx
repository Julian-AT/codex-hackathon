import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import type React from 'react';

export interface StageInfo {
	id: string;
	label: string;
	status: 'pending' | 'running' | 'done' | 'error';
	detail?: string;
}

interface PipelineViewProps {
	stages: StageInfo[];
	title?: string;
}

function statusIcon(status: StageInfo['status']): React.ReactNode {
	switch (status) {
		case 'pending':
			return <Text dimColor>○</Text>;
		case 'running':
			return (
				<Text color="cyan">
					<Spinner type="dots" />
				</Text>
			);
		case 'done':
			return <Text color="green">●</Text>;
		case 'error':
			return <Text color="red">✕</Text>;
	}
}

export function PipelineView({ stages, title }: PipelineViewProps) {
	return (
		<Box flexDirection="column" paddingX={1}>
			{title && (
				<Text bold color="white">
					{title}
				</Text>
			)}
			{stages.map((stage) => (
				<Box key={stage.id} gap={1}>
					{statusIcon(stage.status)}
					<Text bold={stage.status === 'running'}>{stage.label}</Text>
					{stage.detail && <Text dimColor>— {stage.detail}</Text>}
				</Box>
			))}
		</Box>
	);
}
