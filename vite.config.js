import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    host: true,
    port: 5173,
    headers: {
      // Balance JSON must not stick in browser cache during tuning.
      'Cache-Control': 'no-store',
    },
  },
});
