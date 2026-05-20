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
    target: 'es2020',
    sourcemap: false,
    assetsInlineLimit: 4096,   // inline assets < 4 KB as base64
    cssCodeSplit: true,
    chunkSizeWarningLimit: 600,
    // Disable automatic <link rel="modulepreload"> injection —
    // we use a CDN importmap in dev and don't need the browser to preload every chunk eagerly
    modulePreload: { polyfill: false },
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Keep these heavy libraries in their own deferred chunks
          if (id.includes('hls.js'))                return 'vendor-hls';       // ~161 KB gz, lazy on first play
          if (id.includes('recharts') || id.includes('d3') || id.includes('victory'))
                                                     return 'vendor-recharts';  // ~113 KB gz, analytics only
          if (id.includes('@google/genai'))          return 'vendor-gemini';    // ~56 KB gz, AI captions only
          if (id.includes('@supabase'))              return 'vendor-supabase';  // ~52 KB gz
          if (id.includes('lucide-react'))           return 'vendor-lucide';    // ~14 KB gz
          // Split large app routes into their own chunks
          if (id.includes('components/AdminDashboard'))    return 'route-admin';
          if (id.includes('components/UploadSection'))     return 'route-upload';
          if (id.includes('components/AnalyticsDashboard'))return 'route-analytics';
          if (id.includes('components/LandingPage'))       return 'route-landing';
          if (id.includes('components/ShortsPlayer'))      return 'route-shorts';
          if (id.includes('components/SettingsSection'))   return 'route-settings';
        },
      },
    },
  },
});
