import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// The FastAPI backend runs on :8000. The dev server proxies the API and the demo fixture sites.
const API = process.env.HAUL16_API ?? 'http://127.0.0.1:8000'

export default defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [tailwindcss(), tanstackStart({ spa: { enabled: true } }), viteReact()],
  server: {
    proxy: {
      '/api': { target: API, changeOrigin: true },
      '/demo-sites': { target: API, changeOrigin: true },
    },
  },
})
