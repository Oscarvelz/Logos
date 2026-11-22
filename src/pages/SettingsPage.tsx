import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { exportBackup, importBackup, BackupImportError } from '../lib/backup.ts'
import { Check, ChevronDown, ChevronRight, Cpu, Download, HardDrive, Languages, Loader2, Mic, Palette, PictureInPicture2, Plus, SlidersHorizontal, Trash2, X } from 'lucide-react'
import { t } from '../lib/i18n.ts'
import { useStore } from '../lib/store.ts'
import { settings, applyTheme, READER_SCALES, stepReaderScale, type Theme, type LegacyTheme } from '../lib/settings.ts'
import { bubbleSupported, bubbleNativeState, setBubble, openBubblePermission, type BubbleNativeState } from '../lib/bubble.ts'
import { keep } from '../engine/keep.ts'
import { engine, ensureModel, deleteModel, storageEstimate, POCKET_SIZE_MB, PHONON_SIZE_MB, modelCacheBytes } from '../engine/engine.ts'
import { formatBytes } from '../lib/audio.ts'
import { Range, Seg, Switch, toast, confirmDelete } from '../components/ui.tsx'
import { endSession } from '../player/listen.ts'
import { PresentationsCard } from '../lib/presentation/presentation-index.tsx'
import { PresentationSearch } from '../lib/presentation-search.tsx'
import { launchPresentation } from '../lib/presentation-host.tsx'
import { pronEntries, savePronEntries, type PronEntry } from '../lib/pronounce.ts'

const VERSION = '1.4.223'

/** Running inside the Logos Android app (its WebView has no browser voices, and its storage is the app's own). */
const IN_APP = /LogosAndroid/.test(navigator.userAgent)

/**
 * 1.4.62: one card per topic, each with its icon — Settings used to scatter
 * (a label floating over a card here, a bare list there). Now everything a
 * topic owns lives inside its card, under a header that says what it holds,
 * so the eye finds things by their icons.
 */
/** The library's safety net: export one file with the books, marks, dictionary
 * and settings; import it on a new phone and everything is home again. */
function BackupCard() {
  const [busy, setBusy] = useState('')
  const file = useRef<HTMLInputElement>(null)
  const run = async () => {
    setBusy('out')
    try { const r = await exportBackup(); const base = r.books === 1 ? t('Backup saved · 1 book inside') : t('Backup saved · {n} books inside', { n: r.books }); const leftOut = [r.skipped ? t('· {s} left out — their text is missing on this phone', { s: r.skipped }) : '', r.clipsSkipped ? t('· {s} Library items left out — their records are missing on this phone', { s: r.clipsSkipped }) : '', r.clipsNoAudio ? t('· {s} Library items left out — their audio is missing on this phone', { s: r.clipsNoAudio }) : '', r.clipsUnencoded ? t('· {s} Library items left out — their audio could not be written into the file', { s: r.clipsUnencoded }) : ''].filter(Boolean).join(' '); toast(leftOut ? `${base} ${leftOut}` : base) }
    catch { toast(t('The backup could not be made')) }
    setBusy('')
  }
  const onFile = async (f: File | undefined) => {
    if (!f) return
    setBusy('in')
    try {
      const r = await importBackup(f)
      const msg = r.books === 1 ? t('Restored · 1 book back on the shelf') : t('Restored · {n} books back on the shelf', { n: r.books })
      // The merge rule, reported where it fired (F7): a book, a
      // pronunciation or a draft this phone kept over the backup's
      // older state is named in the toast, never silently kept.
      const notes: string[] = []
      if (r.keptNewer === 1) notes.push(t('1 book was already further along on this phone — its place was kept'))
      else if (r.keptNewer > 1) notes.push(t('{k} books were already further along on this phone — their places were kept', { k: r.keptNewer }))
      if (r.pronKept === 1) notes.push(t('1 pronunciation kept this phone’s newer reading'))
      else if (r.pronKept > 1) notes.push(t('{k} pronunciations kept this phone’s newer readings', { k: r.pronKept }))
      if (r.draft === 'kept') notes.push(t('The Listen text on this phone was kept — the backup’s draft did not replace it'))
      // Every stage speaks (R2-T5-3): the clips and marks that landed
      // were computed but never told, and a book the deletion record
      // suppressed was skipped with no count anywhere — a reader
      // re-importing an old file to fetch a deleted book back heard
      // only the restored count and none of the reason.
      if (r.skippedDeleted === 1) notes.push(t('1 book in the file was not restored — it stands deleted'))
      else if (r.skippedDeleted > 1) notes.push(t('{k} books in the file were not restored — they stand deleted', { k: r.skippedDeleted }))
      if (r.clips === 1) notes.push(t('1 Library item came with it'))
      else if (r.clips > 1) notes.push(t('{n} Library items came with it', { n: r.clips }))
      if (r.marks === 1) notes.push(t('1 mark landed'))
      else if (r.marks > 1) notes.push(t('{n} marks landed', { n: r.marks }))
      // Room at the cap is made by pushing the phone's own oldest
      // marks out — a loss this import caused, told like every other
      // (cure R3-T5-5).
      if (r.marksEvicted === 1) notes.push(t('1 of this phone’s marks was pushed out to make room — the list keeps the newest 120'))
      else if (r.marksEvicted > 1) notes.push(t('{n} of this phone’s marks were pushed out to make room — the list keeps the newest 120', { n: r.marksEvicted }))
      // The withheld reason is the case that actually happened: a
      // list of ghosts, or a list that was simply empty — the empty
      // case is stated as the safety rule it is, never as ghosts
      // (cure R3-T5-7).
      if (r.favoritesKept) notes.push(r.favoritesKeptReason === 'empty' ? t('Your favorites were kept — the backup’s list was empty, and an empty list never clears this phone’s stars') : t('Your favorites were kept — the backup’s list named voices this phone no longer has'))
      toast(notes.length ? `${msg} · ${notes.join(' · ')}` : msg)
    }
    // A BackupImportError carries its true reason (a damaged book, a
    // newer-version file, a restore that stopped and rolled back) —
    // it is shown as written; only an unexpected failure falls back
    // to the generic line (F6).
    catch (e) { toast(e instanceof BackupImportError ? e.message : t('That file is not a Logos backup')) }
    setBusy('')
    if (file.current) file.current.value = ''
  }
  return (
    <SetCard present="set-backup" icon={<HardDrive size={19} />} title={t('Backup')} sub={t('Your books, marks, dictionary and settings in one file')}>
      <div className="set-actions">
        <button className="btn" data-present="set-backup-export" onClick={() => void run()} disabled={!!busy}>{busy === 'out' ? <Loader2 size={15} className="spin" /> : <Download size={15} />} {t('Export backup')}</button>
        <button className="btn ghost" data-present="set-backup-import" onClick={() => file.current?.click()} disabled={!!busy}>{busy === 'in' ? <Loader2 size={15} className="spin" /> : <Plus size={15} />} {t('Import backup')}</button>
        <input ref={file} type="file" accept=".json,application/json" hidden onChange={(e) => void onFile(e.target.files?.[0])} />
      </div>
      <p className="muted small" style={{ margin: '8px 0 0' }}>{t('Your Library clips are inside too — the saved texts and the audio alike. Importing fills in what this phone is missing — it never rewinds a book you have read further here.')}</p>
    </SetCard>
  )
}

