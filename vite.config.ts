import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('@codemirror') || id.includes('@uiw/react-codemirror')) {
            return 'codemirror';
          }
          if (id.includes('@supabase')) return 'supabase';
          if (id.includes('react-querybuilder')) return 'querybuilder';
          if (id.includes('lucide-react')) return 'icons';
          if (id.includes('react') || id.includes('scheduler')) return 'react';
          return undefined;
        },
      },
    },
  },
});
