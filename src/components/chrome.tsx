import { AudioLines, Library, Mic2, Pause, Play, Settings2, SkipForward, Sparkles, Star, Check, Download, Loader2, ChevronDown } from 'lucide-react'
import { navigate, useRoute, type Route } from '../lib/router.ts'
import { useStore } from '../lib/store.ts'
import { engine, ensureModel, POCKET_SIZE_MB, PHONON_SIZE_MB } from '../engine/engine.ts'
import { listen, toggle, next } from '../player/listen.ts'
import { settings, toggleFavorite } from '../lib/settings.ts'
import { useEffect, useState } from 'react'
import { VOICES, favoriteVoices, type Lang, type Voice } from '../lib/voices.ts'
import { Avatar, FavStar, ProgressRing, Sheet, voiceHue } from './ui.tsx'
import { formatBytes } from '../lib/audio.ts'
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
    <button className={`pick-play ${on ? 'on' : ''}`} tabIndex={tab} aria-label={on ? `Stop ${v.name} sample` : `Hear ${v.name}`}
      onClick={(e) => { e.stopPropagation(); if (on) { stopClipPlayer(); return } if (listen.get().playing) pauseListen(); void playClip(key, `${import.meta.env.BASE_URL}previews/${v.id}.mp3`, { title: `${v.name} — sample` }) }}>
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

export function NavItems() {
  const route = useRoute()
  return (
    <>
      {ITEMS.map(({ route: r, label, Icon }) => (
        <a key={r} href={`#/${r}`} className={`nav-item ${route === r || (route === 'book' && r === 'library') ? 'active' : ''}`} aria-current={route === r ? 'page' : undefined}>
          <span className="nav-ico"><Icon size={22} strokeWidth={route === r ? 2.2 : 1.8} /></span>
          <span>{label}</span>
        </a>
      ))}
    </>
  )
}

export function BottomNav() {
  return <nav className="nav" aria-label="Main"><NavItems /></nav>
}

export function SideRail() {
  return (
    <nav className="rail" aria-label="Main">
      <a className="brand" href="#/listen"><BrandMark size={42} /><span className="brand-name">Logos</span></a>
      <NavItems />
      <div className="rail-foot"><StatusPill compact /></div>
    </nav>
  )
}

export function StatusPill({ compact }: { compact?: boolean }) {
  const e = useStore(engine)
  if (e.status === 'ready') {
    return (
      <button className="status-pill ready" onClick={() => navigate('settings')} title="Neural voice ready">
        <span className="led" />{compact ? 'Ready' : 'Neural · Ready'}
      </button>
    )
  }
  if (e.status === 'loading' && e.phase === 'warm') {
    // The voice is on this phone; it's only being loaded into memory, which
    // happens quietly each time the app opens. Play works right away (it waits
    // a moment for the first sentence), so don't make it look unready.
    return (
      <button className="status-pill ready warming" onClick={() => navigate('settings')} title="Voice on this device · loading into memory">
        <span className="led" />{compact ? 'Ready' : 'Neural · Ready'}
      </button>
    )
  }
  if (e.status === 'loading') {
    return (
      <button className="status-pill" onClick={() => navigate('settings')} title="Downloading neural voice">
        <ProgressRing value={e.progress} />
        <span className="mono">{e.total ? `${Math.round(e.progress * 100)}%` : 'Starting'}</span>
      </button>
    )
  }
  if (e.status === 'error') {
    return <button className="status-pill" style={{ color: 'var(--danger)' }} onClick={() => navigate('settings')}>Engine error</button>
  }
  return (
    <button className="status-pill" onClick={() => { void ensureModel().catch(() => {}) }} title={`Download the neural voice (~${e.kind === 'phonon' ? PHONON_SIZE_MB : POCKET_SIZE_MB} MB)`}>
      <Download size={16} style={{ marginLeft: 4 }} />{compact ? 'Voice' : 'Neural voice'}
    </button>
  )
}

export function MiniPlayer() {
  const s = useStore(listen)
  const route = useRoute()
  if (!s.active || route === 'listen' || route === 'book' || (!s.playing && s.current === 0 && !s.mode)) return null
  const seg = s.segments[s.current]
  return (
    <div className="mini" role="region" aria-label="Now playing">
      <button className="grow" style={{ textAlign: 'left', minWidth: 0 }} onClick={() => navigate('listen')}>
        <div className="mini-text">{seg?.text}</div>
        <div className="mini-sub">{s.buffering ? 'Preparing…' : `Sentence ${s.current + 1} of ${s.segments.length}`}</div>
      </button>
      <button className="mini-play" onClick={toggle} aria-label={s.playing ? 'Pause' : 'Play'}>
        {s.buffering ? <Loader2 size={20} className="spin" /> : s.playing ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" style={{ marginLeft: 2 }} />}
      </button>
      <button className="icon-btn" onClick={next} aria-label="Next sentence"><SkipForward size={20} /></button>
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
    <Sheet open={open} onClose={onClose} title="Choose a voice">
      <button className={`pick ${value === null ? 'on' : ''}`} onClick={() => { onPick(null); onClose() }}>
        <div className="avatar" style={{ background: 'linear-gradient(135deg, var(--accent), var(--violet))', width: 42, height: 42, borderRadius: 13, fontSize: 20 }}>A</div>
        <div className="grow">
          <div className="voice-name">Automatic</div>
          <div className="voice-tag">Your default voice for each language — {voiceName(st.defaultVoice.en)} for English, {voiceName(st.defaultVoice.es)} for Spanish</div>
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
                  <span className="vgroup-title">{g.key === 'fav' && <Star size={14} fill="var(--accent)" color="var(--accent)" />}{g.title}{g.key !== 'fav' && g.key !== 'pocket' && <span className="vgroup-sub">{g.sub}</span>}</span>
                  <span className="vgroup-meta">{chosen && !isOpen ? <>Selected · <b>{chosen.name}</b></> : `${g.list.length} voice${g.list.length === 1 ? '' : 's'}${g.key === 'pocket' ? ' · Classic engine' : ''}`}</span>
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
                        <div className="voice-name"><span className="vn">{v.name}</span><PreviewBtn v={v} tab={isOpen ? 0 : -1} />{(g.key === 'fav' || g.key === 'pocket') && <span className="badge">{v.accent}</span>}{g.key === 'fav' && v.engine === 'pocket' && <span className="badge">Pocket</span>}</div>
                        <div className="voice-tag">{v.tagline}</div>
                      </div>
                      {value === v.id && <Check size={20} color="var(--accent)" />}
                      <button className={`pick-star ${fav ? 'on' : ''}`} tabIndex={isOpen ? 0 : -1} aria-pressed={fav} aria-label={fav ? `Remove ${v.name} from favorites` : `Add ${v.name} to favorites`}
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
        ? <><span>Downloading neural voice{e.total ? ` · ${formatBytes(e.loaded)} of ${formatBytes(e.total)}` : '…'}</span>
            <span className="bar"><i style={{ width: `${Math.round(e.progress * 100)}%` }} /></span></>
        : <span>Getting the neural voice ready…</span>}
    </div>
  )
}
