import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['test/**/*.spec.ts', 'tests/**/*.spec.ts'],
    threads: false,
  },
});


