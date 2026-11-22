import { useEffect, useRef } from 'react'
import { levels, listen } from '../player/listen.ts'

/**
 * Mirrored-bar visualizer. Reads the real loudness envelope of the sentence
 * being played (computed from the synthesized PCM, so it keeps working when the
 * page is backgrounded and needs no AudioContext), with a gentle idle shimmer.
 *
 * The drawing lives on the page's own thread (1.4.230). It used to be
 * handed to a worker through OffscreenCanvas — a one-way door: once
 * transferred, the page can never draw on the canvas again, and a
 * transferred canvas whose worker has not painted (or whose surface
 * the system discarded) shows the compositor's WHITE backing. That
 * white seat is the defect Oscar photographed at 1.4.196's first
 * open and again at 1.4.229, past every watchdog: a plain canvas is
 * transparent where it has not painted, so over the dark card it can
 * be plain — never a white hole. The worker path is retired; the
 * bars may drop a frame under heavy synthesis load, a fair trade.
 */
export function Visualizer({ bars = 48 }: { bars?: number }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current!
    const ctx = canvas.getContext('2d')!
    const target = new Float32Array(bars)
    const shown = new Float32Array(bars)
    let raf = 0
    let t = 0
    const accent = () => getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#e9bd72'
    const accent2 = () => getComputedStyle(document.documentElement).getPropertyValue('--accent-2').trim() || '#f3d39c'
    // --viz-edge exists only where a theme gives the waveform an
    // undertow (Cyberpunk's magenta); elsewhere the edges fall
    // back to the accent, exactly as before.
    const edge = () => getComputedStyle(document.documentElement).getPropertyValue('--viz-edge').trim()
    let colors = [accent(), accent2(), edge()]
    const themeObs = new MutationObserver(() => { colors = [accent(), accent2(), edge()] })
    themeObs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })

    let last = 0
    let grad: CanvasGradient | null = null
    let gradKey = ''
    const draw = (now = performance.now()) => {
      raf = requestAnimationFrame(draw)
      const dt = Math.min(0.1, (now - last) / 1000)
      t += dt
      last = now
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
      const key = `${w}|${colors[0]}|${colors[1]}|${colors[2]}`
      if (!grad || key !== gradKey) {
        gradKey = key
        grad = ctx.createLinearGradient(0, 0, w, 0)
        grad.addColorStop(0, (colors[2] || colors[0]) + '33')
        grad.addColorStop(0.5, colors[1])
        grad.addColorStop(1, (colors[2] || colors[0]) + '33')
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
  return <canvas ref={ref} className="viz" data-present="listen-visualizer" aria-hidden />
}
