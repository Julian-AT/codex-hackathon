import { Box, Text } from 'ink';
import React from 'react';

const MAX_LINES = 20;

interface LogViewProps {
	lines: string[];
	title?: string;
}

export function LogView({ lines, title }: LogViewProps) {
	const visible = lines.slice(-MAX_LINES);

	return (
		<Box flexDirection="column" borderStyle="single" borderColor="gray" paddingX={1}>
			{title && (
				<Text bold color="cyan">
					{title}
				</Text>
			)}
			{visible.map((line, i) => (
				<Text key={`${i}-${line.slice(0, 20)}`} dimColor>
					{line}
				</Text>
			))}
			{lines.length === 0 && <Text dimColor>Waiting for output...</Text>}
		</Box>
	);
}
