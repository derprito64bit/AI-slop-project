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
    // The backend has its own suite, written against node:test and run with
    // `npm test` inside server/ — vitest cannot execute those and reports them as
    // empty files if it tries.
    exclude: ['**/node_modules/**', '**/dist/**', 'server/**'],
  },
}))
