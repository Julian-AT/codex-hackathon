import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		environment: 'node',
		globals: false,
		include: ['test/integration/**/*.test.ts'],
		testTimeout: 15_000,
		hookTimeout: 10_000,
		teardownTimeout: 10_000,
		fileParallelism: false,
		watch: false,
	},
	resolve: {
		alias: { '@': path.resolve(__dirname, '.') },
	},
});
