import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { createStore, useStore } from '../lib/store.ts'
import type { Voice } from '../lib/voices.ts'

// ── Toasts ──
type Toast = { id: number; text: string; action?: { label: string; run: () => void } }
const toasts = createStore<{ list: Toast[] }>({ list: [] })
let tid = 1
export function toast(text: string, action?: Toast['action'], ms = 3600) {
  const id = tid++
  toasts.set((s) => ({ list: [...s.list.slice(-2), { id, text, action }] }))
  setTimeout(() => toasts.set((s) => ({ list: s.list.filter((t) => t.id !== id) })), ms)
}
export function Toasts() {
  const { list } = useStore(toasts)
  return (
    <div className="toasts" role="status" aria-live="polite">
      {list.map((t) => (
        <div className="toast" key={t.id}>
          <span>{t.text}</span>
          {t.action && <button onClick={() => { t.action!.run(); toasts.set((s) => ({ list: s.list.filter((x) => x.id !== t.id) })) }}>{t.action.label}</button>}
        </div>
      ))}
    </div>
  )
}

// ── Sheet ──
export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title?: string; children: ReactNode }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])
  if (!open) return null
  // Portal: page transitions create stacking contexts that would trap the sheet under the nav.
  return createPortal(
    <>
      <div className="scrim" onClick={onClose} />
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title}>
        <div className="sheet-grip" />
        {title && <h3>{title}</h3>}
        {children}
      </div>
    </>,
    document.body,
  )
}

// ── Segmented control ──
export function Seg<T extends string | number>({ value, options, onChange, label }: { value: T; options: { value: T; label: ReactNode }[]; onChange: (v: T) => void; label?: string }) {
  return (
    <div className="seg" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={String(o.value)} role="radio" aria-checked={o.value === value} className={o.value === value ? 'on' : ''} onClick={() => onChange(o.value)}>{o.label}</button>
      ))}
    </div>
  )
}

export function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return <button role="switch" aria-checked={on} aria-label={label} className={`switch ${on ? 'on' : ''}`} onClick={() => onChange(!on)} />
}

export function Range({ value, min, max, step, onChange, label }: { value: number; min: number; max: number; step: number; onChange: (v: number) => void; label: string }) {
  const pct = ((value - min) / (max - min)) * 100
  return (
    <input type="range" aria-label={label} min={min} max={max} step={step} value={value}
      style={{ ['--pct' as string]: `${pct}%` }}
      onChange={(e) => onChange(Number(e.target.value))} />
  )
}

// ── Voice avatar: a monogram on a per-voice gradient ──
const HUES: Record<string, [number, number]> = {}
export function voiceHue(id: string): [number, number] {
  if (HUES[id]) return HUES[id]
  let h = 0
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) % 360
  const base = id.startsWith('e') ? 12 + (h % 30) : id.startsWith('b') ? 200 + (h % 50) : 28 + (h % 300)
  HUES[id] = [base, (base + 48) % 360]
  return HUES[id]
}
export function Avatar({ voice, playing }: { voice: Voice; playing?: boolean }) {
  const [a, b] = voiceHue(voice.id)
  return (
    <div className={`avatar ${playing ? 'playing' : ''}`} style={{ background: `linear-gradient(135deg, hsl(${a} 62% 52%), hsl(${b} 58% 30%))` }} aria-hidden>
      {voice.name[0]}
    </div>
  )
}

export function useMediaQuery(q: string) {
  const [m, setM] = useState(() => matchMedia(q).matches)
  useEffect(() => {
    const mq = matchMedia(q)
    const on = () => setM(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [q])
  return m
}

export function ProgressRing({ value, size = 20, stroke = 2.5 }: { value: number; size?: number; stroke?: number }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  return (
    <svg className="ring" width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-3)" strokeWidth={stroke} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--accent)" strokeWidth={stroke} strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={c * (1 - Math.max(0.02, Math.min(1, value)))} transform={`rotate(-90 ${size / 2} ${size / 2})`} style={{ transition: 'stroke-dashoffset .4s' }} />
    </svg>
  )
}
