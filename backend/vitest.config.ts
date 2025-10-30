import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    deps: {
      inline: [/@nimbus\/parser-de/],
    },
    coverage: {
      reporter: ['text', 'html'],
    },
  },
});


