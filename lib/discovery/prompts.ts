import type { Chunk } from './types';

export const BANNED_LIST = [
  'fetch','require','import','process','globalThis','eval','Function',
  'crypto','performance','Math.random','Date.now','constructor.constructor',
];

const SYSTEM = `You are a tool-design worker in a parallel swarm of 4. Read the Supabase documentation chunks below and propose 3–6 JavaScript tools the downstream Gemma 4 adapter can call.

EVERY tool MUST:
1. Have a snake_case name matching /^[a-z][a-z0-9_]*$/.
2. Have a JSON Schema (draft 2020-12) \`parameters\` object with \`type:"object"\` and at least one required property.
3. Have a \`jsBody\` that is EXACTLY one top-level \`function <name>(args) { ... }\` declaration returning a JSON-serializable object.
4. NEVER reference any of these (AST deny-list; rejection is automatic): ${BANNED_LIST.join(', ')}.
5. Include EXACTLY 3 example \`trajectories\` where \`result\` is what \`function(call.arguments)\` actually returns (deterministic). If you would write \`Date.now()\`, rewrite the tool to take \`timestampMs\` as an argument.
6. Prefer \`requiresNetwork: false\` — the target device is in airplane mode. Only set true if the tool fundamentally cannot work offline.
7. Populate \`sourceChunks\` with the chunk ids you grounded this tool in.

Your output passes 5 validation gates: schema well-formedness, AST parse + deny-list, sandbox execution (2s / 64MB caps), 10-input fuzz (>=8 serializable), trajectory self-consistency. Tools failing ANY gate are discarded with no retry. Design defensively.

Output shape: { tools: DynamicToolSpec[] } with 3–6 entries. Stop when you have enough; do not pad.`;

export function buildToolDesignPrompt(workerId: string, slice: Chunk[]): { system: string; user: string } {
  const body = slice
    .map((c) => `<chunk id="${c.id}" source="${c.source}">\n${c.text}\n</chunk>`)
    .join('\n\n');
  const user = `Worker id: ${workerId}. Slice of ${slice.length} chunks below. Design 3–6 tools that could answer Supabase developer questions grounded in these chunks.\n\n${body}`;
  return { system: SYSTEM, user };
}
