import { createOpenAI } from '@ai-sdk/openai';

const LOCAL_BASE_URL = process.env.MLX_SERVER_URL ?? 'http://localhost:8080/v1';
const LOCAL_MODEL = process.env.LOCAL_MODEL ?? 'default';

export const local = createOpenAI({
	baseURL: LOCAL_BASE_URL,
	apiKey: 'local',
});

export function getModel(override?: string) {
	return local(override ?? LOCAL_MODEL);
}
