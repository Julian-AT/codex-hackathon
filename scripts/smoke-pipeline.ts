// scripts/smoke-pipeline.ts
// Manual smoke — NOT in CI (requires live provider API keys).
//
// Usage:
//   pnpm next build && pnpm next start &
//   sleep 3 && pnpm tsx scripts/smoke-pipeline.ts
//
// Asserts:
//   - Exactly 1 top-level 'start' chunk (PITFALLS P9 — confirms no phantom
//     per-worker framing from writer.merge).
//   - At least 2 distinct data-task-notification ids (confirms 2 parallel
//     workers merged into the single client SSE — ORC-01).
//
// After passing, open Sentry and confirm >=2 spans with op=ai.agent and
// distinct worker.id attributes. Paste the span URL into the plan SUMMARY.

const URL = 'http://localhost:3000/api/pipeline';

const res = await fetch(URL, {
	method: 'POST',
	headers: { 'content-type': 'application/json' },
	body: JSON.stringify({
		prompt: 'Launch exactly 2 discovery workers named w1 and w2 in parallel. Do nothing else.',
	}),
});
if (!res.ok) throw new Error(`status ${res.status}: ${await res.text()}`);

const reader = res.body!.getReader();
const decoder = new TextDecoder();
let buf = '';
let startCount = 0;
const notificationIds = new Set<string>();

while (true) {
	const { value, done } = await reader.read();
	if (done) break;
	buf += decoder.decode(value, { stream: true });

	// SSE frames are terminated by blank lines. Parse complete frames only;
	// carry the remainder forward so we don't JSON.parse half a payload.
	const frames = buf.split('\n\n');
	buf = frames.pop() ?? '';
	for (const frame of frames) {
		for (const line of frame.split('\n')) {
			if (!line.startsWith('data:')) continue;
			const payload = line.slice(5).trim();
			if (payload === '[DONE]' || payload.length === 0) continue;
			try {
				const obj = JSON.parse(payload);
				if (obj.type === 'start') startCount++;
				if (obj.type === 'data-task-notification') notificationIds.add(obj.id);
			} catch {
				// ignore non-JSON heartbeat frames
			}
		}
	}
}

if (startCount !== 1) {
	console.error(`FAIL: expected 1 start, got ${startCount}`);
	process.exit(1);
}
if (notificationIds.size < 2) {
	console.error(`FAIL: expected >=2 distinct notification ids, got ${notificationIds.size}`);
	process.exit(1);
}
console.log(
	`OK: 1 start, ${notificationIds.size} task-notifications (ids: ${[...notificationIds].join(', ')})`,
);
process.exit(0);
