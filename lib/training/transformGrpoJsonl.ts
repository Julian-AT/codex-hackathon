import type { ChatMessage } from '@/lib/data/types';

export type GrpoRow = {
	prompt: string;
	answer: string;
};

function lastMessage(messages: ChatMessage[], role: ChatMessage['role']): ChatMessage | undefined {
	return [...messages].reverse().find((message) => message.role === role);
}

export function transformSftToGrpo(lines: string[]): GrpoRow[] {
	return lines
		.map((line) => line.trim())
		.filter(Boolean)
		.map((line) => JSON.parse(line) as { messages?: ChatMessage[] })
		.map(({ messages }) => {
			const safeMessages = messages ?? [];
			const user = lastMessage(safeMessages, 'user');
			const assistant =
				safeMessages.find(
					(message) => message.role === 'assistant' && message.tool_calls?.length,
				) ?? lastMessage(safeMessages, 'assistant');

			const answer = assistant?.tool_calls?.[0]?.function.name ?? assistant?.content?.trim() ?? '';

			return {
				prompt: user?.content?.trim() ?? '',
				answer,
			};
		})
		.filter((row) => row.prompt && row.answer);
}
