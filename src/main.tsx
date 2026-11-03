import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'
import App from './App.tsx'
import { consumeShareTarget } from './lib/drafts.ts'
import { applyTheme, settings } from './lib/settings.ts'
import { trackPlayback } from './lib/library.ts'
import { startKeeping } from './engine/keep.ts'

applyTheme(settings.get().theme)
consumeShareTarget()
trackPlayback()
startKeeping()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Service worker: offline app shell + COOP/COEP injection so ONNX Runtime can
// use multi-threaded WASM on GitHub Pages (which cannot set headers).
// Adapted from BetterTTS.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  const base = import.meta.env.BASE_URL
  navigator.serviceWorker.register(`${base}sw.js`, { scope: base }).then((reg) => {
    reg.addEventListener('updatefound', () => { if (!window.crossOriginIsolated) reloadOnceForIsolation() })
    if ((reg.active || reg.waiting) && !navigator.serviceWorker.controller && !window.crossOriginIsolated) reloadOnceForIsolation()
  }).catch(() => {})
}

function reloadOnceForIsolation() {
  try {
    if (sessionStorage.getItem('logos-isolation-reload') === '1') return
    sessionStorage.setItem('logos-isolation-reload', '1')
  } catch { /* storage blocked */ }
  // Wait for the worker to take control, then reload once.
  const go = () => location.reload()
  if (navigator.serviceWorker.controller) go()
  else navigator.serviceWorker.addEventListener('controllerchange', go, { once: true })
}

// Opt-in debug/test handle (localStorage 'logos.debug' = '1'); used by the headless test kit.
try {
  if (localStorage.getItem('logos.debug') === '1') {
    void Promise.all([import('./engine/engine.ts'), import('./player/listen.ts'), import('./player/exporter.ts'), import('./lib/audio.ts'), import('./lib/library.ts'), import('./lib/webtext.ts')]).then(([engine, listen, exporter, audio, library, webtext]) => {
      ;(window as unknown as Record<string, unknown>).__logos = { engine, listen, exporter, audio, library, webtext }
    })
  }
} catch { /* ignore */ }
