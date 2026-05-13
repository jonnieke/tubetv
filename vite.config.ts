import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  server: {
    port: 3000,
    host: '0.0.0.0',
  },
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: {
          // Charts — large D3-based bundle, only loaded on Analytics tab
          'vendor-recharts': ['recharts'],
          // HLS streaming — large; loaded only when a video plays
          'vendor-hls': ['hls.js'],
          // Supabase client
          'vendor-supabase': ['@supabase/supabase-js'],
          // Icon library
          'vendor-lucide': ['lucide-react'],
          // Google Gemini SDK — AI features only, lazy at runtime
          'vendor-gemini': ['@google/genai'],
        },
      },
    },
  },
});
