import { defineConfig } from 'vite';

export default defineConfig({
  // Relative base so assets + public/data/*.json resolve on publish hosts.
  base: './',
  publicDir: 'public',
  server: {
    host: true,
    port: 5173,
    headers: {
      // Balance JSON must not stick in browser cache during tuning.
      'Cache-Control': 'no-store',
    },
  },
  preview: {
    host: true,
    port: 5173,
    headers: {
      'Cache-Control': 'no-store',
    },
  },
  build: {
    // Keep JSON copy-through from public/ intact in dist/.
    assetsDir: 'assets',
  },
});
