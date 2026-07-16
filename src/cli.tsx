#!/usr/bin/env bun
import { runCli } from './cli/main';

const columns = process.stdout.columns ?? Number.parseInt(process.env.COLUMNS ?? '80', 10);
const result = await runCli(
	process.argv.slice(2),
	{
		columns: Number.isFinite(columns) ? columns : 80,
		isTTY: process.stdout.isTTY === true,
	},
	{},
);

process.stdout.write(result.output);
process.exitCode = result.exitCode;
