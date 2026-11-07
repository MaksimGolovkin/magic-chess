import { defineConfig } from 'vite';

// Relative base so the build works on GitHub Pages under /magic-chess/.
export default defineConfig({
  base: './',
  build: { chunkSizeWarningLimit: 1200 },
});
