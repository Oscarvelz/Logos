import { AudioLines, Library, Mic2, Pause, Play, Settings2, FastForward, Rewind, Sparkles, Star, Check, Download, Loader2, ChevronDown } from 'lucide-react'
import { navigate, useRoute, type Route } from '../lib/router.ts'
import { useStore } from '../lib/store.ts'
import { engine, ensureModel, POCKET_SIZE_MB, PHONON_SIZE_MB } from '../engine/engine.ts'
import { listen, toggle, next, prev } from '../player/listen.ts'
import { settings, toggleFavorite } from '../lib/settings.ts'
import { useEffect, useState } from 'react'
import { VOICES, favoriteVoices, type Lang, type Voice } from '../lib/voices.ts'
import { Avatar, FavStar, ProgressRing, Sheet, toast, voiceHue } from './ui.tsx'
import { bubbleNativeState, bubbleSupported, openBubblePermission, setBubble, type BubbleNativeState } from '../lib/bubble.ts'
import { formatBytes } from '../lib/audio.ts'
import { t } from '../lib/i18n.ts'
import { clipPlayer, playClip, stopClipPlayer } from '../player/clip.ts'
import { pause as pauseListen } from '../player/listen.ts'
import previewList from '../lib/previews.json'

const PREVIEWS = new Set<string>(previewList as string[])

/** Small play button beside a voice's name in the picker: hear it before choosing. */
function PreviewBtn({ v, tab }: { v: Voice; tab: number }) {
  const cp = useStore(clipPlayer)
  if (!PREVIEWS.has(v.id)) return null
  const key = `preview:${v.id}`
  const on = cp.key === key && cp.playing
  return (
    <button className={`pick-play ${on ? 'on' : ''}`} tabIndex={tab} aria-label={on ? t('Stop {name} sample', { name: v.name }) : t('Hear {name}', { name: v.name })}
      onClick={(e) => { e.stopPropagation(); if (on) { stopClipPlayer(); return } if (listen.get().playing) pauseListen(); void playClip(key, `${import.meta.env.BASE_URL}previews/${v.id}.mp3`, { title: t('{name} — sample', { name: v.name }) }) }}>
      {on ? <Pause size={11} fill="currentColor" /> : <Play size={11} fill="currentColor" style={{ marginLeft: 1 }} />}
    </button>
  )
}

const ITEMS: { route: Route; label: string; Icon: typeof Play }[] = [
  { route: 'listen', label: 'Listen', Icon: AudioLines },
  { route: 'voices', label: 'Voices', Icon: Mic2 },
  { route: 'create', label: 'Create', Icon: Sparkles },
  { route: 'library', label: 'Library', Icon: Library },
  { route: 'settings', label: 'Settings', Icon: Settings2 },
]

export function BrandMark({ size = 30 }: { size?: number }) {
  return <img className="brand-mark" src={`${import.meta.env.BASE_URL}icon-192.png`} width={size} height={size} alt="" />
}

/** The λ itself is the bubble's switch (Oscar: the Settings card buries it —
 *  one tap on the mark floats Logos and the listening continues through the
 *  bubble; a gold dot on the mark says the bubble is out). In a plain browser
 *  the mark stays a mark. */
export function BubbleMark({ size = 30 }: { size?: number }) {
  const st = useStore(settings)
  const [native, setNative] = useState<BubbleNativeState | null>(null)
  const supported = bubbleSupported()
  useEffect(() => {
    if (!supported) return
    const tick = () => {
      const n = bubbleNativeState()
      setNative((p) => (JSON.stringify(p) === JSON.stringify(n) ? p : n))
    }
    tick()
    const iv = setInterval(tick, 2500)
    return () => clearInterval(iv)
  }, [supported])
  if (!supported) return <BrandMark size={size} />
  const on = native ? native.running : st.bubbleOn
  return (
    <button
      type="button"
      className={`brand-mark-btn ${on ? 'on' : ''}`}
      aria-pressed={on}
      title={on ? t('The bubble is floating — tap to bring it in') : t('Float Logos — tap to let the bubble out')}
      onClick={() => {
        if (!on && native && !native.permission) { openBubblePermission(); toast(t('Allow Logos to display over other apps, then tap the λ again')); return }
        setBubble(!on)
        toast(on ? t('Bubble in') : t('Bubble out — keep listening anywhere'))
      }}
    >
      <BrandMark size={size} />
      {on && <span className="bm-dot" aria-hidden="true" />}
    </button>
  )
}

