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
    dedupe: [
      'react',
      'react-dom',
      'wagmi',
      'viem',
      '@wagmi/core',
      '@tanstack/react-query',
      '@tanstack/query-core',
    ],
  },
  optimizeDeps: {
    include: [
      '@tanstack/query-core',
      '@tanstack/react-query',
      '@wagmi/core',
      'wagmi',
      'viem',
    ],
    esbuildOptions: {
      define: {
        global: 'globalThis',
      },
    },
  },
  build: {
    outDir: path.resolve(__dirname, '../public/js'),
    emptyOutDir: false,
    lib: {
      entry: path.resolve(__dirname, 'src/main.jsx'),
      name: 'VoodooRainbowBridge',
      formats: ['iife'],
      fileName: () => 'rainbow-bridge.js',
    },
    rollupOptions: {
      output: {
        assetFileNames: (assetInfo) => {
          if (assetInfo.name && assetInfo.name.endsWith('.css')) {
            return 'rainbow-bridge.css';
          }
          return 'rainbow-bridge-[name][extname]';
        },
        inlineDynamicImports: true,
      },
    },
    cssCodeSplit: false,
    sourcemap: false,
    target: 'es2020',
    chunkSizeWarningLimit: 6000,
    commonjsOptions: {
      include: [/node_modules/],
      transformMixedEsModules: true,
    },
  },
});