function SetCard({ icon, title, sub, children, defaultOpen, present }: { icon: ReactNode; title: string; sub: string; children: ReactNode; defaultOpen?: boolean; present?: string }) {
  // The cards fold (Oscar, 2026-11-10): a Settings page that opens as
  // a tidy index of headers, each unfolding at a tap. The voice
  // engine's card arrives open only while it still has something to
  // ask of him — a download to offer, a progress to watch, an error
  // to answer; once the model is downloaded it presents folded
  // like every other card (Oscar, 2026-11-14).
  const [open, setOpen] = useState(!!defaultOpen)
  return (
    <div className={"card set-card" + (open ? " open" : "")} data-present={present}>
      <button className="set-card-h" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <span className="set-ic">{icon}</span>
        <div className="grow">
          <div className="set-card-t">{title}</div>
          <div className="set-card-s">{sub}</div>
        </div>
        <ChevronDown size={18} className="set-chev" />
      </button>
      <div className={"set-fold" + (open ? " open" : "")}>
        <div className="set-fold-in">{children}</div>
      </div>
    </div>
  )
}

/** A Settings cluster (the house pattern, born in Vela, consecrated
 *  by Oscar 2026-11-15): a sunken tray grouping the cards by
 *  territory — the user's mind, not the machinery. The cards inside
 *  keep their content, anchors and order within the tray; the tray
 *  itself is painted from the active theme's tokens under the
 *  Calibration Law (one tone under the page, the 1px edge stack). */
function SetCluster({ name, line, children }: { name: string; line: string; children: ReactNode }) {
  return (
    <div className="set-cluster">
      <div className="set-cluster-h">
        <div className="set-cluster-name">{name}</div>
        <div className="set-cluster-line">{line}</div>
      </div>
      {children}
    </div>
  )
}

