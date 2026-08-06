import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
// On GitHub Pages the site is served from /<repo>/, so the production build
// uses that base path. Local dev stays at / for convenience.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/AI-slop-project/' : '/',
  plugins: [react(), tailwindcss()],
}))
