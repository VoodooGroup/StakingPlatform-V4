import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
    'process.env': {},
    global: 'globalThis',
  },
  resolve: {
    dedupe: ['react', 'react-dom', 'wagmi', 'viem', '@tanstack/react-query'],
  },
  build: {
    outDir: path.resolve(__dirname, '../public/js'),
    emptyOutDir: false,
    lib: {
      entry: path.resolve(__dirname, 'src/main.jsx'),
      name: 'VoodooAppKitBridge',
      formats: ['iife'],
      fileName: () => 'appkit-bridge.js',
    },
    rollupOptions: {
      output: {
        assetFileNames: (assetInfo) => {
          if (assetInfo.name && assetInfo.name.endsWith('.css')) {
            return 'appkit-bridge.css';
          }
          return 'appkit-bridge-[name][extname]';
        },
        inlineDynamicImports: true,
      },
    },
    cssCodeSplit: false,
    sourcemap: false,
    target: 'es2020',
    chunkSizeWarningLimit: 8000,
    commonjsOptions: {
      include: [/node_modules/],
      transformMixedEsModules: true,
    },
  },
});