// ── The Settings search (1.4.177, Oscar) ────────────────────────
// A general search at the very top of the page, in the same field
// grammar as the lesson search — which in this same wave moved
// inside Presentations, at his word: a search lives with what it
// searches. A result here names its card; tapping it opens that
// card where it lives and scrolls it into view. The search opens
// the result's home; it never paints a copy of the setting here.
// Honesty rule for this index (M-30 cure, 2026-11-15): every entry's
// title and sub are the target card's OWN title and sub, copied
// verbatim, and every anchor is a data-present id that exists on
// this page — an entry that names a section differently than the
// section names itself, or lands nowhere, is a lie the search tells
// at the top of the page. `keys` names the ROWS inside the card, so
// a search for a control ("transparency", "storage", "reader") finds
// the card that holds it; those three words provably found nothing
// before this cure, against controls sitting one fold away.
const SETTING_INDEX: { anchor: string; title: string; sub: string; keys: string }[] = [
  { anchor: 'set-neural', title: 'Neural voice', sub: 'The reading voice — it lives on this device, downloads once, then works offline.', keys: 'voice engine download model storage protect protected cleanup delete offline voz neuronal descargar motor almacenamiento proteger' },
  { anchor: 'set-pron', title: 'Pronunciation', sub: 'Words said your way — names, places, terms of art.', keys: 'pronounce names words say dictionary say it your way pronunciación nombres palabras diccionario' },
  { anchor: 'set-playback', title: 'Playback', sub: 'How listening feels, sentence by sentence.', keys: 'speed pause highlight jump seconds reader text size word timing reproducción velocidad pausa saltos lector texto' },
  { anchor: 'set-bubble', title: 'Floating player', sub: 'A small λ that floats over your other apps.', keys: 'bubble floating overlay size transparency opacity alpha panel clipboard dim idle burbuja flotante reproductor tamaño transparencia opacidad portapapeles' },
  { anchor: 'set-card-appearance', title: 'Appearance', sub: 'The light of the room.', keys: 'theme dark light system legacy mode tron cyberpunk apariencia tema oscuro claro' },
  { anchor: 'set-card-language', title: 'Language', sub: 'The app’s own words — everything on screen.', keys: 'english español spanish idioma lenguaje inglés' },
  { anchor: 'set-presentations', title: 'Presentations', sub: 'Learn the whole app, guided, at your pace', keys: 'lessons tour guided learn presentaciones lecciones aprender guía' },
  { anchor: 'set-backup', title: 'Backup', sub: 'Your books, marks, dictionary and settings in one file', keys: 'export import file copy clips library copia respaldo exportar importar archivo biblioteca' },
  { anchor: 'set-about', title: 'About Logos', sub: 'Version {v} · private, on-device text-to-speech', keys: 'version about acerca versión' },
]

function SettingsSearch() {
  const [query, setQuery] = useState('')
  const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  const hits = useMemo(() => {
    const terms = norm(query).split(/\s+/).filter((x) => x.length >= 2)
    if (!terms.length) return []
    return SETTING_INDEX.filter((e) => {
      const hay = norm(`${e.title} ${e.sub} ${e.keys} ${t(e.title)} ${t(e.sub, { v: VERSION })}`)
      return terms.every((term) => hay.includes(term))
    })
  }, [query])
  const land = (anchor: string) => {
    setQuery('')
    const root = document.querySelector(`[data-present="${anchor}"]`)
    if (!root) return
    const head = root.querySelector<HTMLElement>('.set-card-h[aria-expanded="false"]')
    if (head) head.click()
    window.setTimeout(() => root.scrollIntoView({ block: 'start', behavior: 'smooth' }), 60)
    window.setTimeout(() => root.scrollIntoView({ block: 'start', behavior: 'smooth' }), 480)
  }
  return (
    <div className="set-search">
      <div className="field-label"><span>{t('Search settings')}</span></div>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t('Try “voice”, “bubble”, “backup”…')}
        aria-label={t('Search settings')}
        style={{ width: '100%', height: 48, borderRadius: 14, border: '1px solid var(--line)', background: 'var(--surface)', padding: '0 14px', outline: 'none' }}
      />
      {query.trim().length >= 2 && hits.length === 0 && (
        <p className="muted small" style={{ margin: '10px 4px 0' }}>{t('Nothing in Settings matches that yet.')}</p>
      )}
      {hits.map((e) => (
        <button key={e.anchor} className="set-search-hit" onClick={() => land(e.anchor)}>
          <span className="grow" style={{ minWidth: 0 }}>
            <span style={{ fontWeight: 650, display: 'block' }}>{t(e.title)}</span>
            <span className="muted small" style={{ display: 'block' }}>{t(e.sub, { v: VERSION })}</span>
          </span>
          <ChevronRight size={17} className="set-chev" />
        </button>
      ))}
    </div>
  )
}

