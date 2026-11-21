import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown, Loader2, Pause, Play, Search, Star } from 'lucide-react'
import { useStore } from '../lib/store.ts'
import { settings, toggleFavorite } from '../lib/settings.ts'
import { VOICES, PREVIEW_TEXT, ACCENT_LABEL, favoriteIds, voiceCardTruth, VoiceSearchGate, type Voice } from '../lib/voices.ts'
import { clipPlayer, playClip } from '../player/clip.ts'
import { engine, engineCachedFor, synthesize } from '../engine/engine.ts'
import { encodeWav, trimSilence, applyGain, levelGain } from '../lib/audio.ts'
import { speakable } from '../lib/text.ts'
import { refreshVoices } from '../player/listen.ts'
import { FavStar, Avatar, toast, voiceHue } from '../components/ui.tsx'
import { pickerGroups, type PickGroup } from '../components/chrome.tsx'
import { t } from '../lib/i18n.ts'

const livePreviews = new Map<string, Blob>()

export function VoicesPage() {
  const st = useStore(settings)
  // 1.4.200: one section open at a time, all folded at first — the
  // picker's own accordion law, Oscar's word.
  const [openKey, setOpenKey] = useState<string | null>(null)
  // M-47: search runs through the shared gate — debounced, and a stale
  // earlier result can never land over a newer query.
  const [query, setQuery] = useState('')
  const [found, setFound] = useState<Voice[] | null>(null)
  const gate = useRef(new VoiceSearchGate())
  useEffect(() => {
    if (!query.trim()) { setFound(null); return }
    const g = gate.current
    g.schedule(query, 150, (r) => setFound(r))
    return () => g.cancel()
  }, [query])
  // M-44: the favorites list and every star read the ONE post-gate truth
  // (favoriteVoices/favoriteIds), never the raw stored ids — pickerGroups
  // builds its Favorites section from that same favoriteVoices.
  // 1.4.199: the page wears the SAME organization as the Listen voice
  // picker (Oscar's word: the picker looks better organized and
  // distributed) — one grouping for the whole app, built by the
  // picker's own pickerGroups: Favorites, Pocket, then one section
  // per accent.
  // 1.4.200 (Oscar's word, from his phone): the horizontal filter
  // chips at the top are GONE — the sections themselves do that work
  // now — and each section retraces or opens with a tap, the
  // picker's accordion exactly: all folded when the page opens, one
  // open at a time, the head's meta line saying what waits inside
  // (the count, or the default's name in gold). An empty Favorites
  // keeps its section, whose body teaches the star. Search keeps
  // its flat grid, like the picker's search state.
  const searching = found != null
  let groups: PickGroup[] = pickerGroups(st.favorites, undefined, null)
  if (favoriteIds(st.favorites).size === 0) groups = [{ key: 'fav', title: 'Favorites', sub: 'Your starred voices', list: [] }, ...groups]
  const toggleGroup = (key: string, el: HTMLElement) => {
    const next = openKey === key ? null : key
    setOpenKey(next)
    if (next) setTimeout(() => el.scrollIntoView({ block: 'start', behavior: 'smooth' }), 420)
  }
  return (
    <div className="page wide">
      <div className="page-head" data-present="voices-head">
        <div>
          <h1 className="page-title">{t('Voices')}</h1>
          <p className="page-sub">{t('{n} natural voices that run right on your phone. Star your favorites, set a default per language.', { n: VOICES.length })}</p>
        </div>
      </div>
      <div className="filter-row" style={{ alignItems: 'center' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <Search size={16} aria-hidden />
          <input data-present="voices-search" value={query} onChange={(ev) => setQuery(ev.target.value)} placeholder={t('Search voices')} aria-label={t('Search voices')}
            style={{ height: 36, borderRadius: 999, border: '1px solid var(--line)', background: 'var(--surface)', padding: '0 12px', outline: 'none' }} />
        </span>
      </div>
      {searching ? (
        <div data-present="voices-grid">
          {found.length === 0
            ? <div className="card empty"><h3>{t('No voices found')}</h3><p>{t('Try another name.')}</p></div>
            : <div className="voice-grid">{found.map((v) => <VoiceCard key={v.id} voice={v} />)}</div>}
        </div>
      ) : (
        <div className="vgroups" data-present="voices-grid">
          {groups.map((g) => {
            const isOpen = openKey === g.key
            const lang = g.list[0]?.lang
            const def = !isOpen && lang ? g.list.find((v) => v.id === st.defaultVoice[lang]) : undefined
            return (
              <section key={g.key} className={`vgroup ${isOpen ? 'open' : ''}`} data-group={g.key}>
                <button className="vgroup-head" data-present="voices-section-head" data-group={g.key} aria-expanded={isOpen} onClick={(e) => toggleGroup(g.key, e.currentTarget.parentElement as HTMLElement)}>
                  <span className="vgroup-stack" aria-hidden>
                    {g.list.slice(0, 3).map((v) => { const [a, b] = voiceHue(v.id); return <i key={v.id} style={{ background: `linear-gradient(135deg, hsl(${a} 62% 56%), hsl(${b} 58% 32%))` }} /> })}
                  </span>
                  <span className="vgroup-text">
                    <span className="vgroup-title">{g.key === 'fav' && <Star size={14} fill="var(--accent)" color="var(--accent)" />}{t(g.title)}{g.key !== 'fav' && g.key !== 'pocket' && <span className="vgroup-sub">{t(g.sub)}</span>}</span>
                    <span className="vgroup-meta">{def ? <>{t('Default · ')}<b>{def.name}</b></> : g.key === 'fav' ? t('Your starred voices') : <>{g.list.length === 1 ? t('{n} voice', { n: 1 }) : t('{n} voices', { n: g.list.length })}{g.key === 'pocket' ? t(' · Classic engine') : ''}</>}</span>
                  </span>
                  <ChevronDown size={20} className="vgroup-chev" />
                </button>
                <div className="vgroup-body"><div>
                  {g.key === 'fav' && g.list.length === 0
                    ? <div className="card empty" data-present="voices-empty-fav"><h3>{t('No favorites yet')}</h3><p>{t('Tap the star on any voice.')}</p></div>
                    : <div className="voice-grid">{g.list.map((v) => <VoiceCard key={v.id} voice={v} />)}</div>}
                </div></div>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}

function VoiceCard({ voice: v }: { voice: Voice }) {
  const st = useStore(settings)
  const cp = useStore(clipPlayer)
  const e = useStore(engine)
  const [loading, setLoading] = useState(false)
  const key = `preview:${v.id}`
  const playing = cp.key === key && cp.playing
  // What this card may claim (M-43's resolution, R2-T7-4's words):
  // the stored default wears "Default", a standing Listen override
  // wears "Now reading" on its own card, and Make default is offered
  // only where the card is not already the stored default — so the
  // flag, the button and the toast can no longer contradict each
  // other over a pick made in Listen. The decision lives in
  // voiceCardTruth (voices.ts); resolvedVoiceId still decides what
  // actually reads.
  const claim = voiceCardTruth(st, v)
  // M-44: the star reads the same post-gate favorites truth as the list.
  const fav = favoriteIds(st.favorites).has(v.id)
  // M-49: "on this device" is claimed only from the engine store's
  // cached flag WHEN that flag describes THIS voice's engine — since
  // the Wave 2 cure the flag is per-engine (cachedOf(kind) in
  // engine.ts), so a claim for the other engine would be a stale-shape
  // read. No claim is made for a voice whose engine isn't the one the
  // store is currently reporting.
  const onDevice = e.kind === v.engine && engineCachedFor(v.engine, v.lang)

  const preview = async () => {
    if (cp.key === key) { void playClip(key, ''); return }
    // T7-04: a preview must prove what it claims. The prerecorded MP3
    // that used to stand here played perfectly with the model deleted,
    // the engine in error, or the voice's file unfetchable — and it
    // was made at fixed speed with fixed text, so it could say nothing
    // about the user's speed or pronunciation dictionary. The preview
    // now renders through the real engine path, exactly as a reading
    // does: the preview line run through speakable() (the dictionary
    // applies), synthesized by this voice at the user's listening
    // speed, levelled like a real render. If the model is not on the
    // device, synthesis takes the same download-or-fail road a first
    // Play takes — it never plays a recording that masks a failure.
    // The cache key carries speed and spoken text, so a speed or
    // dictionary change re-renders instead of replaying a stale take.
    const spoken = speakable(PREVIEW_TEXT[v.lang], v.lang)
    const cacheKey = `${v.id}|${st.listenSpeed}|${spoken}`
    let blob = livePreviews.get(cacheKey)
    if (!blob) {
      setLoading(true)
      try {
        if (engine.get().status !== 'ready') toast(t('Loading the neural voice for previews…'))
        const res = await synthesize(spoken, v.id, st.listenSpeed, { priority: 3000 })
        const trimmed = trimSilence(res.samples, res.sampleRate)
        blob = encodeWav(applyGain(trimmed, levelGain(trimmed)), res.sampleRate)
        livePreviews.set(cacheKey, blob)
      } catch (err) {
        toast(t('Preview failed: {msg}', { msg: (err as Error).message }))
        return
      } finally { setLoading(false) }
    }
    void playClip(key, blob, { title: t('{name} — preview', { name: v.name }) })
  }

  return (
    <div className={`voice-card ${claim.flag ? 'is-default' : ''}`} data-present="voice-card" data-voice-id={v.id}>
      {claim.flag === 'default' && <span className="default-flag">{t('Default · {l}', { l: v.lang === 'en' ? t('English') : 'Español' })}</span>}
      {claim.flag === 'reading' && <span className="default-flag">{t('Now reading · {l}', { l: v.lang === 'en' ? t('English') : 'Español' })}</span>}
      <Avatar voice={v} playing={playing} />
      <div className="grow" style={{ minWidth: 0 }}>
        <div className="voice-name">{v.name}</div>
        <div className="voice-badges"><span className="badge" title={t(ACCENT_LABEL[v.accent])}>{v.accent}</span>{v.engine === 'pocket' && <span className="badge">Pocket</span>}{onDevice && <span className="badge">{t('On this device')}</span>}</div>
        <div className="voice-tag">{t(v.tagline)}</div>
        {claim.makeDefault && (
          <button className="btn sm ghost" data-present="voice-card:make-default" data-voice-id={v.id} style={{ height: 32, padding: '0 8px', marginLeft: -8, marginTop: 2, fontSize: 13, color: 'var(--text-2)' }}
            onClick={() => {
              const ov = claim.toastOverride
              settings.set((s) => ({ defaultVoice: { ...s.defaultVoice, [v.lang]: v.id } }))
              refreshVoices()
              // R2-T7-4: while a Listen pick governs this language, the
              // tap changes the stored default only — the toast names
              // the pick instead of claiming a crown it cannot hand
              // over. With no pick standing, the old words are simply
              // true and are kept.
              toast(ov
                ? t('{name} is your {lang} default — {other} still reads in Listen until you change it there', { name: v.name, lang: v.lang === 'en' ? t('English') : 'Español', other: ov.name })
                : t('{name} is now your {lang} default', { name: v.name, lang: v.lang === 'en' ? t('English') : 'Español' }))
            }}>
            <Check size={14} /> {t('Make default')}
          </button>
        )}
      </div>
      <div className="voice-actions">
        <button className={`icon-btn ${fav ? 'on' : ''}`} data-present="voice-card:star" data-voice-id={v.id} onClick={() => toggleFavorite(v.id)} aria-label={fav ? t('Remove favorite') : t('Add favorite')} aria-pressed={fav}>
          <FavStar id={v.id} on={fav} size={21} />
        </button>
        <button className="icon-btn filled" data-present="voice-card:preview" data-voice-id={v.id} onClick={preview} aria-label={playing ? t('Pause preview') : t('Preview {name}', { name: v.name })}>
          {loading ? <Loader2 size={20} className="spin" /> : playing ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" style={{ marginLeft: 2 }} />}
        </button>
      </div>
    </div>
  )
}
