import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react(), tailwindcss()],
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      build: {
        rollupOptions: {
          output: {
            manualChunks: {
              react: ['react', 'react-dom'],
              router: ['react-router'],
              firebase: ['firebase'],
              genai: ['@google/genai'],
              markdown: ['react-markdown', 'remark-gfm'],
              motion: ['motion'],
              lucide: ['lucide-react'],
            },
          },
        },
      }
    };
});
