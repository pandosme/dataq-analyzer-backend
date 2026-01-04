import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/',  // Admin UI served from root path
  server: {
    host: '0.0.0.0',  // Listen on all network interfaces
    port: 5174,       // Development port
    proxy: {
      '/api': {
        target: 'http://localhost:3303',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
  },
})
