// lib/coordinator/coordinator.ts
// The coordinator is a ToolLoopAgent whose only tool is spawnWorker. This
// allowlist is what enforces PRD §10.2 rule #1 ("coordinator never performs
// domain work") — it literally has no other tool to call.
//
// Verified ai@6.0.168 exports (plan Task 1 verification step):
//   [ 'createUIMessageStream', 'createUIMessageStreamResponse', 'stepCountIs',
//     'ToolLoopAgent', 'Experimental_Agent' (alias), 'tool', ... ]
// We import ToolLoopAgent directly (stable name in 6.0.168) rather than the
// Experimental_Agent alias.

import { ToolLoopAgent as Agent, stepCountIs } from 'ai';
import type { UIMessageStreamWriter } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import pLimit from 'p-limit';

import { createSpawnWorkerTool } from '@/lib/coordinator/spawnWorker';

// Pin baseURL — shell may export ANTHROPIC_BASE_URL to a local proxy.
const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  baseURL: 'https://api.anthropic.com/v1',
});

const COORDINATOR_MODEL = 'claude-opus-4-7';
const COORDINATOR_STEP_CAP = 8; // PITFALLS P10 — equivalent to stepCountIs(8)
const COORDINATOR_WORKER_CONCURRENCY = 15; // PITFALLS P22

const SYSTEM = [
  'You are a coordinator agent in a multi-worker pipeline.',
  'You NEVER perform domain work yourself. You ONLY call the spawnWorker tool to delegate.',
  'When asked to launch N workers in parallel, emit N tool calls in a single turn before observing any result.',
  'Available roles: discovery, tool-design, data-gen-qa, data-gen-traj, eval-gen.',
  'Always provide a unique id per worker (e.g. "discovery-1", "discovery-2").',
].join(' ');

export function createCoordinator(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  writer: UIMessageStreamWriter<any>,
) {
  const limiter = pLimit(COORDINATOR_WORKER_CONCURRENCY);
  return new Agent({
    model: anthropic(COORDINATOR_MODEL),
    instructions: SYSTEM,
    stopWhen: stepCountIs(COORDINATOR_STEP_CAP),
    tools: {
      spawnWorker: createSpawnWorkerTool(writer, limiter),
    },
  });
}
