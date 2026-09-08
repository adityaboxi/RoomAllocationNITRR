import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
  // Load environment variables based on the current mode (development / production)
  const env = loadEnv(mode, process.cwd(), '');

  // Extract API URL and Port from .env
  const apiUrl = env.VITE_API_URL;
  const port = parseInt(env.VITE_PORT, 10);

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