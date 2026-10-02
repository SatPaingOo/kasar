import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Tests mirror source, and each game keeps its own beside it.
    include: ['tests/**/*.test.ts', 'games/*/tests/**/*.test.ts'],
    environment: 'node',
  },
});
