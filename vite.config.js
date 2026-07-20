import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base './' is a hard rule: the built app must survive being served
// behind any path prefix (FastAPI static mount, tunnels, proxies).
export default defineConfig({
  base: './',
  plugins: [react()],
})
