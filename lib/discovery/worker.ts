import { generateObject, type LanguageModel } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { z } from 'zod';
import type { Chunk, DynamicToolSpec } from './types';
import { buildToolDesignPrompt } from './prompts';

const Z_TRAJECTORY = z.object({
  userPrompt: z.string(),
  call: z.object({ name: z.string(), arguments: z.record(z.string(), z.any()) }),
  result: z.any(),
});
const Z_DYNAMIC_TOOL_SPEC = z.object({
  type: z.literal('function'),
  function: z.object({
    name: z.string().regex(/^[a-z][a-z0-9_]*$/),
    description: z.string().min(10).max(400),
    parameters: z.record(z.string(), z.any()),
  }),
  meta: z.object({
    jsBody: z.string().min(20).max(4000),
    requiresNetwork: z.boolean(),
    trajectories: z.array(Z_TRAJECTORY).min(3).max(6),
    sourceWorker: z.string(),
    sourceChunks: z.array(z.string()),
  }),
});
export const DYNAMIC_TOOL_SPEC_SCHEMA = z.object({
  tools: z.array(Z_DYNAMIC_TOOL_SPEC).min(1).max(8),
});

export interface ToolDesignWorkerInput {
  workerId: string;
  slice: Chunk[];
  model?: LanguageModel;
  temperature?: number;
  maxCandidatesPerWorker?: number;
}

export async function toolDesignWorker(input: ToolDesignWorkerInput): Promise<DynamicToolSpec[]> {
  const { workerId, slice, model, temperature = 0.4 } = input;
  const { system, user } = buildToolDesignPrompt(workerId, slice);
  const { object } = await generateObject({
    model: model ?? anthropic('claude-opus-4-5'),
    schema: DYNAMIC_TOOL_SPEC_SCHEMA,
    system,
    prompt: user,
    temperature,
    experimental_telemetry: { isEnabled: true, functionId: `tool-design.${workerId}` },
  });
  // Server-side stamp sourceWorker — do not trust the model.
  return object.tools.map((t) => ({
    ...t,
    meta: { ...t.meta, sourceWorker: workerId },
  })) as DynamicToolSpec[];
}
