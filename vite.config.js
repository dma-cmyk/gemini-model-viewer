import { defineConfig } from 'vite';

export default defineConfig({
  base: '/gemini-model-viewer/',
  server: {
    port: 3100,
    strictPort: true,
  }
});
