import { appendFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { DataGenMeta, TrainingExample } from './types';
import type { DynamicToolSpec } from '../discovery/types';

const CHECKPOINT_DIR = path.resolve('data/checkpoints');
const DEFAULT_CHECKPOINT_EVERY = Number(
  process.env.DATA_GEN_CHECKPOINT_EVERY ?? 25,
);

function stripMeta(
  tools: DynamicToolSpec[],
): Array<{
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}> {
  return tools.map((t) => ({
    type: 'function',
    function: {
      name: t.function.name,
      description: t.function.description,
      parameters: t.function.parameters,
    },
  }));
}

function serializeExample(example: TrainingExample): string {
  const cleanTools = stripMeta(example.tools);
  const cleanMessages = example.messages.map((m) => {
    const msg: Record<string, unknown> = { role: m.role, content: m.content };
    if (m.tool_calls && m.tool_calls.length > 0) msg.tool_calls = m.tool_calls;
    if (m.tool_call_id) msg.tool_call_id = m.tool_call_id;
    if (m.name) msg.name = m.name;
    return msg;
  });
  return JSON.stringify({ messages: cleanMessages, tools: cleanTools });
}

export interface BatchCheckpointWriter {
  examplePath: string;
  metaPath: string;
  record: (example: TrainingExample, meta: DataGenMeta) => Promise<void>;
  flush: () => Promise<void>;
  close: () => Promise<void>;
}

export async function createBatchCheckpointWriter(
  stem: string,
  every = DEFAULT_CHECKPOINT_EVERY,
): Promise<BatchCheckpointWriter> {
  await mkdir(CHECKPOINT_DIR, { recursive: true });

  const examplePath = path.join(CHECKPOINT_DIR, `${stem}.examples.jsonl`);
  const metaPath = path.join(CHECKPOINT_DIR, `${stem}.meta.jsonl`);

  await writeFile(examplePath, '', 'utf8');
  await writeFile(metaPath, '', 'utf8');

  let bufferedExamples: string[] = [];
  let bufferedMeta: string[] = [];
  let queue = Promise.resolve();

  const flushInternal = async () => {
    if (bufferedExamples.length === 0) return;
    const examples = bufferedExamples.join('\n') + '\n';
    const meta = bufferedMeta.join('\n') + '\n';
    bufferedExamples = [];
    bufferedMeta = [];
    await appendFile(examplePath, examples, 'utf8');
    await appendFile(metaPath, meta, 'utf8');
  };

  const flush = () => {
    queue = queue.then(flushInternal);
    return queue;
  };

  return {
    examplePath,
    metaPath,
    async record(example, meta) {
      bufferedExamples.push(serializeExample(example));
      bufferedMeta.push(JSON.stringify(meta));
      if (bufferedExamples.length >= every) {
        await flush();
      }
    },
    flush,
    close: flush,
  };
}
