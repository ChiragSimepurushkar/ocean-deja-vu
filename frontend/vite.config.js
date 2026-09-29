import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // Proxy all API requests to the FastAPI backend
      '/field':       { target: 'http://127.0.0.1:8000', changeOrigin: true },
      '/profile':     { target: 'http://127.0.0.1:8000', changeOrigin: true },
      '/diagnostics': { target: 'http://127.0.0.1:8000', changeOrigin: true },
      '/advisory':    { target: 'http://127.0.0.1:8000', changeOrigin: true },
      '/transect':    { target: 'http://127.0.0.1:8000', changeOrigin: true },
      '/health':      { target: 'http://127.0.0.1:8000', changeOrigin: true },
    },
  },
})
