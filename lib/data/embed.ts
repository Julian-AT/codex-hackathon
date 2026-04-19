import { pipeline as hfPipeline } from '@huggingface/transformers';

let extractor: Awaited<ReturnType<typeof hfPipeline>> | null = null;

export async function embedTexts(texts: string[]): Promise<number[][]> {
	if (!extractor) {
		extractor = await hfPipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
	}
	const results = await extractor(texts, { pooling: 'mean', normalize: true });
	const arr = results as unknown as { data: Float32Array }[];
	return Array.from({ length: texts.length }, (_, i) => Array.from(arr[i].data));
}
