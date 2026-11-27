/**
 * LogosScenarioStage — the fiction stage the presentation performs on.
 *
 * A miniature Logos rendered ONLY from the sealed scenario: its
 * drafts, its session, its library, its books, its settings copy.
 * Nothing here reads a real store. (The voice catalogue is the app's
 * own built-in cast — the same for every user, taught as the app's
 * furniture, never as anyone's data.) The surfaces mirror the real
 * app's layout and carry the anchors the registry declares — MINT
 * data-present values, the real class hooks for CLASS anchors, the
 * real attributes for EXISTING ones — so the player's resolver finds
 * exactly one of each; the real shell is unmounted while a module
 * runs.
 *
 * The stage is a working replica: sheets, menus and panels open
 * when the lesson performs their doors (the host's choreography) or
 * the learner taps them in Interactive mode; timed fiction (a
 * render, an import) lands a beat after it starts, as in the real
 * app. Playback visuals are the stage's ephemeral state, seeded
 * from the scenario session whenever an act lands (stageNav.bump).
 */
import { useEffect, useMemo, useState } from 'react'
import { BookDown, Bookmark, Check, ChevronRight, ClipboardPaste, Eraser, Moon, Pause, Play, Search, SkipBack, SkipForward, Star, X } from 'lucide-react'
import { useStore } from './store.ts'
import { VOICES, ACCENT_LABEL, ENGINE_LABEL, type Voice } from './voices.ts'
import { isJustUrl } from './webtext.ts'
import type { Scenario } from './presentation/scenario/index.ts'
import { stageNav, stageUi, stageFields, stageVoices, stagePrime, stageBookTemp, stageActiveClip, stageToggleFav, stageSetDefaultVoice, stageGo, stageBump, stagePatch, trayForAnchor, type StageSurface, type StageUiState } from './presentation-host.tsx'
import './presentation-stage.css'

export const sentencesOf = (text: string): string[] =>
  text
    .split(/\n+/)
    .flatMap((p) => p.split(/(?<=[.!?…])\s+/))
    .map((s) => s.trim())
    .filter(Boolean)

export function LogosScenarioStage({ scenario }: { scenario: Scenario }) {
  const nav = useStore(stageNav)
  const ui = useStore(stageUi)
  const lambdaOn = scenario.stage.lambdaOn()
  const session = scenario.stage.session()
  return (
    <div className="pstage" data-surface={nav.surface}>
      <div className="pstage-top">
        <span className="pstage-brand" data-present="shell-brand-home">λ&nbsp; Logos</span>
        <span className="pstage-grow" />
        <span className="pstage-statuspill" data-present="shell-status-pill">{session?.playing ? 'Playing' : 'Ready'}</span>
        {/* The learner's OWN λ tap (the T6-11 cure): in Interactive mode
            the runner's userAct() only advances — performed acts belong
            to the port (Automatic / «Show me», where the presented λ
            demonstration flips the real switch, Wave 1) or to the stage
            control's own hand, as every other stage button already did
            (stars, nav, doors). This button had no hand at all, so the
            learner's tap flipped nothing and the next beat announced a
            gold dot that was never lit. Its tap now does exactly what
            the port's presented tap does — scenario.stage.setLambda,
            through the sandbox's LambdaPort discipline to the real
            switch — and the stage repaints with the dot the following
            beat describes. */}
        <button type="button" className={lambdaOn ? 'pstage-lambda on' : 'pstage-lambda'} data-present="bubble-lambda" aria-label="Float the bubble"
          onClick={() => { scenario.stage.setLambda(!lambdaOn); stageBump() }}>
          λ{lambdaOn ? <i className="pstage-dot" /> : null}
        </button>
      </div>
      <div className="pstage-body">
        {/* Every surface stays mounted; the stage stands on one at a
            time. Resolution is scoped to the standing surface by the
            host's stage root, so a switch never waits on a commit. */}
        <div data-stage-surface="listen" hidden={nav.surface !== 'listen'}><StageListen scenario={scenario} /></div>
        <div data-stage-surface="bubble" hidden={nav.surface !== 'bubble'}><StageBubble scenario={scenario} /></div>
        <div data-stage-surface="library" hidden={nav.surface !== 'library'}><StageLibrary scenario={scenario} /></div>
        <div data-stage-surface="voices" hidden={nav.surface !== 'voices'}><StageVoices scenario={scenario} /></div>
        <div data-stage-surface="create" hidden={nav.surface !== 'create'}><StageCreate scenario={scenario} /></div>
        <div data-stage-surface="settings" hidden={nav.surface !== 'settings'}><StageSettings scenario={scenario} /></div>
        <div data-stage-surface="book" hidden={nav.surface !== 'book'}><StageBook scenario={scenario} /></div>
      </div>

      {ui.sheet === 'voice' && <VoicePicker scenario={scenario} />}
      {ui.sheet === 'keep' && (
        <div className="pstage-sheet pstage-overlay" data-present="listen-keep-sheet">
          <div className="pstage-sheet-h">Keep this reading</div>
          <button type="button" className="pstage-sheet-btn" data-present="listen-keep-audio">Make the audio</button>
          <button type="button" className="pstage-sheet-btn" data-present="listen-keep-later">Listen later</button>
          {ui.keepBusy
            ? <p className="pstage-note" data-present="listen-keep-note">Making the audio — it will wait in the Library, under Saved.</p>
            : <p className="pstage-note" data-present="listen-keep-note">Kept readings wait in the Library, under Saved.</p>}
        </div>
      )}
      {ui.sheet === 'sleep' && (
        <div className="pstage-sheet pstage-overlay" data-present="listen-sleep-sheet">
          <div className="pstage-sheet-h">Sleep timer</div>
          <div className="pstage-chips">{['Off', '10 min', '20 min', 'End of text'].map((s) => <span key={s} className="pstage-chip">{s}</span>)}</div>
        </div>
      )}

      {ui.confirm && (
        <div className="pstage-confirm" data-present="shell-confirm-host">
          <p>Delete this for good?</p>
          <div className="pstage-confirm-row">
            <button type="button" className="pstage-sheet-btn">Cancel</button>
            <button type="button" className="pstage-sheet-btn danger" onClick={() => stagePatch({ confirm: null })}>Delete</button>
          </div>
        </div>
      )}
      <div className="toasts pstage-toasts" aria-hidden="true" />

      {session && nav.surface !== 'listen' && (
        <div className="mini pstage-mini">
          <button type="button" className="pstage-key sm" data-present="shell-mini-prev" aria-label="Previous"><SkipBack size={16} /></button>
          <button type="button" className="pstage-key sm" data-present="shell-mini-toggle" aria-label="Play or pause">{session.playing ? <Pause size={16} /> : <Play size={16} />}</button>
          <button type="button" className="pstage-key sm" data-present="shell-mini-next" aria-label="Next"><SkipForward size={16} /></button>
          <span className="grow">{session.title}</span>
          <div className="mini-prog pstage-miniprog"><i style={{ width: '30%' }} /></div>
        </div>
      )}

      <nav className="pstage-rail" data-present="shell-rail" aria-label="Main">
        <span className="pstage-brand">λ&nbsp; Logos</span>
        {(['listen', 'voices', 'create', 'library', 'settings'] as StageSurface[]).map((s) => (
          <button key={s} type="button" className={nav.surface === s ? 'on' : ''}
            data-present="shell-nav" data-route={s}
            onClick={() => { stageGo(s); stageBump() }}>
            {s === 'listen' ? 'Listen' : s === 'voices' ? 'Voices' : s === 'create' ? 'Create' : s === 'library' ? 'Library' : 'Settings'}
          </button>
        ))}
      </nav>

      <nav className="pstage-nav" data-present="shell-bottomnav">
        {(['listen', 'voices', 'create', 'library', 'settings'] as StageSurface[]).map((s) => (
          <button key={s} type="button" className={nav.surface === s ? 'on' : ''}
            data-present="shell-nav" data-route={s}
            onClick={() => { stageGo(s); stageBump() }}>
            {s === 'listen' ? 'Listen' : s === 'voices' ? 'Voices' : s === 'create' ? 'Create' : s === 'library' ? 'Library' : 'Settings'}
          </button>
        ))}
      </nav>
    </div>
  )
}

