import { defineConfig } from 'vitest/config';

// The @/ alias comes from tsconfig.json paths; Vite 8 resolves it natively
// (resolve.tsconfigPaths, marked experimental), so vite-tsconfig-paths is gone.
export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: 'node',
    globals: true,
  },
});
