import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
  // Load environment variables based on the current mode (development / production)
  const env = loadEnv(mode, process.cwd(), '');

  // Extract API URL and Port from .env with fallback defaults
  const apiUrl = env.VITE_API_URL || 'http://localhost:3000';
  const port = parseInt(env.VITE_PORT || '5173', 10);

  return {
    plugins: [react(), tailwindcss()],
    server: {
      port,
      proxy: {
        '/api': {
          target: apiUrl,
          changeOrigin: true,
          secure: false,
        },
        '/socket.io': {
          target: apiUrl,
          ws: true, // Enables WebSocket reverse proxying
          changeOrigin: true,
          secure: false,
        },
      },
    },
  };
});