// ── The voice picker (a sheet over any surface) ───────────────────
/** The fiction stage's own cast (the scripts name them): the quick
 *  lap changes the harbour text to the stage's Spanish voice. They
 *  ride inside the matching language groups of the real catalogue. */
const FICTION_CAST: Voice[] = [
  { id: 'scenario-voice-en', name: 'Marina', lang: 'en', accent: 'US', gender: 'Female', tagline: 'The stage’s English voice', engine: 'phonon' } as Voice,
  { id: 'scenario-voice-es', name: 'Marina', lang: 'es', accent: 'ES', gender: 'Female', tagline: 'La voz en español del escenario', engine: 'phonon' } as Voice,
]
const PICKER_GROUPS: { key: string; label: string; pick: (v: Voice) => boolean }[] = [
  { key: 'pocket', label: 'Pocket — on this device', pick: (v) => v.engine === 'pocket' },
  { key: 'en-US', label: 'English · American', pick: (v) => v.engine === 'phonon' && v.lang === 'en' && v.accent === 'US' },
  { key: 'en-UK', label: 'English · British', pick: (v) => v.engine === 'phonon' && v.lang === 'en' && v.accent === 'UK' },
  { key: 'es-ES', label: 'Español · España', pick: (v) => v.engine === 'phonon' && v.lang === 'es' && v.accent === 'ES' },
  { key: 'es-MX', label: 'Español · México', pick: (v) => v.engine === 'phonon' && v.lang === 'es' && v.accent === 'MX' },
]
function VoicePicker({ scenario }: { scenario: Scenario }) {
  void scenario
  const voices = useStore(stageVoices)
  const fav = new Set(voices.favs)
  return (
    <div className="pstage-sheet pstage-overlay pstage-picker" data-present="voice-picker">
      <div className="pstage-sheet-h">Choose a voice</div>
      <button type="button" className="pstage-sheet-btn" data-present="voice-picker-auto">Auto — the best voice for the text</button>
      {/* The group DOM mirrors the real picker (the T6-9 cure): a
          <section data-group> wrapping its head, the head itself also
          carrying data-group beside its own :head mint — exactly the
          two carriers chrome.tsx renders. The bare group anchor's
          tag-qualified locator names the section, so stage and real
          app resolve it the same way, to the same seat. */}
      {fav.size > 0 && (
        <section data-group="fav">
          <div className="pstage-group-h" data-present="voice-picker-group:head" data-group="fav">Favourites</div>
          {VOICES.filter((v) => fav.has(v.id)).map((v) => (
            <PickerRow key={v.id} v={v} fav={fav} />
          ))}
        </section>
      )}
      {PICKER_GROUPS.map((g) => (
        <section key={g.key} data-group={g.key}>
          <div className="pstage-group-h" data-present="voice-picker-group:head" data-group={g.key}>{g.label}</div>
          {VOICES.filter(g.pick).map((v) => (
            <PickerRow key={v.id} v={v} fav={fav} />
          ))}
          {FICTION_CAST.filter(g.pick).map((v) => (
            <PickerRow key={v.id} v={v} fav={fav} />
          ))}
        </section>
      ))}
    </div>
  )
}
function PickerRow({ v, fav }: { v: Voice; fav: Set<string> }) {
  const isFav = fav.has(v.id)
  return (
    <div className="pstage-voice-row" data-present="voice-picker-row" data-voice-id={v.id}>
      <button type="button" className="pstage-key sm" data-present="voice-picker-row:preview" data-voice-id={v.id} aria-label={`Preview ${v.name}`}>
        <Play size={15} />
      </button>
      <span className="grow"><strong>{v.name}</strong> · {v.tagline}</span>
      <button type="button" className="pstage-iconbtn" data-present="voice-picker-row:star" data-voice-id={v.id} aria-label={`Favourite ${v.name}`}
        onClick={() => stageToggleFav(v.id)}>
        <Star size={16} fill={isFav ? 'currentColor' : 'none'} />
      </button>
    </div>
  )
}

