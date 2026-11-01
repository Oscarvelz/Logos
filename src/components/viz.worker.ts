/// <reference lib="webworker" />
// Draws the Listen-page visualizer on its own thread (OffscreenCanvas), so the
// bars keep moving smoothly even while the page's main thread is busy with the
// speech engine's results, the reader, or scrolling.

type Mode = 'live' | 'device' | 'buffering' | 'idle'
type Msg =
  | { type: 'init'; canvas: OffscreenCanvas; bars: number }
  | { type: 'size'; w: number; h: number; dpr: number }
  | { type: 'colors'; a: string; b: string }
  | { type: 'env'; key: string; env: Float32Array | null }
  | { type: 'clock'; key: string; time: number; rate: number; running: boolean; mode: Mode }

let canvas: OffscreenCanvas | null = null
let ctx: OffscreenCanvasRenderingContext2D | null = null
let bars = 48
let target = new Float32Array(bars)
let shown = new Float32Array(bars)
let W = 300, H = 80, DPR = 1
let colors = ['#e9bd72', '#f3d39c']
let grad: CanvasGradient | null = null
let gradKey = ''
let envKey = ''
let env: Float32Array | null = null
let mode: Mode = 'idle'
let clockKey = ''
let raw = 0, rawAt = 0, rate = 1, running = false, shownTime = 0
let t = 0, last = 0, timer = 0

self.onmessage = (e: MessageEvent<Msg>) => {
  const m = e.data
  if (m.type === 'init') {
    canvas = m.canvas; bars = m.bars
    target = new Float32Array(bars); shown = new Float32Array(bars)
    ctx = canvas.getContext('2d')
    schedule()
  } else if (m.type === 'size') {
    W = m.w; H = m.h; DPR = m.dpr
    if (canvas) { canvas.width = Math.max(1, Math.round(W * DPR)); canvas.height = Math.max(1, Math.round(H * DPR)) }
    grad = null
  } else if (m.type === 'colors') {
    colors = [m.a, m.b]; grad = null
  } else if (m.type === 'env') {
    envKey = m.key; env = m.env
  } else if (m.type === 'clock') {
    const now = performance.now()
    mode = m.mode
    if (m.key !== clockKey || m.time < raw - 0.05 || Math.abs(m.time - shownTime) > 0.4) { clockKey = m.key; shownTime = m.time; raw = m.time; rawAt = now }
    else if (m.time !== raw) { raw = m.time; rawAt = now }
    rate = m.rate; running = m.running
    schedule()
  }
}

function schedule() {
  if (timer) return
  const raf = (self as unknown as { requestAnimationFrame?: (cb: (t: number) => void) => number }).requestAnimationFrame
  timer = raf ? raf((n) => { timer = 0; frame(n) }) : (setTimeout(() => { timer = 0; frame(performance.now()) }, 16) as unknown as number)
}

function playhead(now: number) {
  const predicted = running ? raw + ((now - rawAt) / 1000) * rate : raw
  shownTime = Math.max(shownTime, Math.min(predicted, raw + 0.25))
  return shownTime
}

function frame(now: number) {
  const live = mode === 'live' && env && envKey === clockKey
  const dt = Math.min(0.1, (now - last) / 1000)
  t += dt; last = now
  schedule()
  if (!ctx) return
  if (live && env) {
    const f = playhead(now) * 60
    const base = Math.floor(f), frac = f - base
    for (let k = 0; k < bars; k++) {
      const i = base - Math.floor(bars / 2) + k
      const a = i >= 0 && i < env.length ? env[i] : 0
      const b = i + 1 >= 0 && i + 1 < env.length ? env[i + 1] : 0
      target[k] = a + (b - a) * frac
    }
  } else {
    for (let i = 0; i < bars; i++) {
      if (mode === 'device') target[i] = 0.25 + 0.55 * Math.abs(Math.sin(t * 5.3 + i * 0.7) * Math.sin(t * 2.1 + i * 0.31))
      else if (mode === 'buffering') { const d = Math.abs(i - ((t * 30) % (bars + 10)) + 5); target[i] = 0.08 + 0.5 * Math.max(0, 1 - d / 6) }
      else target[i] = 0.05 + 0.04 * Math.sin(t * 1.6 + i * 0.4)
    }
  }
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0)
  ctx.clearRect(0, 0, W, H)
  const key = `${W}|${colors[0]}|${colors[1]}`
  if (!grad || key !== gradKey) {
    gradKey = key
    grad = ctx.createLinearGradient(0, 0, W, 0)
    grad.addColorStop(0, colors[0] + '33'); grad.addColorStop(0.5, colors[1]); grad.addColorStop(1, colors[0] + '33')
  }
  ctx.fillStyle = grad
  const k = 1 - Math.pow(1 - (live ? 0.45 : 0.12), dt * 30)
  const gap = W / bars, bw = Math.max(2, gap * 0.52)
  ctx.beginPath()
  for (let i = 0; i < bars; i++) {
    shown[i] += (target[i] - shown[i]) * k
    const center = 1 - Math.abs(i - bars / 2) / (bars / 2)
    const amp = Math.max(0.04, shown[i]) * (0.55 + 0.45 * center)
    const bh = Math.max(3, amp * (H - 6))
    ctx.roundRect(i * gap + (gap - bw) / 2, (H - bh) / 2, bw, bh, bw / 2)
  }
  ctx.fill()
}
