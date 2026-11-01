import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

// ── Deploy base path ─────────────────────────────────────────────
// GitHub Pages serves a project site from /<repo>/. Change the default
// below (or set VITE_BASE at build time) when the repo name is final.
const BASE = process.env.VITE_BASE ?? '/Logos/'

// public/ is copied verbatim, so the service-worker cache name is stamped
// after the bundle is written: every deploy invalidates the old app shell.
function swBuildId(): Plugin {
  return {
    name: 'sw-build-id',
    apply: 'build',
    closeBundle() {
      const swPath = join(import.meta.dirname, 'dist', 'sw.js')
      try {
        writeFileSync(swPath, readFileSync(swPath, 'utf8').replace('__BUILD_ID__', String(Date.now())))
      } catch { /* not a build */ }
    },
  }
}

export default defineConfig({
  base: BASE.endsWith('/') ? BASE : `${BASE}/`,
  plugins: [react(), swBuildId()],
  worker: { format: 'es' },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 4000,
    assetsInlineLimit: 0,
  },
  optimizeDeps: { exclude: ['pocket-tts-onnx'] },
})
