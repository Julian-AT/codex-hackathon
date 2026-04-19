#!/usr/bin/env bun
import { render } from 'ink';
import React from 'react';
import { App } from './app';
import { startModelServer, stopModelServer, waitForServer } from './lib/server-manager';

const COMMANDS = [
	'pipeline',
	'discover',
	'data-gen',
	'train',
	'eval',
	'fuse',
	'deploy',
	'serve',
] as const;
type Command = (typeof COMMANDS)[number];

function printHelp() {
	console.log(`
codex — offline specialist LLM pipeline

Usage: bun src/cli.tsx <command>

Commands:
  pipeline     Run full pipeline (discover → data-gen → train → eval → fuse)
  discover     Run discovery swarm only
  data-gen     Run data generation only
  train        Run SFT training
  eval         Run evaluation harness
  fuse         Fuse adapter weights
  deploy       Deploy adapter to iPhone via xcrun devicectl
  serve        Start mlx_lm.server standalone

Options:
  --help       Show this help message
  --no-serve   Skip auto-starting mlx_lm.server (assumes already running)

Environment:
  MLX_SERVER_URL   Model server URL (default: http://localhost:8080/v1)
  LOCAL_MODEL      Model name for mlx_lm.server
  ADAPTER_DIR      Adapter output directory
  IPHONE_UDID      Target iPhone UDID for deploy
`);
}

async function main() {
	const args = process.argv.slice(2);

	if (args.includes('--help') || args.includes('-h') || args.length === 0) {
		printHelp();
		process.exit(0);
	}

	const command = args[0] as string;
	if (!COMMANDS.includes(command as Command)) {
		console.error(`Unknown command: ${command}`);
		printHelp();
		process.exit(1);
	}

	const noServe = args.includes('--no-serve');

	if (command === 'serve') {
		const model = process.env.LOCAL_MODEL ?? 'mlx-community/gemma-3-4b-it-4bit';
		console.log(`Starting mlx_lm.server with model: ${model}`);
		const proc = startModelServer();

		proc.stdout?.on('data', (d: Buffer) => process.stdout.write(d));
		proc.stderr?.on('data', (d: Buffer) => process.stderr.write(d));

		proc.on('close', (code) => {
			console.log(`Server exited with code ${code}`);
			process.exit(code ?? 0);
		});

		process.on('SIGINT', () => {
			stopModelServer(proc);
			process.exit(0);
		});

		await waitForServer();
		console.log('Server ready.');
		return;
	}

	let serverProc: ReturnType<typeof startModelServer> | null = null;

	if (!noServe) {
		try {
			const res = await fetch(process.env.MLX_SERVER_URL ?? 'http://localhost:8080/v1/models');
			if (!res.ok) throw new Error('not ok');
		} catch {
			console.log('Starting mlx_lm.server...');
			serverProc = startModelServer();
			await waitForServer();
			console.log('Server ready.');
		}
	}

	const { waitUntilExit } = render(React.createElement(App, { command: command as Command }));

	try {
		await waitUntilExit();
	} finally {
		if (serverProc) {
			stopModelServer(serverProc);
		}
	}
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
