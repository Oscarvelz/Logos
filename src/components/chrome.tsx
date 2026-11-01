import { AudioLines, Library, Mic2, Pause, Play, Settings2, SkipForward, Sparkles, Star, Check, Download, Loader2 } from 'lucide-react'
import { navigate, useRoute, type Route } from '../lib/router.ts'
import { useStore } from '../lib/store.ts'
import { engine, ensureModel, POCKET_SIZE_MB } from '../engine/engine.ts'
import { listen, toggle, next } from '../player/listen.ts'
import { settings } from '../lib/settings.ts'
import { VOICES, LANG_LABEL, type Lang, type Voice } from '../lib/voices.ts'
import { Avatar, ProgressRing, Sheet } from './ui.tsx'
import { formatBytes } from '../lib/audio.ts'

const ITEMS: { route: Route; label: string; Icon: typeof Play }[] = [
  { route: 'listen', label: 'Listen', Icon: AudioLines },
  { route: 'create', label: 'Create', Icon: Sparkles },
  { route: 'library', label: 'Library', Icon: Library },
  { route: 'voices', label: 'Voices', Icon: Mic2 },
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
        <a key={r} href={`#/${r}`} className={`nav-item ${route === r ? 'active' : ''}`} aria-current={route === r ? 'page' : undefined}>
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
    <button className="status-pill" onClick={() => { void ensureModel().catch(() => {}) }} title={`Download the neural voice (~${POCKET_SIZE_MB} MB)`}>
      <Download size={16} style={{ marginLeft: 4 }} />{compact ? 'Voice' : 'Neural voice'}
    </button>
  )
}

export function MiniPlayer() {
  const s = useStore(listen)
  const route = useRoute()
  if (!s.active || route === 'listen' || (!s.playing && s.current === 0 && !s.mode)) return null
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

/** Voice picker sheet: favourites first, grouped by language. */
export function VoicePicker({ open, onClose, value, onPick, lang }: { open: boolean; onClose: () => void; value: string | null; onPick: (id: string | null) => void; lang?: Lang | 'auto' }) {
  const st = useStore(settings)
  const groups: { title: string; list: Voice[] }[] = []
  const favs = VOICES.filter((v) => st.favorites.includes(v.id) && (!lang || lang === 'auto' || v.lang === lang))
  if (favs.length) groups.push({ title: 'Favorites', list: favs })
  for (const l of ['en', 'es'] as Lang[]) {
    if (lang && lang !== 'auto' && lang !== l) continue
    groups.push({ title: LANG_LABEL[l], list: VOICES.filter((v) => v.lang === l && !st.favorites.includes(v.id)) })
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
      {groups.map((g) => g.list.length > 0 && (
        <div key={g.title}>
          <div className="section-label" style={{ marginTop: 16 }}>{g.title}</div>
          {g.list.map((v) => (
            <button key={v.id} className={`pick ${value === v.id ? 'on' : ''}`} onClick={() => { onPick(v.id); onClose() }}>
              <Avatar voice={v} />
              <div className="grow">
                <div className="voice-name">{v.name} <span className="badge">{v.lang === 'es' ? 'ES' : 'EN'}</span>{st.favorites.includes(v.id) && <Star size={13} fill="var(--accent)" color="var(--accent)" />}</div>
                <div className="voice-tag">{v.tagline}</div>
              </div>
              {value === v.id && <Check size={20} color="var(--accent)" />}
            </button>
          ))}
        </div>
      ))}
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
