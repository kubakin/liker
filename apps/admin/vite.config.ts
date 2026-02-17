import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // слушать 0.0.0.0 — иначе туннель (tuna.am, ngrok и т.д.) не подключается
    allowedHosts: true, // разрешить любой Host (для туннелей с произвольным доменом)
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:3002',
        changeOrigin: true,
      },
    },
    // Через туннель WebSocket для HMR часто обрывается (EOF). Запуск с VITE_HMR=false отключает HMR.
    ...(process.env.VITE_HMR === 'false' && { hmr: false }),
  },
});
