import { defineConfig } from 'vite';

// Assets under public/assets are served as-is (textures, HDR skies, glTF models); everything in src/ is bundled.
export default defineConfig({
  base: './',
  server: { port: 5173, open: false },
  preview: { port: 4173 },
  build: { outDir: 'dist', assetsDir: 'bundle', emptyOutDir: true, target: 'es2020', chunkSizeWarningLimit: 6000, assetsInlineLimit: 0 }
});
