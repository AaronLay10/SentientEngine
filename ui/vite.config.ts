import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

// API target: use 'orchestrator' in Docker, 'localhost' for local dev
const apiHost = process.env.VITE_API_HOST || 'localhost';
const apiTarget = `http://${apiHost}:8080`;
const wsTarget = `ws://${apiHost}:8080`;

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    outDir: '../internal/api/ui-dist',
    emptyOutDir: true,
  },
  server: {
    proxy: {
      '/ws': {
        target: wsTarget,
        ws: true,
      },
      '/api': {
        target: apiTarget,
      },
      '/health': {
        target: apiTarget,
      },
      '/ready': {
        target: apiTarget,
      },
    },
  },
});
