import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, path.resolve(__dirname, '..'), '');
  const serverPort = env.SERVER_PORT || env.PORT || '3004';
  const serverHost = env.SERVER_HOST || '127.0.0.1';
  const clientPort = Number(env.CLIENT_PORT || 8504);
  const clientHost = env.CLIENT_HOST || '127.0.0.1';
  const allowedHosts = (env.CLIENT_ALLOWED_HOSTS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const basePath = env.VITE_BASE_PATH || process.env.VITE_BASE_PATH || '';
  return {
    plugins: [react()],
    base: basePath ? `${basePath}/` : '/',
    optimizeDeps: {
      exclude: ['maplibre-gl'],
    },
    server: {
      host: clientHost,
      port: clientPort,
      strictPort: false,
      allowedHosts: allowedHosts.length ? allowedHosts : undefined,
      proxy: {
        '/api': `http://${serverHost}:${serverPort}`,
      },
    },
  };
});
