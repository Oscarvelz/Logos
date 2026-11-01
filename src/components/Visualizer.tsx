import { useEffect, useRef } from 'react'
import { levels, listen, vizSnapshot } from '../player/listen.ts'

/**
 * Mirrored-bar visualizer. Reads the real loudness envelope of the sentence
 * being played (computed from the synthesized PCM, so it keeps working when the
 * page is backgrounded and needs no AudioContext), with a gentle idle shimmer.
 */
export function Visualizer({ bars = 48 }: { bars?: number }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current!
    const off = startOffThread(canvas, bars)
    if (off) return off
    const ctx = canvas.getContext('2d')!
    const target = new Float32Array(bars)
    const shown = new Float32Array(bars)
    let raf = 0
    let t = 0
    const accent = () => getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#e9bd72'
    const accent2 = () => getComputedStyle(document.documentElement).getPropertyValue('--accent-2').trim() || '#f3d39c'
    let colors = [accent(), accent2()]
    const themeObs = new MutationObserver(() => { colors = [accent(), accent2()] })
    themeObs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })

    // 30 fps is plenty for bars; when idle and settled, stop drawing entirely so
    // the CPU goes to the voice engine and scrolling.
    // Full frame rate while sound plays (smooth), 30 fps otherwise; when idle
    // and settled, stop drawing so the CPU goes to the voice engine.
    let last = 0
    let idleFrames = 0
    let grad: CanvasGradient | null = null
    let gradKey = ''
    const draw = (now = performance.now()) => {
      raf = requestAnimationFrame(draw)
      const st = listen.get()
      const minGap = st.playing && st.mode === 'kokoro' ? 0 : 32
      if (now - last < minGap) return
      const dt = Math.min(0.1, (now - last) / 1000)
      t += dt
      last = now
      const st0 = listen.get()
      if (!st0.playing && !st0.buffering) { if (++idleFrames > 45) return } else idleFrames = 0
      const dpr = Math.min(2, devicePixelRatio || 1)
      const w = canvas.clientWidth
      const h = canvas.clientHeight
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr)
        canvas.height = Math.round(h * dpr)
      }
      const s = listen.get()
      const live = levels(bars, target)
      if (!live) {
        for (let i = 0; i < bars; i++) {
          if (s.playing && s.mode === 'device') {
            target[i] = 0.25 + 0.55 * Math.abs(Math.sin(t * 5.3 + i * 0.7) * Math.sin(t * 2.1 + i * 0.31))
          } else if (s.buffering) {
            const d = Math.abs(i - ((t * 30) % (bars + 10)) + 5)
            target[i] = 0.08 + 0.5 * Math.max(0, 1 - d / 6)
          } else {
            target[i] = 0.05 + 0.04 * Math.sin(t * 1.6 + i * 0.4)
          }
        }
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, w, h)
      const gap = w / bars
      const bw = Math.max(2, gap * 0.52)
      const key = `${w}|${colors[0]}|${colors[1]}`
      if (!grad || key !== gradKey) {
        gradKey = key
        grad = ctx.createLinearGradient(0, 0, w, 0)
        grad.addColorStop(0, colors[0] + '33')
        grad.addColorStop(0.5, colors[1])
        grad.addColorStop(1, colors[0] + '33')
      }
      ctx.fillStyle = grad
      // ease toward target at the same speed whatever the frame rate; the centre bar is "now"
      const k = 1 - Math.pow(1 - (live ? 0.45 : 0.12), dt * 30)
      ctx.beginPath()
      for (let i = 0; i < bars; i++) {
        shown[i] += (target[i] - shown[i]) * k
        const center = 1 - Math.abs(i - bars / 2) / (bars / 2)
        const amp = Math.max(0.04, shown[i]) * (0.55 + 0.45 * center)
        const bh = Math.max(3, amp * (h - 6))
        const x = i * gap + (gap - bw) / 2
        const y = (h - bh) / 2
        ctx.roundRect(x, y, bw, bh, bw / 2)
      }
      ctx.fill()
    }
    draw()
    return () => { cancelAnimationFrame(raf); themeObs.disconnect() }
  }, [bars])
  return <canvas ref={ref} className="viz" aria-hidden />
}

/**
 * Preferred path: hand the canvas to a worker that draws every frame on its own
 * thread; the page only sends it the sentence envelope and the playhead, a few
 * times a second. Returns a cleanup, or null where OffscreenCanvas is missing.
 */
function startOffThread(canvas: HTMLCanvasElement, bars: number): (() => void) | null {
  if (typeof canvas.transferControlToOffscreen !== 'function' || typeof OffscreenCanvas === 'undefined') return null
  if (canvas.dataset.off) return () => {}
  let worker: Worker | undefined
  let offscreen: OffscreenCanvas
  try {
    worker = new Worker(new URL('./viz.worker.ts', import.meta.url), { type: 'module' })
    offscreen = canvas.transferControlToOffscreen()
    canvas.dataset.off = '1'
  } catch { worker?.terminate(); return null }
  const w = worker
  w.postMessage({ type: 'init', canvas: offscreen, bars }, [offscreen])
  const css = (n: string, d: string) => getComputedStyle(document.documentElement).getPropertyValue(n).trim() || d
  const sendColors = () => w.postMessage({ type: 'colors', a: css('--accent', '#e9bd72'), b: css('--accent-2', '#f3d39c') })
  const sendSize = () => w.postMessage({ type: 'size', w: canvas.clientWidth, h: canvas.clientHeight, dpr: Math.min(2, devicePixelRatio || 1) })
  sendColors(); sendSize()
  const themeObs = new MutationObserver(sendColors)
  themeObs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
  const ro = new ResizeObserver(sendSize)
  ro.observe(canvas)
  let envKey = ''
  let lastSig = ''
  const tick = () => {
    const s = listen.get()
    const v = vizSnapshot()
    if (v.key !== envKey) {
      envKey = v.key
      w.postMessage({ type: 'env', key: v.key, env: v.env ? v.env.slice() : null })
    }
    const mode = v.env ? 'live' : s.playing && s.mode === 'device' ? 'device' : s.buffering ? 'buffering' : 'idle'
    const sig = `${v.key}|${v.time}|${v.running}|${mode}|${v.rate}`
    if (sig !== lastSig || mode !== 'idle') {
      lastSig = sig
      w.postMessage({ type: 'clock', key: v.key, time: v.time, rate: v.rate, running: v.running, mode })
    }
  }
  tick()
  const id = setInterval(tick, 100)
  const unsub = listen.subscribe(tick)
  return () => { clearInterval(id); unsub(); ro.disconnect(); themeObs.disconnect(); w.terminate() }
}