export function NavItems() {
  const route = useRoute()
  return (
    <>
      {ITEMS.map(({ route: r, label, Icon }) => (
        <a key={r} href={`#/${r}`} className={`nav-item ${route === r || (route === 'book' && r === 'library') ? 'active' : ''}`} aria-current={route === r ? 'page' : undefined}>
          <span className="nav-ico"><Icon size={22} strokeWidth={route === r ? 2.2 : 1.8} /></span>
          <span>{t(label)}</span>
        </a>
      ))}
    </>
  )
}

export function BottomNav() {
  return <nav className="nav" aria-label={t('Main')}><NavItems /></nav>
}

export function SideRail() {
  return (
    <nav className="rail" aria-label={t('Main')}>
      <div className="brand"><BubbleMark size={42} /><a className="brand-name-link" href="#/listen" aria-label={t('Logos home')}><span className="brand-name">Logos</span></a></div>
      <div className="rail-status"><StatusPill compact /></div>
      <NavItems />
    </nav>
  )
}

export function StatusPill({ compact }: { compact?: boolean }) {
  const e = useStore(engine)
  if (e.status === 'ready') {
    return (
      <button className="status-pill ready" onClick={() => navigate('settings')} title={t('Neural voice ready')}>
        <span className="led" />{compact ? t('Ready') : t('Neural · Ready')}
      </button>
    )
  }
  if (e.status === 'loading' && e.phase === 'warm') {
    // The voice is on this phone; it's only being loaded into memory, which
    // happens quietly each time the app opens. Play works right away (it waits
    // a moment for the first sentence), so don't make it look unready.
    return (
      <button className="status-pill ready warming" onClick={() => navigate('settings')} title={t('Voice on this device · loading into memory')}>
        <span className="led" />{compact ? t('Ready') : t('Neural · Ready')}
      </button>
    )
  }
  if (e.status === 'loading') {
    return (
      <button className="status-pill" onClick={() => navigate('settings')} title={t('Downloading neural voice')}>
        <ProgressRing value={e.progress} />
        <span className="mono">{e.total ? `${Math.round(e.progress * 100)}%` : t('Starting')}</span>
      </button>
    )
  }
  if (e.status === 'error') {
    return <button className="status-pill" style={{ color: 'var(--danger)' }} onClick={() => navigate('settings')}>{t('Engine error')}</button>
  }
  return (
    <button className="status-pill" onClick={() => { void ensureModel().catch(() => {}) }} title={t('Download the neural voice (~{n} MB)', { n: e.kind === 'phonon' ? PHONON_SIZE_MB : POCKET_SIZE_MB })}>
      <Download size={16} style={{ marginLeft: 4 }} />{compact ? t('Voice') : t('Neural voice')}
    </button>
  )
}

