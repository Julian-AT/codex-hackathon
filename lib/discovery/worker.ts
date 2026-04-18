import { generateObject, type LanguageModel } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';
import type { Chunk, DynamicToolSpec } from './types';
import { buildToolDesignPrompt } from './prompts';
import { normalizeToolArguments, parseTrajectoryResult } from '../tool-args';

const Z_TRAJECTORY = z.object({
  userPrompt: z.string(),
  call: z.object({
    name: z.string(),
    arguments: z
      .string()
      .describe('JSON string: object of tool arguments matching the parameter schema'),
  }),
  result: z.string().describe('JSON string: simulated tool return payload'),
});
const Z_DYNAMIC_TOOL_SPEC = z.object({
  type: z.literal('function'),
  function: z.object({
    name: z.string().regex(/^[a-z][a-z0-9_]*$/),
    description: z.string().min(10).max(400),
    parameters: z
      .string()
      .describe('JSON string: JSON Schema object for the tool parameters property'),
  }),
  meta: z.object({
    jsBody: z.string().min(20).max(4000),
    requiresNetwork: z.boolean(),
    trajectories: z.array(Z_TRAJECTORY).min(3).max(6),
    sourceWorker: z.string(),
    sourceChunks: z.array(z.string()),
  }),
});

/** LLM wire format for generateObject (JSON strings) — OpenAI strict mode compatible. */
export const DYNAMIC_TOOL_SPEC_SCHEMA = z.object({
  tools: z.array(Z_DYNAMIC_TOOL_SPEC).min(1).max(8),
});

const Z_TRAJECTORY_DISK = z.object({
  userPrompt: z.string(),
  call: z.object({
    name: z.string(),
    arguments: z.record(z.string(), z.unknown()),
  }),
  result: z.unknown(),
});

/** Normalized manifest / disk shape ({ parameters: object, ... }) — not used as generateObject schema. */
export const DYNAMIC_TOOL_SPEC_DISK_SCHEMA = z.object({
  type: z.literal('function'),
  function: z.object({
    name: z.string().regex(/^[a-z][a-z0-9_]*$/),
    description: z.string().min(10).max(400),
    parameters: z.record(z.string(), z.unknown()),
  }),
  meta: z.object({
    jsBody: z.string().min(20).max(4000),
    requiresNetwork: z.boolean(),
    trajectories: z.array(Z_TRAJECTORY_DISK).min(3).max(6),
    sourceWorker: z.string(),
    sourceChunks: z.array(z.string()),
  }),
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
    model: model ?? openai(process.env.DISCOVERY_MODEL || 'gpt-5-mini'),
    schema: DYNAMIC_TOOL_SPEC_SCHEMA,
    system,
    prompt: user,
    temperature,
    experimental_telemetry: { isEnabled: true, functionId: `tool-design.${workerId}` },
  });
  // Server-side stamp sourceWorker — parse JSON strings from OpenAI-safe schema.
  return object.tools.map((t) => ({
    type: 'function' as const,
    function: {
      name: t.function.name,
      description: t.function.description,
      parameters: normalizeToolArguments(t.function.parameters),
    },
    meta: {
      ...t.meta,
      sourceWorker: workerId,
      trajectories: t.meta.trajectories.map((tr) => ({
        userPrompt: tr.userPrompt,
        call: {
          name: tr.call.name,
          arguments: normalizeToolArguments(tr.call.arguments),
        },
        result: parseTrajectoryResult(tr.result),
      })),
    },
  }));
}
