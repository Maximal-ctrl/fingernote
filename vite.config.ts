import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // Lokal unter "/", auf GitHub Pages unter "/fingernote/" (setzt der Workflow über BASE_PATH).
  base: process.env.BASE_PATH || '/',
  plugins: [react()],
  server: { port: 5173, strictPort: true, host: 'localhost' },
  // Gleicher Port wie der Dev-Server: Die Notizen hängen am Origin (localhost:5173).
  preview: { port: 5173, strictPort: true, host: 'localhost', open: true },
  build: { target: 'es2022', chunkSizeWarningLimit: 2500 },
});
