import { isOriginalFavorite } from '../lib/settings.ts'
import { Check, ChevronDown, Lock, LockOpen, Star, Trash2 } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { createStore, useStore } from '../lib/store.ts'
import type { Voice } from '../lib/voices.ts'
import { t } from '../lib/i18n.ts'

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

// ── Delete confirmation ──
// Oscar (1.4.87): nothing is deleted by a single tap. Every file deletion
// in the app asks first, in this one window, so the question always looks
// the same wherever it is asked. Resolves true only on an explicit Delete.
type ConfirmReq = { title: string; body?: string; resolve: (ok: boolean) => void }
const confirmStore = createStore<{ req: ConfirmReq | null }>({ req: null })
export function confirmDelete(title: string, body?: string): Promise<boolean> {
  return new Promise((resolve) => {
    confirmStore.get().req?.resolve(false)
    confirmStore.set({ req: { title, body, resolve } })
  })
}
export function ConfirmHost() {
  const { req } = useStore(confirmStore)
  if (!req) return null
  const done = (ok: boolean) => { confirmStore.set({ req: null }); req.resolve(ok) }
  return (
    <Sheet open onClose={() => done(false)} title={req.title}>
      {req.body && <p className="keepask-body">{req.body}</p>}
      <div className="row" style={{ gap: 8 }}>
        <button className="btn ghost grow" onClick={() => done(false)}>{t('Cancel')}</button>
        <button className="btn danger grow" onClick={() => done(true)}><Trash2 size={16} /> {t('Delete')}</button>
      </div>
    </Sheet>
  )
}

/**
 * A select that opens in the app's own Sheet instead of the platform's native
 * menu (1.4.49, Oscar: Android's gray option sheet does not belong in a premium
 * app). The closed control keeps the pill look the native select had.
 */
export function MenuSelect<T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  const [open, setOpen] = useState(false)
  const current = options.find((o) => o.value === value)
  return (
    <>
      <button type="button" className="menu-select" aria-haspopup="dialog" aria-expanded={open} aria-label={label} onClick={() => setOpen(true)}>
        <span>{current?.label ?? ''}</span>
        <ChevronDown size={14} />
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title={label}>
        <div className="menu-list" role="radiogroup" aria-label={label}>
          {options.map((o) => (
            <button key={o.value} type="button" role="radio" aria-checked={o.value === value} className={o.value === value ? 'on' : ''} onClick={() => { onChange(o.value); setOpen(false) }}>
              <span>{o.label}</span>
              {o.value === value && <Check size={18} className="pick-check" />}
            </button>
          ))}
        </div>
      </Sheet>
    </>
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

export function Range({ value, min, max, step, onChange, label, guarded }: { value: number; min: number; max: number; step: number; onChange: (v: number) => void; label: string; guarded?: boolean }) {
  const pct = ((value - min) / (max - min)) * 100
  // The little lock (Oscar, 1.4.164): a guarded slider rests LOCKED —
  // its lock lit gold — so a finger scrolling through Settings
  // slides past without changing a thing by mistake. One tap on
  // the lock (it answers with a small pop as the shackle opens)
  // frees the bar; another tap locks it again, lit.
  const [locked, setLocked] = useState(true)
  const input = (
    <input type="range" aria-label={label} min={min} max={max} step={step} value={value}
      disabled={guarded && locked}
      className={guarded ? (locked ? 'range-locked' : 'range-free') : undefined}
      style={{ ['--pct' as string]: `${pct}%` }}
      onChange={(e) => onChange(Number(e.target.value))} />
  )
  if (!guarded) return input
  return (
    <div className="range-wrap">
      {input}
      <button type="button" className={`range-lock ${locked ? 'on' : ''}`} aria-label={t(locked ? 'Unlock slider' : 'Lock slider')} title={t(locked ? 'Unlock slider' : 'Lock slider')}
        onClick={() => setLocked((v) => !v)}>
        <span className="range-lock-ic" key={locked ? 'l' : 'u'}>{locked ? <Lock size={15} /> : <LockOpen size={15} />}</span>
      </button>
    </div>
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

/** Favorite star: gold for the starting favorites, violet with a soft glow for ones starred later. */
export function FavStar({ id, on = true, size = 13 }: { id: string; on?: boolean; size?: number }) {
  const later = on && !isOriginalFavorite(id)
  const color = !on ? 'currentColor' : later ? 'var(--violet)' : 'var(--accent)'
  return <Star size={size} fill={on ? color : 'none'} color={color} className={later ? 'star-later' : undefined} aria-hidden />
}
