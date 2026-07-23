import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base './' is a hard rule: the built app must survive being served
// behind any path prefix (FastAPI static mount, tunnels, proxies).
export default defineConfig({
  base: './',
  plugins: [react()],
  // Dev-only: forward api/* to the FastAPI backend so `npm run dev` works
  // against a live server. The demo build is served BY FastAPI (same origin),
  // so this proxy never exists in production and all URLs stay relative.
  server: {
    proxy: { '/api': 'http://localhost:8000' },
  },
})
