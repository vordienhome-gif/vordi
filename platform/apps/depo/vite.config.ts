import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Geliştirmede /api istekleri yerel backend'e (port 3000) yönlendirilir.
// Üretimde aynı alan adında ters vekil (Caddy/Nginx) /api → backend yapar.
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    proxy: { '/api': { target: 'http://localhost:3000', rewrite: (p) => p.replace(/^\/api/, '') } },
  },
});
