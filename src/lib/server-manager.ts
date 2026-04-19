import { type ChildProcess, spawn } from 'node:child_process';

const DEFAULT_PORT = 8080;
const POLL_INTERVAL_MS = 500;
const DEFAULT_TIMEOUT_MS = 120_000;

export interface ServerOptions {
	model?: string;
	port?: number;
}

export function startModelServer(opts: ServerOptions = {}): ChildProcess {
	const model = opts.model ?? process.env.LOCAL_MODEL ?? 'mlx-community/gemma-3-4b-it-4bit';
	const port = opts.port ?? DEFAULT_PORT;

	const child = spawn('python', ['-m', 'mlx_lm.server', '--model', model, '--port', String(port)], {
		stdio: ['ignore', 'pipe', 'pipe'],
		env: { ...process.env },
	});

	child.unref();
	return child;
}

export async function waitForServer(url?: string, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<void> {
	const endpoint = url ?? `http://localhost:${DEFAULT_PORT}/v1/models`;
	const deadline = Date.now() + timeoutMs;

	while (Date.now() < deadline) {
		try {
			const res = await fetch(endpoint);
			if (res.ok) return;
		} catch {
			// not ready yet
		}
		await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
	}

	throw new Error(`Model server did not become ready within ${timeoutMs}ms`);
}

export function stopModelServer(proc: ChildProcess): void {
	if (!proc.killed) {
		proc.kill('SIGTERM');
	}
}