// ── Listen ────────────────────────────────────────────────────────
function StageListen({ scenario }: { scenario: Scenario }) {
  const session = scenario.stage.session()
  const voices = useStore(stageVoices)
  const ui = useStore(stageUi)

  const draft = scenario.getDrafts().listen
  const text = session?.text ?? draft
  const sentences = useMemo(() => sentencesOf(text), [text])
  const [playing, setPlaying] = useState(!!session?.playing)
  const [idx, setIdx] = useState(session?.idx ?? 0)
  const [clips, setClips] = useState<{ id: string; title: string }[]>(() => stagePrime.get().clips.map((c) => ({ id: c.id, title: c.title })))
  const [books, setBooks] = useState<{ id: string; title: string; progress: number }[]>(() => stagePrime.get().books.map((b) => ({ id: b.id, title: b.title, progress: b.progress })))
  useEffect(() => { setPlaying(!!session?.playing); setIdx(session?.idx ?? 0) }, [session?.textId, session?.idx, session?.playing])
  useEffect(() => {
    let live = true
    void scenario.library.listClips().then((cs) => { if (live) setClips(cs.map((c) => ({ id: c.id, title: c.title }))) })
    void scenario.books.listBooks().then((bs) => { if (live) setBooks(bs.map((b) => ({ id: b.id, title: b.title, progress: b.progress }))) })
    return () => { live = false }
  }, [scenario])

  const words = text.trim() ? text.trim().split(/\s+/).length : 0
  // The banner's law is the real app's: a lone link, with or
  // without its scheme (lib/webtext isJustUrl).
  const loneUrl = isJustUrl(draft)
  const continueBook = books.find((b) => b.progress > 0)
  return (
    <div className="listen-page">
      <div className="pstage-eyebrow">● LISTEN</div>
      <div className="listen-head pstage-head">
        <h2 className="pstage-title">{session?.title || 'Paste anything. Hear it instantly.'}</h2>
        {session ? <span className="pstage-meta">{sentences.length} sentences</span> : null}
      </div>

      {(continueBook || clips.length > 0) && (
        <div className={`continue-card pstage-card${session ? ' folded' : ''}`}>
          <span className="pstage-meta">Continue listening</span>
          {continueBook && <button type="button" className="pstage-sheet-btn" data-present="listen-continue-book">{continueBook.title}</button>}
          {clips[0] && <button type="button" className="pstage-sheet-btn" data-present="listen-continue-clip">{clips[0].title}</button>}
          <button type="button" className="pstage-sheet-btn" data-present="listen-continue-text">Your last text</button>
        </div>
      )}
      {session?.title && books.length > 0 && (
        <button type="button" className="pstage-chip" data-present="listen-back-to-book">Back to the book</button>
      )}

      <div className="pstage-card pstage-listen-editor">
        <textarea
          data-present="listen-editor"
          className="pstage-editor"
          value={draft}
          placeholder="Paste an article, a chapter, a poem…"
          onChange={(e) => { scenario.setDraft('listen', e.target.value); stageBump() }}
        />
        {loneUrl && (
          <div className="url-banner pstage-banner">
            <span>That is a link — Logos can read the page itself.</span>
            <button type="button" className="pstage-chip accent">Read page</button>
          </div>
        )}
        <div className="pstage-editor-row">
          <span className="pstage-meta editor-meta">{words} words</span>
          <span className="pstage-grow" />
          {session && <span className="pstage-chip" data-present="listen-reading-view">Reading view</span>}
          <button type="button" className="pstage-iconbtn" data-present="listen-paste" aria-label="Paste">
            <ClipboardPaste size={18} />
          </button>
          <button type="button" className="pstage-iconbtn" data-present="listen-clear" aria-label="Clear">
            <Eraser size={18} />
          </button>
          <button type="button" className="pstage-iconbtn" data-present="listen-save" aria-label="Save">
            <BookDown size={18} />
          </button>
        </div>
      </div>

      <div className="pstage-card pstage-player">
        <div className="pstage-chips">
          <span className="pstage-chip lang-chip">Auto · EN</span>
          <button type="button" className="pstage-chip" data-present="listen-sleep-chip"><Moon size={14} /> Sleep</button>
          <span className="pstage-chip speed-chip">{['0.75×', '0.9×', '1×', '1.1×', '1.25×', '1.5×', '1.75×', '2×'][ui.speedIdx]}</span>
          <span className="pstage-grow" />
          <button type="button" className="pstage-iconbtn" data-present="listen-nav-pin" aria-label="Keep the bar">📌</button>
        </div>
        <div className="pstage-viz" data-present="listen-visualizer" aria-hidden="true">
          {sentences.map((_, i) => <i key={i} className={i === idx ? 'on' : ''} />)}
        </div>
        <div className="pstage-scrub scrubber">
          <div className="pstage-scrub-fill" style={{ width: sentences.length ? `${((idx + 1) / sentences.length) * 100}%` : '0%' }} />
        </div>
        <div className="pstage-meta-row">
          <span className="player-meta">{session?.finished ? 'Finished' : playing ? 'Playing' : 'Ready'}</span>
          <span>{sentences.length ? `${idx + 1} of ${sentences.length}` : ''}</span>
        </div>
        <div className="pstage-transport">
          <button type="button" className="pstage-key" data-present="listen-prev" aria-label="Previous">
            <SkipBack size={20} />
          </button>
          <button type="button" className="pstage-play play-btn" aria-label={playing ? 'Pause' : 'Play'}>
            {playing ? <Pause size={30} /> : <Play size={30} />}
          </button>
          <button type="button" className="pstage-key" data-present="listen-next" aria-label="Next">
            <SkipForward size={20} />
          </button>
          <button type="button" className="pstage-key" data-present="listen-mark" aria-label="Mark">
            <Bookmark size={19} />
          </button>
        </div>
        <p className="engine-note pstage-note">Neural voice · on this device</p>
        {ui.listenError && <p className="error-note pstage-note">The voice stopped — your place is kept. Press Play to go on.</p>}
      </div>

      {sentences.length > 0 && (
        <div className="pstage-card pstage-reader reader">
          <div className="reader-head pstage-reader-head">
            <strong>{session?.title || 'Your text'}</strong>
            <span className="pstage-grow" />
            <button type="button" className="pstage-iconbtn" data-present="listen-text-smaller" aria-label="Smaller text">A−</button>
            <button type="button" className="pstage-iconbtn" data-present="listen-text-bigger" aria-label="Bigger text">A+</button>
            <button type="button" className="pstage-iconbtn" data-present="listen-reader-edit" aria-label="Edit the text">✎</button>
            <button type="button" className="pstage-iconbtn" data-present="listen-reader-save" aria-label="Keep this reading">
              <BookDown size={17} />
            </button>
          </div>
          <p>
            {sentences.map((s, i) => (
              <span key={i} data-i={i} className={i === idx ? 'pstage-sent on' : 'pstage-sent'}>
                {s}{' '}
              </span>
            ))}
          </p>
        </div>
      )}

      {/* The wide-screen desk (AD13): the book in progress, favourite
          voices and recent items beside the player, and the text map.
          CSS stands it up only at desk widths, as in the real app. */}
      <div className="pstage-desk" data-present="desk-tablet">
        {books[0] && (
          <div className="pstage-card" data-present="desk-book">
            <span className="pstage-meta">Continue reading</span>
            <strong>{books[0].title}</strong>
            <div className="pstage-scrub"><div className="pstage-scrub-fill" style={{ width: `${Math.round(books[0].progress * 100)}%` }} /></div>
          </div>
        )}
        <div className="pstage-card" data-present="desk-fav-voices">
          <span className="pstage-meta">Favorite voices</span>
          <div className="pstage-chips">
            {voices.favs.map((id) => <span key={id} className="pstage-chip">{(VOICES.find((v) => v.id === id))?.name ?? id}</span>)}
            {/* 1.4.203: the fiction mirrors the real desk — the
                player's voice chip is retired and the desk's card
                carries the picker door with its class. */}
            <button type="button" className="pstage-chip voice-chip">● Choose a voice</button>
          </div>
        </div>
        <div className="pstage-card" data-present="desk-recent">
          <span className="pstage-meta">Recent in Library</span>
          {clips.map((c) => <div key={c.id} className="pstage-note">{c.title}</div>)}
        </div>
        <div className="pstage-card" data-present="desk-textmap-stats">
          <span className="pstage-meta">This text</span>
          <div className="pstage-note">{words} words · {sentences.length} sentences</div>
        </div>
        {/* The real desk's second text-map card (the M-36 cure): since
            1.4.167 it shows favourite books and carries NO mint — the
            stage used to dress a fake «Paragraphs» card carrying the
            retired desk-textmap-paragraphs mint, a fake presence the
            AD13 beat then "tapped". The card now wears the real shape
            and no mint, so the beat resolves as the declared miss it
            honestly is (see the registry record and the lane flag). */}
        <div className="pstage-card">
          <span className="pstage-meta">Favorite books</span>
          {books.map((b) => <div key={b.id} className="pstage-note">{b.title} · {Math.round(b.progress * 100)}%</div>)}
          {books.length === 0 && <div className="pstage-note">Books you import land here.</div>}
        </div>
      </div>
    </div>
  )
}

