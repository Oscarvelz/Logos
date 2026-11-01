import { useState } from 'react'
import { Check, Loader2, Pause, Play, Star } from 'lucide-react'
import { useStore } from '../lib/store.ts'
import { settings, toggleFavorite } from '../lib/settings.ts'
import { VOICES, PREVIEW_TEXT, ACCENT_LABEL, type Voice } from '../lib/voices.ts'
import { clipPlayer, playClip } from '../player/clip.ts'
import { engine, synthesize } from '../engine/engine.ts'
import { encodeWav, trimSilence } from '../lib/audio.ts'
import { refreshVoices } from '../player/listen.ts'
import { Avatar, toast } from '../components/ui.tsx'
import previews from '../lib/previews.json'

type Filter = 'all' | 'fav' | 'en' | 'es' | 'pocket'
const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All voices' },
  { value: 'fav', label: 'Favorites' },
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Español' },
  { value: 'pocket', label: 'Pocket' },
]

const HAS_PREVIEW = new Set<string>(previews as string[])
const livePreviews = new Map<string, Blob>()

export function VoicesPage() {
  const st = useStore(settings)
  const [filter, setFilter] = useState<Filter>('all')
  const rank = (id: string) => { const i = st.favorites.indexOf(id); return i < 0 ? Infinity : i }
  const list = VOICES
    .filter((v) => filter === 'all' || (filter === 'fav' ? st.favorites.includes(v.id) : filter === 'pocket' ? v.engine === 'pocket' : v.lang === filter))
    .map((v, i) => ({ v, i }))
    .sort((a, b) => rank(a.v.id) - rank(b.v.id) || a.i - b.i)
    .map((x) => x.v)
  return (
    <div className="page wide">
      <div className="page-head">
        <div>
          <h1 className="page-title">Voices</h1>
          <p className="page-sub">{VOICES.length} natural voices that run right on your phone. Star your favorites, set a default per language.</p>
        </div>
      </div>
      <div className="filter-row" role="tablist">
        {FILTERS.map((f) => (
          <button key={f.value} role="tab" aria-selected={filter === f.value} className={`chip ${filter === f.value ? 'accent' : ''}`} onClick={() => setFilter(f.value)}>{f.label}</button>
        ))}
      </div>
      {list.length === 0 && <div className="card empty"><h3>No favorites yet</h3><p>Tap the star on any voice.</p></div>}
      <div className="voice-grid">
        {list.map((v) => <VoiceCard key={v.id} voice={v} />)}
      </div>
    </div>
  )
}

function VoiceCard({ voice: v }: { voice: Voice }) {
  const st = useStore(settings)
  const cp = useStore(clipPlayer)
  const [loading, setLoading] = useState(false)
  const key = `preview:${v.id}`
  const playing = cp.key === key && cp.playing
  const isDefault = st.defaultVoice[v.lang] === v.id
  const fav = st.favorites.includes(v.id)

  const preview = async () => {
    if (cp.key === key) { void playClip(key, ''); return }
    if (HAS_PREVIEW.has(v.id)) { void playClip(key, `${import.meta.env.BASE_URL}previews/${v.id}.mp3`, { title: `${v.name} — preview` }); return }
    let blob = livePreviews.get(v.id)
    if (!blob) {
      setLoading(true)
      try {
        if (engine.get().status !== 'ready') toast('Loading the neural voice for previews…')
        const res = await synthesize(PREVIEW_TEXT[v.lang], v.id, 1, { priority: 3000 })
        blob = encodeWav(trimSilence(res.samples, res.sampleRate), res.sampleRate)
        livePreviews.set(v.id, blob)
      } catch (err) {
        toast(`Preview failed: ${(err as Error).message}`)
        return
      } finally { setLoading(false) }
    }
    void playClip(key, blob, { title: `${v.name} — preview` })
  }

  return (
    <div className={`voice-card ${isDefault ? 'is-default' : ''}`}>
      {isDefault && <span className="default-flag">Default · {v.lang === 'en' ? 'English' : 'Español'}</span>}
      <Avatar voice={v} playing={playing} />
      <div className="grow" style={{ minWidth: 0 }}>
        <div className="voice-name">{v.name} <span className="badge" title={ACCENT_LABEL[v.accent]}>{v.accent}</span>{v.engine === 'pocket' && <span className="badge">Pocket</span>}</div>
        <div className="voice-tag">{v.tagline}</div>
        {!isDefault && (
          <button className="btn sm ghost" style={{ height: 32, padding: '0 8px', marginLeft: -8, marginTop: 2, fontSize: 13, color: 'var(--text-2)' }}
            onClick={() => { settings.set((s) => ({ defaultVoice: { ...s.defaultVoice, [v.lang]: v.id } })); refreshVoices(); toast(`${v.name} is now your ${v.lang === 'en' ? 'English' : 'Spanish'} default`) }}>
            <Check size={14} /> Make default
          </button>
        )}
      </div>
      <div className="voice-actions">
        <button className={`icon-btn ${fav ? 'on' : ''}`} onClick={() => toggleFavorite(v.id)} aria-label={fav ? 'Remove favorite' : 'Add favorite'} aria-pressed={fav}>
          <Star size={21} fill={fav ? 'currentColor' : 'none'} />
        </button>
        <button className="icon-btn filled" onClick={preview} aria-label={playing ? 'Pause preview' : `Preview ${v.name}`}>
          {loading ? <Loader2 size={20} className="spin" /> : playing ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" style={{ marginLeft: 2 }} />}
        </button>
      </div>
    </div>
  )
}