export function SettingsPage() {
  const st = useStore(settings)
  const e = useStore(engine)
  const [usage, setUsage] = useState<{ quota: number; usage: number } | null>(null)
  const [persisted, setPersisted] = useState<boolean | null>(null)
  const kn = useStore(keep)
  const [modelBytes, setModelBytes] = useState(0)
  const refresh = () => { void storageEstimate().then(setUsage); void modelCacheBytes().then(setModelBytes) }
  useEffect(() => {
    refresh()
    void navigator.storage?.persisted?.().then(setPersisted)
    // The model is written to the cache just after it reports ready.
    const t = e.status === 'ready' ? setTimeout(refresh, 6000) : 0
    return () => clearTimeout(t)
  }, [e.status])

  const warming = e.status === 'loading' && e.phase === 'warm'

  // The floating bubble's native truth (permission + service), refreshed while
  // this page is open so returning from the system's permission screen lands.
  // 1.4.64: the switch answers the finger instantly (optimistic) instead of
  // waiting for the next poll to agree, and the poll only re-renders on change.
  const [bState, setBState] = useState<BubbleNativeState | null>(null)
  const [bubbleUi, setBubbleUi] = useState<boolean | null>(null)
  useEffect(() => {
    if (!bubbleSupported()) return
    const tick = () => {
      const n = bubbleNativeState()
      setBState((p) => (JSON.stringify(p) === JSON.stringify(n) ? p : n))
    }
    tick()
    const iv = setInterval(tick, 1200)
    document.addEventListener('visibilitychange', tick)
    return () => { clearInterval(iv); document.removeEventListener('visibilitychange', tick) }
  }, [])
  useEffect(() => {
    if (bubbleUi !== null && bState && bState.running === bubbleUi) setBubbleUi(null)
  }, [bState, bubbleUi])
  const [pron, setPron] = useState<PronEntry[]>(() => pronEntries())
  const [pFrom, setPFrom] = useState('')
  const [pTo, setPTo] = useState('')
  const [pLang, setPLang] = useState<'en' | 'es'>(() => settings.get().uiLang)
  const savePron = (list: PronEntry[]) => { setPron(list); savePronEntries(list) }
  const addPron = () => {
    const from = pFrom.trim()
    const to = pTo.trim()
    if (!from || !to) return
    // An entry is born WITH its language (R3-T7-1), and adding one
    // replaces only the entry for the same word in the SAME language.
    // The old filter keyed on the word alone: adding an English
    // reading silently deleted the word's Spanish twin and left a
    // single unscoped entry behind — which then fired in both
    // languages (R3-T7-3), so "pan" fixed for English rewrote the
    // Spanish for bread. The language is chosen in the form below,
    // starting from the app's own language.
    savePron([...pron.filter((x) => !(x.from.toLowerCase() === from.toLowerCase() && x.lang === pLang)), { from, to, lang: pLang }])
    setPFrom(''); setPTo('')
    toast(t('“{from}” will be read as “{to}”', { from, to }))
  }

  return (
    <div className="page settings-page">
      <div className="page-head" data-present="set-page-head">
        <div>
          <h1 className="page-title">{t('Settings')}</h1>
          <p className="page-sub">{t('Everything runs on this device. No account, no cloud.')}</p>
        </div>
      </div>

      <SettingsSearch />

      <div className="set-cols">
      <SetCluster name={t('The voice')} line={t('The voice that reads to you, and how it says your words.')}>
      <section className="set-group">
      <SetCard present="set-neural" defaultOpen={e.status === 'loading' || e.status === 'error' || (e.status !== 'ready' && !e.cached)} icon={<Cpu size={19} />} title={t('Neural voice')} sub={t('The reading voice — it lives on this device, downloads once, then works offline.')}>
      <div className="engine-card stack">
        <div className="row between" data-present="set-neural-status">
          <div>
            <div className="big">{e.status === 'ready' || warming ? t('Ready') : e.status === 'loading' ? t('Downloading') : e.status === 'error' ? t('Needs attention') : e.cached ? t('Downloaded') : t('Not downloaded')}</div>
            <div className="muted small" style={{ marginTop: 4 }}>
              {warming
                ? t('On this device · loading into memory in the background')
                : e.status === 'ready'
                  ? `${e.kind === 'phonon' ? 'Phonon by Gradium' : 'PocketTTS by Kyutai'} · ${t(e.lang === 'es' ? 'Spanish' : 'English')}${e.lastRtf ? t(' · {x}× real-time', { x: (1 / e.lastRtf).toFixed(1) }) : ''}`
                  : e.kind === 'phonon'
                    ? t('Phonon by Gradium · ~{n} MB for English and Spanish, then offline', { n: PHONON_SIZE_MB })
                    : t('PocketTTS by Kyutai · ~{n} MB per language, then offline', { n: POCKET_SIZE_MB })}
            </div>
          </div>
        </div>
        {e.status === 'loading' && !warming && (
          <div data-present="set-neural-meter">
            <div className="meter"><i style={{ width: `${Math.round(e.progress * 100)}%` }} /></div>
            <div className="row between small muted mono" style={{ marginTop: 6 }}><span>{t('{a} of {b}', { a: formatBytes(e.loaded), b: e.total ? formatBytes(e.total) : '…' })}</span><span>{Math.round(e.progress * 100)}%</span></div>
          </div>
        )}
        {e.status === 'error' && <div className="error-note" data-present="set-neural-error">{e.error}</div>}
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          {e.status !== 'ready' && !warming && (
            <button className="btn primary" data-present="set-neural-download" onClick={() => ensureModel().then(() => toast(t('Neural voice ready — works offline now'))).catch((err) => toast((err as Error).message))} disabled={e.status === 'loading'}>
              {e.status === 'loading' ? <Loader2 size={18} className="spin" /> : <Download size={18} />} {e.cached ? t('Load now') : t('Download now')}
            </button>
          )}
          <button className="btn danger" data-present="set-neural-delete" onClick={async () => { if (!await confirmDelete(t('Delete the voice model?'), t('The downloaded neural voice will be removed from this device. You can download it again whenever you want.'))) return; endSession(); await deleteModel(); refresh(); toast(t('Voice model removed from this device')) }} disabled={e.status === 'loading' || (!modelBytes && !e.cached)}>
            <Trash2 size={18} /> {t('Delete model')}
          </button>
        </div>
      </div>
      <div className="set-div" />
      <div className="list">
        <div className="list-row" data-present="set-storage-row">
          <HardDrive size={20} className="muted" />
          <div className="grow">
            <div className="t">{t('Storage')}</div>
            <div className="d" data-present="set-storage-note">{t('Voice models {x}', { x: formatBytes(modelBytes) })}{usage?.quota ? t(' · {u} of {q} used', { u: formatBytes(usage.usage), q: formatBytes(usage.quota) }) : ''}</div>
            {IN_APP ? <div className="d" data-present="set-storage-protect">{t('Kept inside the Logos app. Only clearing Logos’s own data removes it.')}</div>
              : persisted !== null && <div className="d" data-present="set-storage-protect">{persisted ? t('Protected from automatic cleanup') : t('Not protected: the phone may clear the voice')}</div>}
            {kn.notes.map((n) => <div key={`${n.engine}.${n.lang}`} className="d" style={{ color: 'var(--accent)' }}>{n.kind === 'cleared'
              ? t('The phone cleared the saved {eng} voice (noticed {when}).', { eng: n.engine === 'pocket' ? 'Pocket' : 'Phonon', when: new Date(n.at).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) })
              : t('The {eng} voice loaded but couldn’t be saved on this phone.', { eng: n.engine === 'pocket' ? 'Pocket' : 'Phonon' })}</div>)}
          </div>
          {!IN_APP && persisted === false && <button className="btn sm" onClick={async () => { const ok = await navigator.storage?.persist?.(); setPersisted(Boolean(ok)); toast(ok ? t('Storage protected from automatic cleanup') : t('The browser declined — install the app to keep storage')) }}>{t('Protect')}</button>}
        </div>
        <div className="list-row" data-present="set-auto-download">
          <div className="grow"><div className="t">{t('Download on first play')}</div><div className="d">{t('Fetch the neural voice automatically the first time you press play.')}</div></div>
          <Switch label={t('Download on first play')} on={st.autoDownload} onChange={(v) => settings.set({ autoDownload: v })} />
        </div>
        {!IN_APP && (
        <div className="list-row" data-present="set-device-bridge">
          <div className="grow"><div className="t">{t('Device voice bridge')}</div><div className="d">{t('Speak instantly with your phone’s built-in voice while the neural model downloads.')}</div></div>
          <Switch label={t('Device voice bridge')} on={st.deviceFallback} onChange={(v) => settings.set({ deviceFallback: v })} />
        </div>
        )}
      </div>
      </SetCard>
      </section>
      <section className="set-group">
      <SetCard present="set-pron" icon={<Mic size={19} />} title={t('Pronunciation')} sub={t('Words said your way — names, places, terms of art.')}>
      <div className="list">
        <div className="list-row col">
          <div className="grow"><div className="t">{t('Say it your way')}</div><div className="d" data-present="set-pron-scope">{t('Applies to listening and to exported audio, in every book — each entry in the language you give it. Codes and links are already named, not spelled out.')}</div></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
            <input className="text-input" data-present="set-pron-from" style={{ height: 44, width: '100%' }} placeholder={t('Word in the book')} value={pFrom} onChange={(e) => setPFrom(e.target.value)} />
            <div className="row" style={{ gap: 8, alignItems: 'center' }}>
              <span className="d">{t('Language')}</span>
              <Seg present="set-pron-lang" presentLang={st.uiLang} value={pLang} label={t('Language')} onChange={(v: 'en' | 'es') => setPLang(v)} options={[{ value: 'en', label: 'English' }, { value: 'es', label: 'Español' }]} />
            </div>
            <div className="row" style={{ gap: 8 }}>
              <input className="text-input" data-present="set-pron-to" style={{ height: 44, flex: 1, minWidth: 0, width: 'auto' }} placeholder={t('Say it as')} value={pTo} onChange={(e) => setPTo(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') addPron() }} />
              <button className="btn primary" data-present="set-pron-add" onClick={addPron} disabled={!pFrom.trim() || !pTo.trim()}><Plus size={17} /> {t('Add')}</button>
            </div>
          </div>
        </div>
        {pron.map((e, i) => (
          <div className="list-row" data-present="set-pron-entry" key={`${e.from.toLowerCase()}|${e.lang ?? 'all'}|${i}`}>
            <div className="grow"><div className="t">{e.from}</div><div className="d">{t('read as “{to}”', { to: e.to })} · {e.lang ? t(e.lang === 'es' ? 'Spanish' : 'English') : t('Both languages')}</div></div>
            <button className="btn sm ghost" data-present="set-pron-remove" aria-label={t('Remove {from}', { from: e.from })} onClick={() => savePron(pron.filter((x) => x !== e))}><X size={16} /></button>
          </div>
        ))}
      </div>
      </SetCard>
      </section>
      </SetCluster>
      <SetCluster name={t('Listening')} line={t('How listening feels — here, and floating over your other apps.')}>
      <section className="set-group">
      <SetCard present="set-playback" icon={<SlidersHorizontal size={19} />} title={t('Playback')} sub={t('How listening feels, sentence by sentence.')}>
      <div className="list">
        <div className="list-row col" data-present="set-speed">
          <div className="row between"><div className="t">{t('Listening speed')}</div><span className="mono muted">{st.listenSpeed.toFixed(2)}×</span></div>
          <Range guarded label={t('Listening speed')} min={0.5} max={2.5} step={0.05} value={st.listenSpeed} onChange={(v) => settings.set({ listenSpeed: v })} />
        </div>
        <div className="list-row col" data-present="set-sentence-pause">
          <div className="row between"><div className="t">{t('Pause between sentences')}</div><span className="mono muted">{st.sentencePauseMs} ms</span></div>
          <Range guarded label={t('Pause between sentences')} min={0} max={800} step={20} value={st.sentencePauseMs} onChange={(v) => settings.set({ sentencePauseMs: v })} />
        </div>
        <div className="list-row">
          <div className="grow"><div className="t">{t('Jump back')}</div><div className="d">{t('The rewind key leaps this far, in seconds — across sentences, not by line.')}</div></div>
          <input className="text-input mono" type="number" min={1} max={600} step={1} style={{ height: 40, width: 76, textAlign: 'center' }} aria-label={t('Jump back, seconds')} value={st.jumpBackSec}
            onChange={(e) => { const v = Math.round(Number(e.target.value)); if (Number.isFinite(v)) settings.set({ jumpBackSec: Math.min(600, Math.max(1, v)) }) }} />
        </div>
        <div className="list-row">
          <div className="grow"><div className="t">{t('Jump forward')}</div><div className="d">{t('The forward key leaps this far, in seconds.')}</div></div>
          <input className="text-input mono" type="number" min={1} max={600} step={1} style={{ height: 40, width: 76, textAlign: 'center' }} aria-label={t('Jump forward, seconds')} value={st.jumpFwdSec}
            onChange={(e) => { const v = Math.round(Number(e.target.value)); if (Number.isFinite(v)) settings.set({ jumpFwdSec: Math.min(600, Math.max(1, v)) }) }} />
        </div>
        <div className="list-row" data-present="set-highlight">
          <div className="grow"><div className="t">{t('Highlight current sentence')}</div></div>
          <Switch label={t('Highlight current sentence')} on={st.highlight} onChange={(v) => settings.set({ highlight: v })} />
        </div>
        <div className="list-row" data-present="set-reader-size">
          <div className="grow"><div className="t">{t('Reader text size')}</div><div className="d">{t('The Listen reading view — bigger or smaller, on phone and tablet alike.')}</div></div>
          <div className="row" style={{ gap: 6 }}>
            <button className="btn sm ghost" data-present="set-reader-size-minus" aria-label={t('Smaller text')} disabled={st.readerScale <= READER_SCALES[0]} onClick={() => settings.set({ readerScale: stepReaderScale(st.readerScale, -1) })}>−</button>
            <button className="btn sm ghost" data-present="set-reader-size-reset" aria-label={t('Reset text size')} onClick={() => settings.set({ readerScale: 1 })} style={{ minWidth: 0, padding: '0 8px', opacity: st.readerScale === 1 ? .4 : 1 }}>↺</button>
            <span className="mono muted" style={{ minWidth: 40, textAlign: 'center' }}>{Math.round(st.readerScale * 100)}%</span>
            <button className="btn sm ghost" data-present="set-reader-size-plus" aria-label={t('Bigger text')} disabled={st.readerScale >= READER_SCALES[READER_SCALES.length - 1]} onClick={() => settings.set({ readerScale: stepReaderScale(st.readerScale, 1) })}>+</button>
          </div>
        </div>
        <div className="list-row" data-present="set-word-timing">
          <div className="grow"><div className="t">{t('Word timing')}</div><div className="d">{st.wordLeadMs === 90 ? t('Tuned for the phone speaker') : st.wordLeadMs > 90 ? t('{n} ms earlier · for Bluetooth delay', { n: st.wordLeadMs - 90 }) : t('{n} ms later', { n: 90 - st.wordLeadMs })}</div></div>
          <div className="row" style={{ gap: 6 }}>
            <button className="btn sm ghost" data-present="set-word-timing-minus" aria-label={t('Highlight later')} onClick={() => settings.set({ wordLeadMs: Math.max(-150, st.wordLeadMs - 30) })}>−</button>
            <button className="btn sm ghost" data-present="set-word-timing-reset" aria-label={t('Reset word timing')} onClick={() => settings.set({ wordLeadMs: 90 })} style={{ minWidth: 0, padding: '0 8px', opacity: st.wordLeadMs === 90 ? .4 : 1 }}>↺</button>
            <button className="btn sm ghost" data-present="set-word-timing-plus" aria-label={t('Highlight earlier')} onClick={() => settings.set({ wordLeadMs: Math.min(450, st.wordLeadMs + 30) })}>+</button>
          </div>
        </div>
      </div>
      </SetCard>
      </section>
      <section className="set-group">
      <SetCard present="set-bubble" icon={<PictureInPicture2 size={19} />} title={t('Floating player')} sub={t('A small λ that floats over your other apps.')}>
      <div className="list">
        <div className="list-row" data-present="set-bubble-switch">
          <div className="grow">
            <div className="t">{t('Floating bubble')}</div>
            <div className="d" data-present="set-bubble-desc">{!IN_APP
              ? t('Only in the Logos app.')
              : !bubbleSupported()
                ? t('Comes with the newest Logos app — update the app and it appears here.')
                : bState && !bState.permission
                  ? t('Needs Android’s permission to display over other apps — switch it on to be taken there.')
                  : t('Drag it anywhere. Tap it for play, previous and next — and for what you copied.')}</div>
          </div>
          <Switch label={t('Floating bubble')} on={bubbleUi ?? (bState ? bState.running : st.bubbleOn)} onChange={(v) => {
            if (!bubbleSupported()) return
            if (v && bState && !bState.permission) { openBubblePermission(); toast(t('Allow Logos to display over other apps, then switch the bubble on again')); return }
            setBubbleUi(v)
            setBubble(v)
            setTimeout(() => setBState(bubbleNativeState()), 450)
          }} />
        </div>
        <div className="list-row" data-present="set-bubble-auto">
          <div className="grow">
            <div className="t">{t('Play the clipboard')}</div>
            <div className="d">{t('The lever. On: copy text anywhere, tap the bubble, and it plays — replacing what was playing, with an Undo so nothing is lost; opening Logos right after copying plays it too. Off: the bubble only controls playback, and pasting stays manual, as now. Android only lets Logos look at the clipboard at that tap — never in secret.')}</div>
          </div>
          <Switch label={t('Play the clipboard')} on={st.bubbleAuto} onChange={(v) => settings.set({ bubbleAuto: v })} />
        </div>
        <div className="list-row" data-present="set-copy-queue">
          <div className="grow">
            <div className="t">{t('Copy queue')}</div>
            <div className="d">{t('Copy several texts, one after another, and hear them in order — like songs in a playlist. On: each copy lines up behind the one playing instead of replacing it; when one ends, the next begins, and the next/previous keys travel the line. The whole line can be sent to Listen later in the Library. Off: the line is erased, and a copy takes the stage as always.')}</div>
          </div>
          <Switch label={t('Copy queue')} on={st.copyQueue} onChange={(v) => settings.set({ copyQueue: v })} />
        </div>
        <div className="list-row" data-present="set-bubble-text">
          <div className="grow">
            <div className="t">{t('Words in the panel')}</div>
            <div className="d">{t("The bubble's panel reads along: the sentence being read, in the open. On the tablet the panel widens and the sentences before and after ride along dimmed — a glance catches what the ear missed.")}</div>
          </div>
          <Switch label={t('Words in the panel')} on={st.bubbleText} onChange={(v) => settings.set({ bubbleText: v })} />
        </div>
        <div className="list-row col">
          <div className="row between"><div className="t">{t('Bubble transparency')}</div><span className="mono muted">{st.bubbleAlpha}%</span></div>
          <Range guarded label={t('Bubble transparency')} min={0} max={100} step={5} value={st.bubbleAlpha} onChange={(v) => settings.set({ bubbleAlpha: v })} />
        </div>
        <div className="list-row col">
          <div className="row between"><div className="t">{t('Panel transparency')}</div><span className="mono muted">{st.panelAlpha}%</span></div>
          <Range guarded label={t('Panel transparency')} min={0} max={100} step={5} value={st.panelAlpha} onChange={(v) => settings.set({ panelAlpha: v })} />
        </div>
        <div className="list-row">
          <div className="grow">
            <div className="t">{t('Dim when idle')}</div>
            <div className="d">{t('Untouched for a few seconds, the bubble fades to a whisper so it never competes with what you are doing. Off: it keeps the transparency you set, always.')}</div>
          </div>
          <Switch label={t('Dim when idle')} on={st.bubbleFade} onChange={(v) => settings.set({ bubbleFade: v })} />
        </div>
        <div className="list-row col">
          <div className="t">{t('Bubble size')}</div>
          <Seg value={st.bubbleSize} onChange={(v) => settings.set({ bubbleSize: v })} label={t('Bubble size')} options={[{ value: 's', label: t('Small') }, { value: 'm', label: t('Standard') }, { value: 'l', label: t('Large') }]} />
        </div>
      </div>
      {bState?.last ? <div className="muted small" data-present="set-bubble-last" style={{ marginTop: 10, padding: '0 4px' }}>{t('Last clipboard try: ')}{bState.last}</div> : null}
      {(() => { try { const j = JSON.parse(localStorage.getItem('logos.stage.journal') ?? '[]') as string[]; return j.length ? <div className="muted small" data-present="set-bubble-journal" style={{ marginTop: 6, padding: '0 4px' }}>{t('Stage moves: ')}{j.slice(-4).join(' · ')}</div> : null } catch { return null } })()}
      </SetCard>
      </section>
      </SetCluster>
      <SetCluster name={t('The screen')} line={t('How Logos looks, and the language it speaks.')}>
      <section className="set-group">
      <SetCard present="set-card-appearance" icon={<Palette size={19} />} title={t('Appearance')} sub={t('The light of the room.')}>
      <div className="list">
        {([
          { id: 'legacy', name: t('Legacy'), desc: t('Charcoal and gold — the original.'), sw: ['#17130c', '#e9bd72'] },
          { id: 'tron', name: 'Tron', desc: t('Light lines on the deep black of the Grid.'), sw: ['#02060c', '#00e5ff', '#ff1e14'] },
          { id: 'cyberpunk', name: 'Cyberpunk', desc: t('Signal yellow print on warm black.'), sw: ['#0b0a08', '#fcee0a', '#ff2a6d'] },
        ] as const).map((th) => {
          const fam = st.theme === 'tron' ? 'tron' : st.theme === 'cyberpunk' ? 'cyberpunk' : 'legacy'
          const on = fam === th.id
          return (
            <button key={th.id} type="button" className={`theme-row ${on ? 'on' : ''}`} aria-pressed={on}
              onClick={() => {
                if (th.id === 'legacy') { settings.set({ theme: st.lastLegacy }); applyTheme(st.lastLegacy) }
                else { const v = th.id as Theme; settings.set({ theme: v }); applyTheme(v) }
              }}>
              <span className="theme-sw" style={{ background: th.sw.length >= 3 ? `linear-gradient(135deg, ${th.sw[0]} 0 45%, ${th.sw[1]} 45% 78%, ${th.sw[2]} 78% 100%)` : `linear-gradient(135deg, ${th.sw[0]} 50%, ${th.sw[1]} 50%)` }} />
              <span className="grow">
                <span className="t">{th.name}</span>
                <span className="d">{th.desc}</span>
              </span>
              {on && <Check size={18} className="theme-check" />}
            </button>
          )
        })}
        {(st.theme !== 'tron' && st.theme !== 'cyberpunk') && (
          <div className="list-row col">
            <div className="t">{t('Legacy mode')}</div>
            <Seg present="set-theme" value={st.lastLegacy} label={t('Legacy mode')} onChange={(v: LegacyTheme) => { settings.set({ theme: v, lastLegacy: v }); applyTheme(v) }} options={[{ value: 'dark', label: t('Dark') }, { value: 'light', label: t('Light') }, { value: 'system', label: t('System') }]} />
          </div>
        )}
      </div>
      </SetCard>
      </section>
      <section className="set-group">
      <SetCard present="set-card-language" icon={<Languages size={19} />} title={t('Language')} sub={t('The app’s own words — everything on screen.')}>
      <div className="list">
        <div className="list-row col">
          <Seg present="set-ui-lang" presentLang={st.uiLang} value={st.uiLang} label={t('Language')} onChange={(v: 'en' | 'es') => settings.set({ uiLang: v })} options={[{ value: 'en', label: 'English' }, { value: 'es', label: 'Español' }]} />
        </div>
      </div>
      </SetCard>
      </section>
      </SetCluster>
      <SetCluster name={t('Learn')} line={t('Guided lessons that walk the whole app with you.')}>
      <section className="set-group" data-present="set-presentations">
      <PresentationsCard onLaunch={launchPresentation} searchSlot={<PresentationSearch />} />
      </section>
      </SetCluster>
      <SetCluster name={t('Your data')} line={t('Your whole library in one file — out, and back in.')}>
      <section className="set-group">
      <BackupCard />
      </section>
      </SetCluster>
      <section className="set-group">
      <SetCard present="set-about" icon={<img src={`${import.meta.env.BASE_URL}icon-192.png`} alt="" />} title={t('About Logos')} sub={t('Version {v} · private, on-device text-to-speech', { v: VERSION })}>
      <div className="credits">
        <p><strong>Based on <a href="https://github.com/SysAdminDoc/BetterTTS" target="_blank" rel="noreferrer">BetterTTS</a> by SysAdminDoc</strong> (MIT License). Logos is a simplified, phone-first rebuild; its listening player, export and service-worker isolation grew out of it.</p>
        <p>Voices: <a href="https://huggingface.co/gradium/phonon-40m-multilingual" target="_blank" rel="noreferrer">Phonon 40m multilingual</a> by Gradium, CC BY-NC 4.0 (non-commercial), with voices from <a href="https://huggingface.co/gradium/phonon-voices" target="_blank" rel="noreferrer">gradium/phonon-voices</a> (Apache 2.0), run with phonon-tts (MIT/Apache 2.0).</p>
        <p>Also <a href="https://github.com/kyutai-labs/pocket-tts" target="_blank" rel="noreferrer">Pocket TTS</a> by Kyutai (Manu Orsini, Simon Rouard, Gabriel De Marmiesse, Václav Volhejn, Neil Zeghidour, Alexandre Défossez), CC BY 4.0, run in the browser with <a href="https://github.com/thewh1teagle/pocket-tts-onnx" target="_blank" rel="noreferrer">pocket-tts-onnx</a> by thewh1teagle (CC BY 4.0) and ONNX Runtime Web.</p>
        <p>MP3 encoding: lamejs (LGPL-3.0). Fonts: Manrope & Instrument Serif (OFL).</p>
        <p className="muted small" style={{ marginBottom: 0 }}>© 2026 SysAdminDoc · © 2026 Oscar Arnoldo Velasquez (Logos modifications). Released under the MIT License.</p>
      </div>
      </SetCard>
      </section>
      </div>
      <div className="set-version" data-present="set-version">{t('Version {v}', { v: VERSION })}</div>
    </div>
  )
}
