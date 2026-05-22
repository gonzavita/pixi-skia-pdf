import { defineConfig } from 'vite';

// CanvasKit поставляет .wasm-файл — Vite не должен пытаться его инлайнить.
// Базовый путь './' делает сборку пригодной для любого статического хостинга.
export default defineConfig({
  base: './',
  server: {
    port: 5174,
  },
  build: {
    target: 'es2020',
  },
  assetsInclude: ['**/*.wasm'],
});
