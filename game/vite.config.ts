import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
  const env = loadEnv(mode, process.cwd(), '')
  
  return {
    plugins: [
      react(),
      nodePolyfills({
        protocolImports: true,
      }),
    ],
    server: {
      proxy: {
        // Proxy RPC requests to avoid CORS issues
        '/api/rpc': {
          target: 'https://eth-sepolia.public.blastapi.io',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/rpc/, ''),
          configure: (proxy) => {
            proxy.on('error', (err) => {
              console.log('proxy error', err);
            });
            proxy.on('proxyReq', (_proxyReq, req) => {
              console.log('Sending Request to the Target:', req.method, req.url);
            });
            proxy.on('proxyRes', (proxyRes, req) => {
              console.log('Received Response from the Target:', proxyRes.statusCode, req.url);
            });
          },
        },
      },
    },
    // Expose env variables to client
    define: {
      'import.meta.env.VITE_INFURA_API_KEY': JSON.stringify(env.VITE_INFURA_API_KEY),
    },
  }
})
