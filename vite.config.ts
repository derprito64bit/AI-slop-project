// Imported from vitest/config rather than vite: it is the same defineConfig plus
// the types for the `test` block below, so one config still covers both the build
// and the test run.
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
// On GitHub Pages the site is served from /<repo>/, so the production build
// uses that base path. Local dev stays at / for convenience.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/AI-slop-project/' : '/',
  plugins: [react(), tailwindcss()],
  test: {
    // The backend and its suite live in their own repo (TheKeems/UniServer), so
    // there is nothing server-side for vitest to pick up here. Kept explicit
    // because the defaults are otherwise invisible.
    exclude: ['**/node_modules/**', '**/dist/**'],
  },
}))
