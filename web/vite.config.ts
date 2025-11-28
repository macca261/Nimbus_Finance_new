/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig(({ mode }) => {
  // Use mode or process.env to determine if we're in dev (safe for Node.js context)
  const isDev = mode === 'development' || process.env.NODE_ENV !== 'production';
  
  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      // Ensure the dev server binds to all interfaces for network testing
      host: true,
      port: 5173,
      hmr: { overlay: false },
      proxy: {
        '/api': {
          // Precise definition of the backend target is critical
          target: 'http://localhost:4001',
          
          // Critical for preventing "Host header" mismatch errors in strict backends
          changeOrigin: true,
          
          // Disable SSL verification for self-signed dev certificates
          secure: false,
          
          // Path Rewriting: The Staff-Level fix for the 404 error
          // Keep /api prefix since backend routes are mounted at /api/*
          // rewrite: (path) => path.replace(/^\/api/, ''), // NOT needed - backend expects /api
          
          // Extended timeout to prevent 504/500 errors on large CSV parsing
          timeout: 60000,
          
          // Observable Proxy Events for Debugging
          configure: (proxy, _options) => {
            proxy.on('error', (err, _req, _res) => {
              console.error('[Proxy Error] Network Failure:', err);
            });
            
            proxy.on('proxyReq', (proxyReq, req, _res) => {
              // Verify content-type headers for multipart uploads
              if (isDev) {
                console.log(`[Proxy Outbound] ${req.method} ${req.url}`);
              }
            });
            
            proxy.on('proxyRes', (proxyRes, req, _res) => {
              if (isDev) {
                console.log(`[Proxy Inbound] Status: ${proxyRes.statusCode} URL: ${req.url}`);
              }
            });
          },
        },
      },
    },
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: ['./src/test-setup.ts'],
    },
  };
});


