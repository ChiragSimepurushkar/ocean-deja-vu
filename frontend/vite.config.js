import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/field': 'http://127.0.0.1:8000',
      '/profile': 'http://127.0.0.1:8000',
      '/diagnostics': 'http://127.0.0.1:8000',
      '/advisory': 'http://127.0.0.1:8000',
      '/transect': 'http://127.0.0.1:8000',
      '/health': 'http://127.0.0.1:8000',
      '/api': {
        target: 'http://127.0.0.1:8000',
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
})