// ── Voices ────────────────────────────────────────────────────────
function StageVoices({ scenario }: { scenario: Scenario }) {
  void scenario
  const ui = useStore(stageUi)
  const voices = useStore(stageVoices)
  const fav = new Set(voices.favs)
  // 1.4.203 (the Q3 remap, integrated from the Presentation lane):
  // the real Voices page has been the picker's accordion since
  // 1.4.200 — sections that fold and open, one at a time — so the
  // fiction wears the same shape: a section's cards exist only
  // while it stands open, exactly as on the real page. Language
  // sections hold Phonon voices; Pocket voices live in their own
  // section, as in the real composition.
  const open = ui.voicesSection
  const groups = [
    { key: 'fav', label: 'Favourites', members: VOICES.filter((v) => fav.has(v.id)) },
    { key: 'pocket', label: 'Pocket', members: VOICES.filter((v) => v.engine === 'pocket') },
    { key: 'en', label: 'English', members: VOICES.filter((v) => v.engine !== 'pocket' && v.lang === 'en') },
    { key: 'es', label: 'Español', members: VOICES.filter((v) => v.engine !== 'pocket' && v.lang === 'es') },
  ]
  return (
    <div>
      <div className="pstage-eyebrow" data-present="voices-head">● VOICES</div>
      <h2 className="pstage-title">Voices</h2>
      <div className="pstage-note" data-present="voices-catalog">{VOICES.length} voices · {ENGINE_LABEL.pocket} and {ENGINE_LABEL.phonon}</div>
      <div data-present="voices-grid">
        {groups.map((g) => (
          <div key={g.key}>
            <button type="button" className={open === g.key ? 'pstage-chip accent' : 'pstage-chip'}
              data-present="voices-section-head" data-group={g.key}
              onClick={() => stagePatch({ voicesSection: open === g.key ? null : g.key })}>
              {g.label} · {g.members.length}
            </button>
            {open === g.key && (
              <div className="pstage-grid">
                {g.key === 'fav' && g.members.length === 0 && (
                  <p className="pstage-note" data-present="voices-empty-fav">No favourites yet — tap a star to keep a voice here.</p>
                )}
                {g.members.map((v) => {
          const isFav = fav.has(v.id)
          const isDefault = v.id === voices.defaultId
          return (
            <div key={v.id} className="pstage-card pstage-voice-card" data-present="voice-card" data-voice-id={v.id}>
              <div className="pstage-voice-top">
                <strong>{v.name}</strong>
                {isDefault && <span className="pstage-pill on">Default</span>}
                <span className="pstage-grow" />
                <button type="button" className="pstage-iconbtn" data-present="voice-card:star" data-voice-id={v.id} aria-label={`Favourite ${v.name}`}
                  onClick={() => stageToggleFav(v.id)}>
                  <Star size={16} fill={isFav ? 'currentColor' : 'none'} />
                </button>
              </div>
              <p className="pstage-note">{v.tagline} · {v.lang === 'en' ? 'English' : 'Español'} · {ACCENT_LABEL[v.accent]}</p>
              <div className="pstage-voice-row2">
                <button type="button" className="pstage-key sm" data-present="voice-card:preview" data-voice-id={v.id} aria-label={`Preview ${v.name}`}>
                  <Play size={15} />
                </button>
                {!isDefault && (
                  <button type="button" className="pstage-chip" data-present="voice-card:make-default" data-voice-id={v.id}
                    onClick={() => stageSetDefaultVoice(v.id)}>Make default</button>
                )}
              </div>
            </div>
          )
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Library ───────────────────────────────────────────────────────
function StageLibrary({ scenario }: { scenario: Scenario }) {
  const ui = useStore(stageUi)
  const nav = useStore(stageNav)
  const fields = useStore(stageFields)
  const bookTemp = useStore(stageBookTemp).temp
  const [clips, setClips] = useState<{ id: string; title: string; kind: string; duration: number; text: string }[]>(() => stagePrime.get().clips)
  const [books, setBooks] = useState<{ id: string; title: string; author: string; temp?: boolean; progress: number }[]>(() => stagePrime.get().books)
  const [marks, setMarks] = useState<{ id: string; title: string; sentence: string }[]>([])
  const [favClips, setFavClips] = useState<Set<string>>(new Set())
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const activeClip = useStore(stageActiveClip).id
  const setActiveClip = (id: string | null) => stageActiveClip.set({ id })
  const query = fields.values['lib-saved-search'] ?? ''
  const bkQuery = fields.values['bk-shelf-search'] ?? ''

  const reload = () => {
    void scenario.library.listClips().then((cs) => setClips(cs.map((c) => ({ id: c.id, title: c.title, kind: c.kind, duration: c.duration, text: c.text }))))
    void scenario.books.listBooks().then((bs) => setBooks(bs.map((b) => ({ id: b.id, title: b.title, author: b.author, temp: b.temp, progress: b.progress }))))
    setMarks(scenario.listMarks().map((m) => ({ id: m.id, title: m.title, sentence: m.sentence })))
  }
  useEffect(reload, [scenario, nav.bump])
  // Timed fiction never lands on a wall clock: an import / web read /
  // render stays in its working state until a beat focuses the landed
  // state, and the host's resolver fast-forwards it at that moment
  // (presentation-host show()). A lesson that walks away leaves the
  // working state behind with its room (stageGo clears fx).

  const shownClips = clips.filter((c) => !query || (c.title + ' ' + c.text).toLowerCase().includes(query.toLowerCase()))
  const shownBooks = books.filter((b) => !bkQuery || b.title.toLowerCase().includes(bkQuery.toLowerCase()))
  const inSaved = ui.libTab === 'saved'

  return (
    <div className="lib-split">
      <div className="pstage-eyebrow" data-present="lib-head-count">● LIBRARY · {clips.length + books.length}</div>
      <h2 className="pstage-title">Library</h2>
      <div className="pstage-tabs" data-present="lib-shelf-tabs">
        <button type="button" role="tab" className={inSaved ? 'on' : ''} data-present="lib-split-saved" onClick={() => stagePatch({ libTab: 'saved' })}>Saved</button>
        <button type="button" role="tab" className={!inSaved ? 'on' : ''} data-present="lib-split-books" onClick={() => stagePatch({ libTab: 'books' })}>Books</button>
      </div>

      <div data-stage-tab="saved" hidden={ui.libTab !== 'saved'}>
        <div>
          <div className="pstage-searchrow">
            <Search size={16} />
            <input data-present="lib-saved-search" placeholder="Search saved" defaultValue={query} />
            <button type="button" className="pstage-iconbtn" data-present="lib-add" aria-label="Add">+</button>
            <button type="button" className="pstage-iconbtn" data-present="lib-select-toggle" aria-label="Select"
              onClick={() => stagePatch({ selecting: !ui.selecting })}>
              <Check size={16} />
            </button>
          </div>
          <div className="pstage-chips" data-present="lib-saved-filters" role="tablist">
            {[{ k: 'all', l: 'All' }, { k: 'fav', l: 'Favourites' }, { k: 'done', l: 'Done' }].map((f) => (
              <span key={f.k} className="pstage-chip" data-present="lib-filter" data-filter={f.k}>{f.l}</span>
            ))}
            <span className="pstage-chip" data-present="lib-saved-sort">Newest</span>
          </div>
          {ui.selecting && (
            <div className="pstage-selbar" data-present="lib-selbar" role="toolbar">
              <button type="button" className="pstage-chip" data-present="lib-sel-all">All</button>
              <button type="button" className="pstage-chip" data-present="lib-sel-fav">Favourite</button>
              <button type="button" className="pstage-chip" data-present="lib-sel-done">Done</button>
              <button type="button" className="pstage-chip" data-present="lib-sel-delete">Delete</button>
            </div>
          )}
          {clips.length === 0 && (
            <p className="pstage-note" data-present="lib-saved-empty">Nothing saved yet — what you save while listening lands here.</p>
          )}
          {clips.length > 0 && shownClips.length === 0 && (
            <p className="pstage-note" data-present="lib-saved-nomatch">Nothing matches that search.</p>
          )}
          <div className="pstage-clips">
          {shownClips.map((c) => (
            <div key={c.id} className="pstage-card pstage-clip" data-present="lib-clip-card" data-clip-kind={c.kind}>
              {ui.selecting && (
                <button type="button" className="pstage-iconbtn" data-present="lib-clip-selbox" aria-label="Select"
                  onClick={() => { const n = new Set(checked); if (n.has(c.id)) n.delete(c.id); else n.add(c.id); setChecked(n); stageBump() }}>
                  {checked.has(c.id) ? <Check size={15} /> : ''}
                </button>
              )}
              <span className="grow">
                <strong>{c.title}</strong>
                <span className="pstage-meta" data-present="lib-clip-meta"> · {Math.max(1, Math.round(c.duration / 60))} min</span>
              </span>
              <button type="button" className="pstage-iconbtn" data-present="lib-clip-fav" aria-label="Favourite"
                onClick={() => { const n = new Set(favClips); if (n.has(c.id)) n.delete(c.id); else n.add(c.id); setFavClips(n); stageBump() }}>
                <Star size={16} fill={favClips.has(c.id) ? 'currentColor' : 'none'} />
              </button>
              <button type="button" className="pstage-key sm" data-present="lib-clip-play" aria-label="Play"
                onClick={() => { setActiveClip(c.id); stageBump() }}>
                <Play size={16} />
              </button>
              {activeClip === c.id && (
                <div className="pstage-scrub grow" data-present="lib-clip-seek" role="slider" aria-label="Clip position">
                  <div className="pstage-scrub-fill" style={{ width: '30%' }} />
                </div>
              )}
              {c.kind === 'text' && (
                <button type="button" className="pstage-chip" data-present="lib-clip-make-audio">Make audio</button>
              )}
              <button type="button" className="pstage-iconbtn" data-present="lib-clip-more" aria-label="More">•••</button>
            </div>
          ))}
          </div>
          {ui.menu === 'clip' && (
            <div className="pstage-sheet">
              <button type="button" className="pstage-sheet-btn" data-present="lib-menu-open-listen">Open in Listen</button>
              <button type="button" className="pstage-sheet-btn" data-present="lib-menu-make-audio">Make audio</button>
              <button type="button" className="pstage-sheet-btn" data-present="lib-menu-done">Mark done</button>
              <button type="button" className="pstage-sheet-btn" data-present="lib-menu-startover">Start over</button>
              <button type="button" className="pstage-sheet-btn" data-present="lib-menu-webpage">Open the page</button>
              <button type="button" className="pstage-sheet-btn" data-present="lib-menu-rename">Rename</button>
              <button type="button" className="pstage-sheet-btn" data-present="lib-menu-download">Download</button>
              <button type="button" className="pstage-sheet-btn" data-present="lib-menu-share">Share</button>
              <button type="button" className="pstage-sheet-btn" data-present="lib-menu-delete">Delete</button>
            </div>
          )}
          {ui.menu === 'rename' && (
            <div className="pstage-sheet">
              <input data-present="lib-rename-input" placeholder="New name" defaultValue={clips[0]?.title ?? ''} />
            </div>
          )}
          {ui.fx === 'rendering' && (
            <div className="pstage-card" data-present="lib-render-card">
              <span>Making the audio…</span>
              <button type="button" className="pstage-chip" data-present="lib-clip-render-stop">Stop</button>
            </div>
          )}
          {marks.length > 0 && (
            <div data-present="lib-marks">
              <div className="pstage-sheet-h">Marks</div>
              {marks.map((m) => (
                <div key={m.id} className="mark-row pstage-clip pstage-card">
                  <span className="grow">⚑ {m.sentence}</span>
                  <button type="button" className="pstage-iconbtn" data-present="lib-mark-remove" aria-label="Remove mark"><X size={15} /></button>
                </div>
              ))}
            </div>
          )}
          <WebImport ui={ui} />
        </div>
      </div>

      <div data-stage-tab="books" hidden={ui.libTab !== 'books'}>
        <div>
          <div className="pstage-searchrow">
            <Search size={16} />
            <input data-present="bk-shelf-search" placeholder="Search books" defaultValue={bkQuery} />
            <button type="button" className="pstage-chip" data-present="bk-shelf-import">Import</button>
          </div>
          <div className="pstage-chips" data-present="bk-shelf-filters" role="tablist">
            <span className="pstage-chip">All</span><span className="pstage-chip">Reading</span>
            <span className="pstage-chip" data-present="bk-shelf-sort">Title</span>
          </div>
          <div className="pstage-chips" data-present="bk-cover-size" role="radiogroup">
            <span className="pstage-chip">Small</span><span className="pstage-chip">Large</span>
          </div>
          {books.find((b) => b.progress > 0) && (
            <div className="pstage-card" data-present="bk-shelf-continue">
              <span className="pstage-meta">Continue</span>
              <strong>{books.find((b) => b.progress > 0)?.title}</strong>
            </div>
          )}
          {ui.fx === 'importing' && <p className="pstage-note" data-present="bk-importing">Importing the book…</p>}
          {ui.fx === 'keepask' && (
            <div className="pstage-sheet" data-present="bk-keepask">
              <div className="pstage-sheet-h">Keep this book?</div>
              <button type="button" className="pstage-sheet-btn" data-present="bk-keepask-keep">Keep it</button>
              <button type="button" className="pstage-sheet-btn" data-present="bk-keepask-once">Just this once</button>
            </div>
          )}
          {shownBooks.map((b) => (
            <div key={b.id} className="pstage-card pstage-clip" data-present="bk-tile">
              <span className="grow"><strong>{b.title}</strong><span className="pstage-meta"> · {b.author}</span></span>
              <span className="pstage-pill" data-present="bk-tile-temp">{(bookTemp ?? b.temp) ? 'For now' : 'Kept'}</span>
              <button type="button" className="pstage-iconbtn" data-present="bk-tile-more" aria-label="More">•••</button>
            </div>
          ))}
          {(ui.menu === 'book' || ui.menu === 'bk-rename') && (
            <div className="pstage-sheet">
              <button type="button" className="pstage-sheet-btn" data-present="bk-menu-fav">Favourite</button>
              <button type="button" className="pstage-sheet-btn" data-present="bk-menu-temp">Keep for now</button>
              <button type="button" className="pstage-sheet-btn" data-present="bk-menu-done">Mark done</button>
              <button type="button" className="pstage-sheet-btn" data-present="bk-menu-startover">Start over</button>
              <button type="button" className="pstage-sheet-btn" data-present="bk-menu-rename">Rename</button>
              <button type="button" className="pstage-sheet-btn" data-present="bk-menu-delete">Delete</button>
            </div>
          )}
          {ui.menu === 'bk-rename' && (
            <div className="pstage-sheet">
              <input data-present="bk-rename-title" placeholder="Title" defaultValue={books[0]?.title ?? ''} />
              <input data-present="bk-rename-author" placeholder="Author" defaultValue={books[0]?.author ?? ''} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function WebImport({ ui }: { ui: StageUiState }) {
  const fields = useStore(stageFields)
  return (
    <div className="pstage-card" data-present="web-import">
      <strong>Read a web page</strong>
      <div className="pstage-searchrow">
        <input data-present="web-import-url" placeholder="Paste a link" defaultValue={fields.values['web-import-url'] ?? ''} />
        <button type="button" className="pstage-chip accent" data-present="web-import-go">Read it</button>
      </div>
      <button type="button" className="pstage-chip" data-present="web-import-paste">Paste the text instead</button>
      {/* The file doors stand in the sheet's input phase, under
          their «or» — as in the real sheet — not behind a fetch:
          AD6's add-audio lesson points at them from the shelf. */}
      <div className="pstage-chips">
        <button type="button" className="pstage-chip" data-present="web-import-book-door">Import a book</button>
        <button type="button" className="pstage-chip" data-present="web-import-audio-door">Add an audio file</button>
      </div>
      {ui.fx === 'web-loading' && (
        <p className="pstage-note" data-present="web-import-loading">Reading the page… <button type="button" className="pstage-chip" data-present="web-import-cancel">Cancel</button></p>
      )}
      {ui.fx === 'web-error' && <p className="pstage-note" data-present="web-import-error">That page could not be read.</p>}
      {ui.fx === 'web-ready' && (
        <div data-present="web-import-ready">
          <button type="button" className="pstage-sheet-btn" data-present="web-import-listen-now">Listen now</button>
          <button type="button" className="pstage-sheet-btn" data-present="web-import-later">Later</button>
          <button type="button" className="pstage-sheet-btn" data-present="web-import-save-audio">Save the audio</button>
        </div>
      )}
    </div>
  )
}

// ── Book ──────────────────────────────────────────────────────────
function StageBook({ scenario }: { scenario: Scenario }) {
  const ui = useStore(stageUi)
  const fields = useStore(stageFields)
  const book = scenario.fictionBook
  const [ch, setCh] = useState(0)
  const [marks] = useState(() => scenario.listMarks())
  const chapter = book.content.chapters[ch]
  const isLast = ch === book.content.chapters.length - 1
  const searchQ = fields.values['book-search-input'] ?? ''
  return (
    <div data-present="book-page">
      <div className="pstage-book-head">
        <button type="button" className="pstage-iconbtn" data-present="book-head-back" aria-label="Back">←</button>
        <span className="pstage-eyebrow" data-present="book-eyebrow">{book.meta.title} · Chapter {ch + 1}</span>
        <span className="pstage-grow" />
        <button type="button" className="pstage-iconbtn" data-present="book-head-toc" aria-label="Contents">☰</button>
        <button type="button" className="pstage-iconbtn" data-present="book-head-search" aria-label="Search">🔍</button>
        <button type="button" className="pstage-iconbtn" data-present="book-head-type" aria-label="Type">Aa</button>
      </div>

      {/* One Contents structure, two presentations (as in the real
          app): a sheet on the phone — standing when the Contents
          button opens it — and a pinned side panel past 1100px,
          where it never closes. It is always in the DOM; CSS
          decides which presentation shows. */}
      <div className={`pstage-sheet pstage-side-toc${ui.panel === 'toc' ? ' open' : ''}`} data-present="book-side-toc">
          <div className="pstage-chips" data-present="book-toc-tabs">
            <span className="pstage-chip">Chapters</span><span className="pstage-chip">Marks</span>
          </div>
          <div data-present="book-toc-list">
            {book.content.chapters.map((c, i) => (
              <button key={i} type="button" className={i === ch ? 'bk-toc-i cur pstage-sheet-btn' : 'bk-toc-i pstage-sheet-btn'}
                data-present="book-toc-row" onClick={() => setCh(i)}>
                {c.title}
              </button>
            ))}
          </div>
          <div data-present="book-marks-list">
            {marks.map((m) => (
              <div key={m.id} className="pstage-sheet-btn" data-present="book-marks-row">⚑ {m.sentence}</div>
            ))}
          </div>
      </div>

      {ui.panel === 'search' && (
        <div className="pstage-sheet">
          <div className="pstage-searchrow">
            <input data-present="book-search-input" placeholder="Search in this book" defaultValue={searchQ} />
            <span className="pstage-meta" data-present="book-search-count">{searchQ ? '1 match' : ''}</span>
          </div>
          {searchQ && (
            <button type="button" className="pstage-sheet-btn" data-present="book-search-row">
              …the <span className="bk-mark">{searchQ}</span> was already lit…
            </button>
          )}
          <div className="pstage-chips" data-present="book-findbar">
            <button type="button" className="pstage-chip" data-present="book-find-prev">↑ Prev</button>
            <button type="button" className="pstage-chip" data-present="book-find-next">↓ Next</button>
            <button type="button" className="pstage-chip" data-present="book-find-close">Close</button>
          </div>
        </div>
      )}

      {ui.panel === 'type' && (
        <div className="pstage-sheet">
          <div className="pstage-sheet-h">Type</div>
          <div className="pstage-row"><span>Size</span><span className="pstage-grow" />
            <button type="button" className="pstage-iconbtn" data-present="book-type-size-minus">A−</button>
            <button type="button" className="pstage-iconbtn" data-present="book-type-size-plus">A+</button>
          </div>
          <div className="pstage-row"><span data-present="book-type-font">Serif</span><span className="pstage-grow" /><span data-present="book-type-lines">Lines 1.7</span></div>
        </div>
      )}

      {/* The book's panel is a sheet on the phone (the About door
          opens it) and a standing third column past 1100px (AD13's
          scene) — one structure, always in the DOM, carrying the
          book-info anchor itself; CSS decides its presentation. */}
      <div className={`pstage-sheet pstage-side-info${ui.panel === 'info' ? ' open' : ''}`} data-present="book-info">
          <div className="pstage-sheet-h">{book.meta.title}</div>
          <p className="pstage-note" data-present="book-info-stats">{book.meta.words} words · 3 chapters</p>
          <p className="pstage-note" data-present="book-info-marks">{marks.length} marks</p>
          <button type="button" className="pstage-sheet-btn" data-present="book-info-listen">Listen</button>
          <button type="button" className="pstage-sheet-btn" data-present="book-info-search">Search</button>
          <button type="button" className="pstage-sheet-btn" data-present="book-info-type">Type</button>
          <button type="button" className="pstage-sheet-btn" data-present="book-info-audiobook">Make the audiobook</button>
      </div>

      {ui.panel === 'note' && (
        <div className="pstage-sheet" data-present="book-note-sheet">
          <div className="pstage-sheet-h">A note in the book</div>
          <p className="pstage-note">This link opens the note where it lives, in chapter 3.</p>
          <button type="button" className="pstage-sheet-btn" data-present="book-note-go">Go to the note</button>
        </div>
      )}

      <article className="pstage-book-body">
        {chapter.blocks.map((b, i) => {
          if (b.k === 'h1') return <h3 key={i} data-b={i}>{b.t}</h3>
          const link = b.l?.[0]
          if (link) {
            return (
              <p key={i} data-b={i}>
                {b.t.slice(0, link.s)}
                <span className="bk-link" data-present="book-link">{b.t.slice(link.s, link.e)}</span>
                {b.t.slice(link.e)}
              </p>
            )
          }
          return <p key={i} data-b={i}>{b.t}</p>
        })}
      </article>

      <div className="pstage-book-bar">
        <button type="button" className="pstage-iconbtn" data-present="book-back" aria-label="Back a page">‹</button>
        <button type="button" className="pstage-chip" data-present="book-prev-ch" onClick={() => setCh(Math.max(0, ch - 1))}>Prev chapter</button>
        <span className="pstage-meta" data-present="book-bar-mid">{ch + 1} / {book.content.chapters.length}</span>
        <div className="pstage-scrub grow" data-present="book-seek" role="slider" aria-label="Book position">
          <div className="pstage-scrub-fill" style={{ width: `${((ch + 1) / book.content.chapters.length) * 100}%` }} />
        </div>
        <button type="button" className="pstage-chip accent" data-present="book-bar-listen">Listen</button>
        <button type="button" className="pstage-chip" data-present="book-next-ch" onClick={() => setCh(Math.min(book.content.chapters.length - 1, ch + 1))}>Next chapter</button>
      </div>

      <div className="pstage-chips" data-present="book-actions" role="toolbar">
        <button type="button" className="pstage-chip" data-present="book-act-listen">Listen</button>
        <button type="button" className="pstage-chip" data-present="book-act-bookmark">Bookmark</button>
        <button type="button" className="pstage-chip" data-present="book-act-copy">Copy</button>
        <button type="button" className="pstage-chip" data-present="book-act-close">Close</button>
        <button type="button" className="pstage-chip" onClick={() => stagePatch({ panel: 'info' })}>About this book</button>
      </div>

      {!isLast && (
        <div className="pstage-card" data-present="book-next-card">
          <span className="pstage-meta">Next</span>
          <strong>{book.content.chapters[ch + 1].title}</strong>
        </div>
      )}
      {isLast && (
        <div className="pstage-card" data-present="book-end-finish">
          <strong>The end</strong>
          <p className="pstage-note">You finished {book.meta.title}.</p>
        </div>
      )}
    </div>
  )
}

// ── Create ────────────────────────────────────────────────────────
function StageCreate({ scenario }: { scenario: Scenario }) {
  const ui = useStore(stageUi)
  const draft = scenario.getDrafts().create
  const [clips, setClips] = useState<{ id: string; title: string }[]>([])
  useEffect(() => {
    void scenario.library.listClips().then((cs) => setClips(cs.filter((c) => c.kind === 'audio').map((c) => ({ id: c.id, title: c.title }))))
  }, [scenario, ui.fx])
  const words = draft.trim() ? draft.trim().split(/\s+/).length : 0
  return (
    <div className="create-page">
      <div className="pstage-eyebrow" data-present="create-head">● CREATE</div>
      <h2 className="pstage-title">Make an audio file</h2>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--accent)', margin: '12px 2px 6px' }}>The text</div>
      <div className="pstage-card">
        <textarea
          data-present="create-editor"
          className="pstage-editor"
          value={draft}
          placeholder="Write or paste the text to record…"
          onChange={(e) => { scenario.setDraft('create', e.target.value); stageBump() }}
        />
        <div className="pstage-editor-row">
          <span className="pstage-meta" data-present="create-meta">{words} words</span>
          <span className="pstage-grow" />
          <button type="button" className="pstage-iconbtn" data-present="create-paste" aria-label="Paste"><ClipboardPaste size={17} /></button>
          <button type="button" className="pstage-chip" data-present="create-use-listen">Use my Listen text</button>
        </div>
      </div>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--accent)', margin: '14px 2px 6px' }}>The voice</div>
      <div className="pstage-card">
        <div className="pstage-row" data-present="create-voice-row">
          <span>Voice</span><span className="pstage-grow" />
          <button type="button" className="pstage-chip" data-present="create-voice-chip" data-voice-id="auto">Auto</button>
          <span data-present="create-voice-chosen">Auto</span>
        </div>
      </div>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--accent)', margin: '14px 2px 6px' }}>The output</div>
      <div className="pstage-card">
        <div className="pstage-row"><span data-present="create-speed">Speed</span><span className="pstage-grow" /><span>1×</span></div>
        <div className="pstage-row"><span data-present="create-format">Format</span><span className="pstage-grow" /><span>M4A</span></div>
        <div className="pstage-row"><span data-present="create-title">Title</span><span className="pstage-grow" /><span>My recording</span></div>
        <p className="engine-note pstage-note" data-present="create-engine-note">Made on this device — nothing leaves the phone.</p>
        <button type="button" className="pstage-sheet-btn accent" data-present="create-generate">Generate</button>
        {ui.fx === 'creating' && (
          <div data-present="create-progress">
            <p className="pstage-note">Recording…</p>
            <button type="button" className="pstage-chip" data-present="create-cancel">Cancel</button>
          </div>
        )}
        {ui.fx === 'create-error' && <p className="error-note pstage-note" data-present="create-error">The recording could not be made.</p>}
        {ui.fx === 'created' && (
          <div data-present="create-result">
            <div className="pstage-scrub" data-present="create-result-seek"><div className="pstage-scrub-fill" style={{ width: '12%' }} /></div>
            <div className="pstage-chips">
              <button type="button" className="pstage-chip" data-present="create-result-download">Download</button>
              <button type="button" className="pstage-chip" data-present="create-result-share">Share</button>
              <button type="button" className="pstage-chip" data-present="create-result-library">In the Library</button>
              <button type="button" className="pstage-chip" data-present="create-result-new">New</button>
            </div>
          </div>
        )}
      </div>
      {clips.length > 0 && (
        <div data-present="create-recordings">
          <div className="pstage-sheet-h">Your recordings</div>
          {clips.map((c) => (
            <div key={c.id} className="pstage-card pstage-clip"><span className="grow">{c.title}</span></div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Settings ──────────────────────────────────────────────────────
// ── Settings ──────────────────────────────────────────────────────
// THE CURRENT SHAPE (the M-33 cure): since 1.4.171 the real Settings
// page wears the house clusters — sunken trays grouping the cards by
// territory — with the general Settings search at the very top (born
// 1.4.177). The stage used to dress the pre-1.4.171 flat page: cards
// in the old order, no trays, no search — a fiction teaching a
// Settings that no longer exists. The stage now wears the real shape:
// the same search (same index words, copied from SettingsPage's own
// SETTING_INDEX; a hit scrolls to the standing card — the stage's
// cards stand open, their interiors always present, so nothing needs
// unfolding and every interior anchor still resolves exactly once),
// the same five trays in the real order with the real names and
// lines, the same card titles and subs, About loose at the foot.
// Every card keeps its mint and its interior anchors exactly as
// before — the dressing changed; the resolution did not.
// 1.4.248: the fiction follows the app into list-detail (1.4.246) —
// at the two-pane tier the five trays stand as a list at the left
// and only the seated tray's cards stand in the detail. The seat
// lives in stageUi (settingsTray): a tap on the fiction's list
// seats it, and the resolver seats it ahead of any beat that
// points at a card, so no anchor is ever resolved against a card
// that is not displayed. Below the tier the trays stack as before.
const STAGE_TRAYS: { id: string; name: string; line: string }[] = [
  { id: 'voice', name: 'The voice', line: 'The voice that reads to you, and how it says your words.' },
  { id: 'listening', name: 'Listening', line: 'How listening feels — here, and floating over your other apps.' },
  { id: 'screen', name: 'The screen', line: 'How Logos looks, and the language it speaks.' },
  { id: 'learn', name: 'Learn', line: 'Guided lessons that walk the whole app with you.' },
  { id: 'data', name: 'Your data', line: 'Your whole library in one file — out, and back in.' },
]
const STAGE_SETTING_INDEX: { anchor: string; title: string; sub: string; keys: string }[] = [
  { anchor: 'set-neural', title: 'Neural voice', sub: 'The reading voice — it lives on this device, downloads once, then works offline.', keys: 'voice engine download model storage protect protected cleanup delete offline voz neuronal descargar motor almacenamiento proteger' },
  { anchor: 'set-pron', title: 'Pronunciation', sub: 'Words said your way — names, places, terms of art.', keys: 'pronounce names words say dictionary say it your way pronunciación nombres palabras diccionario' },
  { anchor: 'set-playback', title: 'Playback', sub: 'How listening feels, sentence by sentence.', keys: 'speed pause highlight jump seconds reader text size word timing reproducción velocidad pausa saltos lector texto' },
  { anchor: 'set-bubble', title: 'Floating player', sub: 'A small λ that floats over your other apps.', keys: 'bubble floating overlay size transparency opacity alpha panel clipboard dim idle burbuja flotante reproductor tamaño transparencia opacidad portapapeles' },
  { anchor: 'set-card-appearance', title: 'Appearance', sub: 'The light of the room.', keys: 'theme dark light system legacy mode tron cyberpunk apariencia tema oscuro claro' },
  { anchor: 'set-card-language', title: 'Language', sub: 'The app’s own words — everything on screen.', keys: 'english español spanish idioma lenguaje inglés' },
  { anchor: 'set-presentations', title: 'Presentations', sub: 'Learn the whole app, guided, at your pace', keys: 'lessons tour guided learn presentaciones lecciones aprender guía' },
  { anchor: 'set-backup', title: 'Backup', sub: 'Your books, marks, dictionary and settings in one file', keys: 'export import file copy clips library copia respaldo exportar importar archivo biblioteca' },
  { anchor: 'set-about', title: 'About Logos', sub: 'Version 1.4.265 · private, on-device text-to-speech', keys: 'version about acerca versión' },
]

function StageSettings({ scenario }: { scenario: Scenario }) {
  const st = scenario.getSettings()
  const pron = scenario.pronounce.list()
  const ui = useStore(stageUi)
  const [query, setQuery] = useState('')
  const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  const hits = useMemo(() => {
    const terms = norm(query).split(/\s+/).filter((x) => x.length >= 2)
    if (!terms.length) return []
    return STAGE_SETTING_INDEX.filter((e) => {
      const hay = norm(`${e.title} ${e.sub} ${e.keys}`)
      return terms.every((term) => hay.includes(term))
    })
  }, [query])
  const land = (anchor: string) => {
    setQuery('')
    // As the real search does since 1.4.246: seat the owning tray
    // first, then land on the card.
    const owner = trayForAnchor(anchor)
    if (owner) stagePatch({ settingsTray: owner })
    window.setTimeout(() => document.querySelector(`[data-present="${anchor}"]`)?.scrollIntoView({ block: 'start' }), 90)
  }
  return (
    <div data-stage-ldtray data-ldtray={ui.settingsTray}>
      <div className="pstage-eyebrow" data-present="set-page-head">● SETTINGS</div>
      <h2 className="pstage-title">Settings</h2>

      <div className="set-search">
        <div className="field-label"><span>Search settings</span></div>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Try “voice”, “bubble”, “backup”…"
          aria-label="Search settings"
          style={{ width: '100%', height: 48, borderRadius: 14, border: '1px solid var(--line)', background: 'var(--surface)', padding: '0 14px', outline: 'none' }}
        />
        {query.trim().length >= 2 && hits.length === 0 && (
          <p className="pstage-note" style={{ margin: '10px 4px 0' }}>Nothing in Settings matches that yet.</p>
        )}
        {hits.map((e) => (
          <button key={e.anchor} type="button" className="set-search-hit" onClick={() => land(e.anchor)}>
            <span className="pstage-grow" style={{ minWidth: 0 }}>
              <span style={{ fontWeight: 650, display: 'block' }}>{e.title}</span>
              <span className="pstage-note" style={{ display: 'block' }}>{e.sub}</span>
            </span>
            <ChevronRight size={17} />
          </button>
        ))}
      </div>

      <div className="pstage-ld-nav">
        {STAGE_TRAYS.map((tr) => (
          <button key={tr.id} type="button" className="pstage-ld-row" data-tray={tr.id} onClick={() => stagePatch({ settingsTray: tr.id })}>
            <span className="pstage-ld-name">{tr.name}</span>
            <span className="pstage-ld-line">{tr.line}</span>
          </button>
        ))}
      </div>

      <div className="set-cluster" data-tray="voice">
        <div className="set-cluster-h">
          <div className="set-cluster-name">The voice</div>
          <div className="set-cluster-line">The voice that reads to you, and how it says your words.</div>
        </div>

        <div className="pstage-card" data-present="set-neural">
          <strong>Neural voice</strong>
          <p className="pstage-note">The reading voice — it lives on this device, downloads once, then works offline.</p>
          <p className="pstage-note" data-present="set-neural-status">Ready — the voice lives on this device.</p>
          <div className="pstage-scrub" data-present="set-neural-meter"><div className="pstage-scrub-fill" style={{ width: '100%' }} /></div>
          <div className="pstage-chips">
            <button type="button" className="pstage-chip" data-present="set-neural-download">Download</button>
            <button type="button" className="pstage-chip" data-present="set-neural-delete">Delete the voice</button>
          </div>
          <div className="pstage-row"><span data-present="set-auto-download">Download on Wi-Fi only</span><span className="pstage-grow" /><span>On</span></div>
          <div className="pstage-row"><span data-present="set-device-bridge">This device</span><span className="pstage-grow" /><span>Connected</span></div>
          <div className="pstage-row"><span data-present="set-storage-row">Storage</span><span className="pstage-grow" /><span>412 MB</span></div>
          <p className="pstage-note" data-present="set-storage-note">Books and audio live here, on the device.</p>
          <p className="pstage-note" data-present="set-storage-protect">Protected copies stay until you remove them.</p>
        </div>

        <div className="pstage-card" data-present="set-pron">
          <strong>Pronunciation</strong>
          <p className="pstage-note">Words said your way — names, places, terms of art.</p>
          <div className="pstage-row"><span data-present="set-pron-scope">Applies to</span><span className="pstage-grow" /><span>Every voice</span></div>
          <div className="pstage-searchrow">
            <input data-present="set-pron-from" placeholder="Word in the book" />
            <input data-present="set-pron-to" placeholder="Say it this way" />
            <button type="button" className="pstage-chip accent" data-present="set-pron-add">Add</button>
          </div>
          {pron.map((p, i) => (
            <div key={i} className="pstage-row" data-present="set-pron-entry">
              <span>{p.from} → {p.to}</span><span className="pstage-grow" />
              <button type="button" className="pstage-iconbtn" data-present="set-pron-remove" aria-label="Remove"><X size={14} /></button>
            </div>
          ))}
        </div>
      </div>

      <div className="set-cluster" data-tray="listening">
        <div className="set-cluster-h">
          <div className="set-cluster-name">Listening</div>
          <div className="set-cluster-line">How listening feels — here, and floating over your other apps.</div>
        </div>

        <div className="pstage-card" data-present="set-playback">
          <strong>Playback</strong>
          <p className="pstage-note">How listening feels, sentence by sentence.</p>
          <div className="pstage-row"><span data-present="set-speed">Listening speed</span><span className="pstage-grow" /><span>{st.listenSpeed}×</span></div>
          <div className="pstage-row"><span data-present="set-sentence-pause">Pause between sentences</span><span className="pstage-grow" /><span>0.4 s</span></div>
          <div className="pstage-row"><span data-present="set-highlight">Highlight the sentence</span><span className="pstage-grow" /><span>On</span></div>
          <div className="pstage-row"><span data-present="set-reader-size">Reader size</span><span className="pstage-grow" />
            <button type="button" className="pstage-iconbtn" data-present="set-reader-size-minus">−</button>
            <button type="button" className="pstage-iconbtn" data-present="set-reader-size-reset">A</button>
            <button type="button" className="pstage-iconbtn" data-present="set-reader-size-plus">+</button>
          </div>
          <div className="pstage-row"><span data-present="set-word-timing">Word timing</span><span className="pstage-grow" />
            <button type="button" className="pstage-iconbtn" data-present="set-word-timing-minus">−</button>
            <button type="button" className="pstage-iconbtn" data-present="set-word-timing-reset">0</button>
            <button type="button" className="pstage-iconbtn" data-present="set-word-timing-plus">+</button>
          </div>
        </div>

        <div className="pstage-card" data-present="set-bubble">
          <strong>Floating player</strong>
          <p className="pstage-note" data-present="set-bubble-desc">A small λ that floats over your other apps.</p>
          <div className="pstage-row">
            <span data-present="set-bubble-switch">Bubble</span><span className="pstage-grow" />
            <span className={st.bubbleOn ? 'pstage-pill on' : 'pstage-pill'}>{st.bubbleOn ? 'On' : 'Off'}</span>
          </div>
          <div className="pstage-row"><span data-present="set-bubble-auto">Play what I copy</span><span className="pstage-grow" /><span>{st.bubbleAuto ? 'On' : 'Off'}</span></div>
          <div className="pstage-row"><span data-present="set-bubble-text">Show the words</span><span className="pstage-grow" /><span>{st.bubbleText ? 'On' : 'Off'}</span></div>
          <p className="pstage-note" data-present="set-bubble-last">Last clipboard try: the harbour text</p>
          <p className="pstage-note" data-present="set-bubble-journal">Stage moves: panel opened · played</p>
        </div>
      </div>

      <div className="set-cluster" data-tray="screen">
        <div className="set-cluster-h">
          <div className="set-cluster-name">The screen</div>
          <div className="set-cluster-line">How Logos looks, and the language it speaks.</div>
        </div>

        <div className="pstage-card" data-present="set-card-appearance">
          <strong>Appearance</strong>
          <p className="pstage-note">The light of the room.</p>
          <div className="pstage-row"><span>Legacy</span><span className="pstage-grow" /><span className="pstage-note">Charcoal and gold — the original.</span></div>
          <div className="pstage-row"><span>Tron</span><span className="pstage-grow" /><span className="pstage-note">Light lines on the deep black of the Grid.</span></div>
          <div className="pstage-row"><span>Cyberpunk</span><span className="pstage-grow" /><span className="pstage-note">Signal yellow print on warm black.</span></div>
          <div className="pstage-row"><span data-present="set-theme">Legacy mode</span><span className="pstage-grow" /><span>Dark</span></div>
        </div>

        <div className="pstage-card" data-present="set-card-language">
          <strong>Language</strong>
          <p className="pstage-note">The app’s own words — everything on screen.</p>
          <div className="pstage-row" data-present="set-ui-lang" data-lang={st.uiLang}>
            <button type="button" className="pstage-chip">English</button>
            <button type="button" className="pstage-chip">Español</button>
          </div>
        </div>
      </div>

      <div className="set-cluster" data-tray="learn">
        <div className="set-cluster-h">
          <div className="set-cluster-name">Learn</div>
          <div className="set-cluster-line">Guided lessons that walk the whole app with you.</div>
        </div>

        <div className="pstage-card" data-present="set-presentations">
          <strong>Presentations</strong>
          <p className="pstage-note">Learn the whole app, guided, at your pace</p>
        </div>
      </div>

      <div className="set-cluster" data-tray="data">
        <div className="set-cluster-h">
          <div className="set-cluster-name">Your data</div>
          <div className="set-cluster-line">Your whole library in one file — out, and back in.</div>
        </div>

        <div className="pstage-card" data-present="set-backup">
          <strong>Backup</strong>
          <p className="pstage-note">Your books, marks, dictionary and settings in one file</p>
          <div className="pstage-chips">
            <button type="button" className="pstage-chip" data-present="set-backup-export">Export</button>
            <button type="button" className="pstage-chip" data-present="set-backup-import">Import</button>
          </div>
          <p className="pstage-note">Your Library clips are inside too — the saved texts and the audio alike.</p>
        </div>
      </div>

      <div className="pstage-card" data-present="set-about" data-tray="data">
        <strong>About Logos</strong>
        <p className="pstage-note">Version 1.4.265 · private, on-device text-to-speech</p>
        <p className="pstage-note" data-present="set-version">Version 1.4.265</p>
      </div>
    </div>
  )
}

// ── The bubble over a fiction phone ───────────────────────────────
function StageBubble({ scenario }: { scenario: Scenario }) {
  const session = scenario.stage.session()
  const sentences = useMemo(() => sentencesOf(session?.text ?? ''), [session?.text])
  const [playing, setPlaying] = useState(!!session?.playing)
  useEffect(() => { setPlaying(!!session?.playing) }, [session?.playing, session?.textId])
  const idx = Math.min(session?.idx ?? 0, Math.max(0, sentences.length - 1))
  return (
    <div className="pstage-phone">
      <div className="pstage-phone-lines"><span /><span /><span /></div>
      <div className="pstage-orb" data-present="bubble-stage-orb">
        <span>λ</span>
      </div>
      <div className="pstage-panel" data-present="bubble-stage-panel">
        <div className="pstage-panel-grip" data-present="bubble-stage-grip" />
        <div className="pstage-panel-words" data-present="bubble-stage-words">
          {sentences.length ? sentences[idx] : 'The words being read appear here.'}
        </div>
        <div className="pstage-scrub" data-present="bubble-seek">
          <div className="pstage-scrub-fill" style={{ width: sentences.length ? `${((idx + 1) / sentences.length) * 100}%` : '0%' }} />
        </div>
        <div className="pstage-panel-row">
          <span className="pstage-meta" data-present="bubble-speed">1×</span>
          <button type="button" className="pstage-key" data-present="bubble-prev" aria-label="Previous"><SkipBack size={18} /></button>
          <button type="button" className="pstage-play sm" data-present="bubble-play" aria-label="Play or pause">
            {playing ? <Pause size={22} /> : <Play size={22} />}
          </button>
          <button type="button" className="pstage-key" data-present="bubble-next" aria-label="Next">
            <SkipForward size={18} />
          </button>
          <span className="pstage-meta" data-present="bubble-panel-state">{playing ? 'Playing' : 'Paused'}</span>
        </div>
        <div className="pstage-panel-foot">
          <span data-present="bubble-stage-lock">Auto</span>
          <span data-present="bubble-stage-eye">Words</span>
          <span data-present="bubble-save">Save</span>
          <span data-present="bubble-mark">Mark</span>
          <span data-present="bubble-listen-visit">Open Logos</span>
        </div>
      </div>
    </div>
  )
}