export function MiniPlayer() {
  const s = useStore(listen)
  const route = useRoute()
  if (!s.active || route === 'listen' || route === 'book' || (!s.playing && s.current === 0 && !s.mode)) return null
  // The player, only (Oscar, 2026-11-10): no sentence text in the mini
  // bar — the words live in Listen; while he moves through the other
  // sections the bar is a finished strip of transport: prev, the gold
  // toggle, next, and its progress hairline. Tapping the bar's own
  // body (not a key) still opens Listen.
  return (
    <div className="mini" role="region" aria-label={t('Now playing')} onClick={(e) => { if (e.target === e.currentTarget) navigate('listen') }}>
      <button className="icon-btn" onClick={prev} aria-label={t('Previous sentence')}><Rewind size={20} /></button>
      <button className="mini-play" onClick={toggle} aria-label={s.playing ? t('Pause') : t('Play')}>
        {s.buffering ? <Loader2 size={20} className="spin" /> : s.playing ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" style={{ marginLeft: 2 }} />}
      </button>
      <button className="icon-btn" onClick={next} aria-label={t('Next sentence')}><FastForward size={20} /></button>
      <span className="mini-prog" style={{ width: `${((s.current + (s.playing ? 0.5 : 0)) / Math.max(1, s.segments.length)) * 100}%` }} />
    </div>
  )
}

type PickGroup = { key: string; title: string; sub: string; list: Voice[] }

/** Picker sections: Favorites, Pocket, then one per accent. */
function pickerGroups(favorites: string[], lang?: Lang | 'auto'): PickGroup[] {
  const want = (v: Voice) => !lang || lang === 'auto' || v.lang === lang
  const ph = (l: Lang, a: string) => VOICES.filter((v) => v.engine === 'phonon' && v.lang === l && v.accent === a && want(v))
    .sort((x, y) => (x.gender === y.gender ? x.name.localeCompare(y.name) : x.gender === 'Female' ? -1 : 1))
  const groups: PickGroup[] = [
    { key: 'fav', title: 'Favorites', sub: 'Your starred voices', list: favoriteVoices(favorites).filter(want) },
    { key: 'pocket', title: 'Pocket', sub: 'Classic engine', list: VOICES.filter((v) => v.engine === 'pocket' && want(v)) },
    { key: 'kokoro', title: 'Kokoro', sub: 'Full model', list: VOICES.filter((v) => v.engine === 'kokoro' && want(v)) },
    { key: 'es-ES', title: 'Spanish', sub: 'Spain', list: ph('es', 'ES') },
    { key: 'es-MX', title: 'Spanish', sub: 'Mexico', list: ph('es', 'MX') },
    { key: 'en-US', title: 'English', sub: 'American', list: ph('en', 'US') },
    { key: 'en-UK', title: 'English', sub: 'British', list: ph('en', 'UK') },
  ]
  return groups.filter((g) => g.list.length > 0)
}

/** Voice picker sheet: collapsible sections, one open at a time. */
export function VoicePicker({ open, onClose, value, onPick, lang }: { open: boolean; onClose: () => void; value: string | null; onPick: (id: string | null) => void; lang?: Lang | 'auto' }) {
  const st = useStore(settings)
  const groups = pickerGroups(st.favorites, lang)
  // Oscar wants every section folded when the picker opens; "Selected · name" shows where the voice is.
  const initial = (): string | null => null
  const [openKey, setOpenKey] = useState<string | null>(initial)
  useEffect(() => { if (open) setOpenKey(initial()); else stopClipPlayer() }, [open]) // eslint-disable-line react-hooks/exhaustive-deps
  const toggleGroup = (key: string, el: HTMLElement) => {
    const next = openKey === key ? null : key
    setOpenKey(next)
    if (next) setTimeout(() => el.scrollIntoView({ block: 'start', behavior: 'smooth' }), 420)
  }
  return (
    <Sheet open={open} onClose={onClose} title={t('Choose a voice')}>
      <button className={`pick ${value === null ? 'on' : ''}`} onClick={() => { onPick(null); onClose() }}>
        <div className="avatar" style={{ background: 'linear-gradient(135deg, var(--accent), var(--violet))', width: 42, height: 42, borderRadius: 13, fontSize: 20 }}>A</div>
        <div className="grow">
          <div className="voice-name">{t('Automatic')}</div>
          <div className="voice-tag">{t('Your default voice for each language — {en} for English, {es} for Spanish', { en: voiceName(st.defaultVoice.en), es: voiceName(st.defaultVoice.es) })}</div>
        </div>
        {value === null && <Check size={20} color="var(--accent)" />}
      </button>
      <div className="vgroups">
        {groups.map((g) => {
          const isOpen = openKey === g.key
          const chosen = value ? g.list.find((v) => v.id === value) : undefined
          return (
            <section key={g.key} className={`vgroup ${isOpen ? 'open' : ''}`} data-group={g.key}>
              <button className="vgroup-head" aria-expanded={isOpen} onClick={(e) => toggleGroup(g.key, e.currentTarget.parentElement as HTMLElement)}>
                <span className="vgroup-stack" aria-hidden>
                  {g.list.slice(0, 3).map((v) => { const [a, b] = voiceHue(v.id); return <i key={v.id} style={{ background: `linear-gradient(135deg, hsl(${a} 62% 56%), hsl(${b} 58% 32%))` }} /> })}
                </span>
                <span className="vgroup-text">
                  <span className="vgroup-title">{g.key === 'fav' && <Star size={14} fill="var(--accent)" color="var(--accent)" />}{t(g.title)}{g.key !== 'fav' && g.key !== 'pocket' && g.key !== 'kokoro' && <span className="vgroup-sub">{t(g.sub)}</span>}</span>
                  <span className="vgroup-meta">{chosen && !isOpen ? <>{t('Selected · ')}<b>{chosen.name}</b></> : `${g.list.length === 1 ? t('{n} voice', { n: 1 }) : t('{n} voices', { n: g.list.length })}${g.key === 'pocket' ? t(' · Classic engine') : g.key === 'kokoro' ? t(' · Full model') : ''}`}</span>
                </span>
                <ChevronDown size={20} className="vgroup-chev" />
              </button>
              <div className="vgroup-body"><div>
                {g.list.map((v) => {
                  const fav = st.favorites.includes(v.id)
                  const pick = () => { onPick(v.id); onClose() }
                  return (
                    <div key={v.id} className={`pick ${value === v.id ? 'on' : ''}`} role="button" tabIndex={isOpen ? 0 : -1} onClick={pick} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick() } }}>
                      <Avatar voice={v} />
                      <div className="grow">
                        <div className="voice-name"><span className="vn">{v.name}</span><PreviewBtn v={v} tab={isOpen ? 0 : -1} />{(g.key === 'fav' || g.key === 'pocket' || g.key === 'kokoro') && <span className="badge">{v.accent}</span>}{g.key === 'fav' && v.engine === 'pocket' && <span className="badge">Pocket</span>}{g.key === 'fav' && v.engine === 'kokoro' && <span className="badge">Kokoro</span>}</div>
                        <div className="voice-tag">{t(v.tagline)}</div>
                      </div>
                      {value === v.id && <Check size={20} color="var(--accent)" />}
                      <button className={`pick-star ${fav ? 'on' : ''}`} tabIndex={isOpen ? 0 : -1} aria-pressed={fav} aria-label={fav ? t('Remove {name} from favorites', { name: v.name }) : t('Add {name} to favorites', { name: v.name })}
                        onClick={(e) => { e.stopPropagation(); toggleFavorite(v.id) }}>
                        <FavStar id={v.id} on={fav} size={19} />
                      </button>
                    </div>
                  )
                })}
              </div></div>
            </section>
          )
        })}
      </div>
    </Sheet>
  )
}

function voiceName(id: string) {
  return VOICES.find((v) => v.id === id)?.name ?? id
}

export function EngineNote() {
  const e = useStore(engine)
  if (e.status !== 'loading' || e.phase === 'warm') return null
  return (
    <div className="engine-note">
      <Loader2 size={16} className="spin" color="var(--accent)" />
      {e.phase === 'download'
        ? <><span>{t('Downloading neural voice')}{e.total ? t(' · {a} of {b}', { a: formatBytes(e.loaded), b: formatBytes(e.total) }) : '…'}</span>
            <span className="bar"><i style={{ width: `${Math.round(e.progress * 100)}%` }} /></span></>
        : <span>{t('Getting the neural voice ready…')}</span>}
    </div>
  )
}
