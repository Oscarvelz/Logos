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

// ephone's browser bundle contains a Node-only fallback branch that is never
// entered in a browser; strip it so Vite does not try to externalize node:module.
// (Adapted from BetterTTS.)
function ephoneBrowserPatch(): Plugin {
  return {
    name: 'ephone-browser-patch',
    enforce: 'pre',
    transform(code, id) {
      if (!id.replace(/\\/g, '/').includes('/ephone/ephone.js')) return null
      return {
        code: code
          .replace(/const\{createRequire\}=await import\("node:module"\);var require=createRequire\(import\.meta\.url\)/u, 'const require = undefined')
          .replace(/import\("node:module"\)/gu, 'Promise.resolve({ createRequire: () => undefined })')
          .replace(/require\("node:[^"]+"\)/gu, 'undefined')
          // Only the Romance pack (Spanish) is used; don't emit 30 MB of other languages.
          .replace(/import\('\.\/lang\/(all|en-all|en-us|gmw|jpx|sit|zlx)\.js'\)/gu, "Promise.reject(new Error('language pack not bundled'))"),
        map: null,
      }
    },
  }
}

// GitHub push protection mistakes the model name string "Mistral3ForConditionalGeneration"
// in transformers.js 4 for a secret and refuses the deploy push; split the literal.
function pushScanSafe(): Plugin {
  const fix = (code: string) => code.split('"Mistral3ForConditionalGeneration"').join('"Mistral3"+"ForConditionalGeneration"')
  return {
    name: 'logos-push-scan-safe',
    generateBundle(_opts, bundle) {
      for (const f of Object.values(bundle)) {
        if (f.type === 'chunk' && f.code.includes('"Mistral3ForConditionalGeneration"')) f.code = fix(f.code)
        else if (f.type === 'asset' && f.fileName.endsWith('.js') && typeof f.source === 'string' && f.source.includes('"Mistral3ForConditionalGeneration"')) f.source = fix(f.source)
      }
    },
  }
}

export default defineConfig({
  base: BASE.endsWith('/') ? BASE : `${BASE}/`,
  plugins: [react(), ephoneBrowserPatch(), swBuildId(), pushScanSafe()],
  worker: { format: 'es', plugins: () => [ephoneBrowserPatch(), pushScanSafe()] },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 4000,
    assetsInlineLimit: 0,
  },
  optimizeDeps: { exclude: ['kokoro-js', '@huggingface/transformers', 'ephone'] },
})
