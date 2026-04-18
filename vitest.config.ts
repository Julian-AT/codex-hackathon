import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    include: ['lib/**/*.test.ts', 'lib/**/*.spec.ts'],
    testTimeout: 10_000,
    hookTimeout: 10_000,
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, '.') },
  },
});
