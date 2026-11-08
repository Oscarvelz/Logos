import { useEffect, useRef, useState, type ReactNode } from 'react'
import { exportBackup, importBackup } from '../lib/backup.ts'
import { Cpu, Download, HardDrive, Loader2, Mic, Palette, PictureInPicture2, Plus, SlidersHorizontal, Trash2, X } from 'lucide-react'
import { useStore } from '../lib/store.ts'
import { settings, applyTheme, type Theme } from '../lib/settings.ts'
import { bubbleSupported, bubbleNativeState, setBubble, openBubblePermission, type BubbleNativeState } from '../lib/bubble.ts'
import { keep } from '../engine/keep.ts'
import { engine, ensureModel, deleteModel, storageEstimate, POCKET_SIZE_MB, PHONON_SIZE_MB, modelCacheBytes } from '../engine/engine.ts'
import { formatBytes } from '../lib/audio.ts'
import { Range, Seg, Switch, toast } from '../components/ui.tsx'
import { endSession } from '../player/listen.ts'
import { pronEntries, savePronEntries, type PronEntry } from '../lib/pronounce.ts'

const VERSION = '1.4.83'

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
    try { const n = await exportBackup(); toast(`Backup saved · ${n} book${n === 1 ? '' : 's'} inside`) }
    catch { toast('The backup could not be made') }
    setBusy('')
  }
  const onFile = async (f: File | undefined) => {
    if (!f) return
    setBusy('in')
    try { const n = await importBackup(f); toast(`Restored · ${n} book${n === 1 ? '' : 's'} back on the shelf`) }
    catch { toast('That file is not a Logos backup') }
    setBusy('')
    if (file.current) file.current.value = ''
  }
  return (
    <SetCard icon={<HardDrive size={19} />} title="Backup" sub="Your books, marks, dictionary and settings in one file">
      <div className="set-actions">
        <button className="btn" onClick={() => void run()} disabled={!!busy}>{busy === 'out' ? <Loader2 size={15} className="spin" /> : <Download size={15} />} Export backup</button>
        <button className="btn ghost" onClick={() => file.current?.click()} disabled={!!busy}>{busy === 'in' ? <Loader2 size={15} className="spin" /> : <Plus size={15} />} Import backup</button>
        <input ref={file} type="file" accept=".json,application/json" hidden onChange={(e) => void onFile(e.target.files?.[0])} />
      </div>
      <p className="muted small" style={{ margin: '8px 0 0' }}>Audio clips are not inside — they can always be made again from the books. Settings themselves stay as they are on this phone.</p>
    </SetCard>
  )
}

function SetCard({ icon, title, sub, children }: { icon: ReactNode; title: string; sub: string; children: ReactNode }) {
  return (
    <div className="card set-card">
      <div className="set-card-h">
        <span className="set-ic">{icon}</span>
        <div className="grow">
          <div className="set-card-t">{title}</div>
          <div className="set-card-s">{sub}</div>
        </div>
      </div>
      {children}
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
  const savePron = (list: PronEntry[]) => { setPron(list); savePronEntries(list) }
  const addPron = () => {
    const from = pFrom.trim()
    const to = pTo.trim()
    if (!from || !to) return
    savePron([...pron.filter((x) => x.from.toLowerCase() !== from.toLowerCase()), { from, to }])
    setPFrom(''); setPTo('')
    toast(`“${from}” will be read as “${to}”`)
  }

  return (
    <div className="page settings-page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-sub">Everything runs on this device. No account, no cloud.</p>
        </div>
      </div>

      <div className="set-cols">
      <section className="set-group">
      <SetCard icon={<Cpu size={19} />} title="Neural voice" sub="The reading voice — it lives on this device, downloads once, then works offline.">
      <div className="engine-card stack">
        <div className="row between">
          <div>
            <div className="big">{e.status === 'ready' || warming ? 'Ready' : e.status === 'loading' ? 'Downloading' : e.status === 'error' ? 'Needs attention' : e.cached ? 'Downloaded' : 'Not downloaded'}</div>
            <div className="muted small" style={{ marginTop: 4 }}>
              {warming
                ? 'On this device · loading into memory in the background'
                : e.status === 'ready'
                  ? `${e.kind === 'phonon' ? 'Phonon by Gradium' : 'PocketTTS by Kyutai'} · ${e.lang === 'es' ? 'Spanish' : 'English'}${e.lastRtf ? ` · ${(1 / e.lastRtf).toFixed(1)}× real-time` : ''}`
                  : e.kind === 'phonon'
                    ? `Phonon by Gradium · ~${PHONON_SIZE_MB} MB for English and Spanish, then offline`
                    : `PocketTTS by Kyutai · ~${POCKET_SIZE_MB} MB per language, then offline`}
            </div>
          </div>
        </div>
        {e.status === 'loading' && !warming && (
          <div>
            <div className="meter"><i style={{ width: `${Math.round(e.progress * 100)}%` }} /></div>
            <div className="row between small muted mono" style={{ marginTop: 6 }}><span>{formatBytes(e.loaded)} of {e.total ? formatBytes(e.total) : '…'}</span><span>{Math.round(e.progress * 100)}%</span></div>
          </div>
        )}
        {e.status === 'error' && <div className="error-note">{e.error}</div>}
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          {e.status !== 'ready' && !warming && (
            <button className="btn primary" onClick={() => ensureModel().then(() => toast('Neural voice ready — works offline now')).catch((err) => toast((err as Error).message))} disabled={e.status === 'loading'}>
              {e.status === 'loading' ? <Loader2 size={18} className="spin" /> : <Download size={18} />} {e.cached ? 'Load now' : 'Download now'}
            </button>
          )}
          <button className="btn danger" onClick={async () => { endSession(); await deleteModel(); refresh(); toast('Voice model removed from this device') }} disabled={e.status === 'loading' || (!modelBytes && !e.cached)}>
            <Trash2 size={18} /> Delete model
          </button>
        </div>
      </div>
      <div className="set-div" />
      <div className="list">
        <div className="list-row">
          <HardDrive size={20} className="muted" />
          <div className="grow">
            <div className="t">Storage</div>
            <div className="d">Voice models {formatBytes(modelBytes)}{usage?.quota ? ` · ${formatBytes(usage.usage)} of ${formatBytes(usage.quota)} used` : ''}</div>
            {IN_APP ? <div className="d">Kept inside the Logos app. Only clearing Logos’s own data removes it.</div>
              : persisted !== null && <div className="d">{persisted ? 'Protected from automatic cleanup' : 'Not protected: the phone may clear the voice'}</div>}
            {kn.note && <div className="d" style={{ color: 'var(--accent)' }}>{kn.note.kind === 'cleared'
              ? `The phone cleared the saved ${kn.note.engine === 'pocket' ? 'Pocket' : 'Phonon'} voice (noticed ${new Date(kn.note.at).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}).`
              : `The ${kn.note.engine === 'pocket' ? 'Pocket' : 'Phonon'} voice loaded but couldn't be saved on this phone.`}</div>}
          </div>
          {!IN_APP && persisted === false && <button className="btn sm" onClick={async () => { const ok = await navigator.storage?.persist?.(); setPersisted(Boolean(ok)); toast(ok ? 'Storage protected from automatic cleanup' : 'The browser declined — install the app to keep storage') }}>Protect</button>}
        </div>
        <div className="list-row">
          <div className="grow"><div className="t">Download on first play</div><div className="d">Fetch the neural voice automatically the first time you press play.</div></div>
          <Switch label="Download on first play" on={st.autoDownload} onChange={(v) => settings.set({ autoDownload: v })} />
        </div>
        {!IN_APP && (
        <div className="list-row">
          <div className="grow"><div className="t">Device voice bridge</div><div className="d">Speak instantly with your phone’s built-in voice while the neural model downloads.</div></div>
          <Switch label="Device voice bridge" on={st.deviceFallback} onChange={(v) => settings.set({ deviceFallback: v })} />
        </div>
        )}
      </div>
      </SetCard>
      </section>
      <section className="set-group">
      <SetCard icon={<SlidersHorizontal size={19} />} title="Playback" sub="How listening feels, sentence by sentence.">
      <div className="list">
        <div className="list-row col">
          <div className="row between"><div className="t">Listening speed</div><span className="mono muted">{st.listenSpeed.toFixed(2)}×</span></div>
          <Range label="Listening speed" min={0.5} max={2.5} step={0.05} value={st.listenSpeed} onChange={(v) => settings.set({ listenSpeed: v })} />
        </div>
        <div className="list-row col">
          <div className="row between"><div className="t">Pause between sentences</div><span className="mono muted">{st.sentencePauseMs} ms</span></div>
          <Range label="Pause between sentences" min={0} max={800} step={20} value={st.sentencePauseMs} onChange={(v) => settings.set({ sentencePauseMs: v })} />
        </div>
        <div className="list-row">
          <div className="grow"><div className="t">Highlight current sentence</div></div>
          <Switch label="Highlight current sentence" on={st.highlight} onChange={(v) => settings.set({ highlight: v })} />
        </div>
        <div className="list-row">
          <div className="grow"><div className="t">Word timing</div><div className="d">{st.wordLeadMs === 90 ? 'Tuned for the phone speaker' : st.wordLeadMs > 90 ? `${st.wordLeadMs - 90} ms earlier · for Bluetooth delay` : `${90 - st.wordLeadMs} ms later`}</div></div>
          <div className="row" style={{ gap: 6 }}>
            <button className="btn sm ghost" aria-label="Highlight later" onClick={() => settings.set({ wordLeadMs: Math.max(-150, st.wordLeadMs - 30) })}>−</button>
            <button className="btn sm ghost" aria-label="Reset word timing" onClick={() => settings.set({ wordLeadMs: 90 })} style={{ minWidth: 0, padding: '0 8px', opacity: st.wordLeadMs === 90 ? .4 : 1 }}>↺</button>
            <button className="btn sm ghost" aria-label="Highlight earlier" onClick={() => settings.set({ wordLeadMs: Math.min(450, st.wordLeadMs + 30) })}>+</button>
          </div>
        </div>
      </div>
      </SetCard>
      </section>
      <section className="set-group">
      <SetCard icon={<Mic size={19} />} title="Pronunciation" sub="Words said your way — names, places, terms of art.">
      <div className="list">
        <div className="list-row col">
          <div className="grow"><div className="t">Say it your way</div><div className="d">Applies to listening and to exported audio, in every book. Codes and links are already named, not spelled out.</div></div>
          <div className="row" style={{ gap: 8, marginTop: 10 }}>
            <input className="text-input" style={{ height: 44, flex: 1, minWidth: 0, width: 'auto' }} placeholder="Word in the book" value={pFrom} onChange={(e) => setPFrom(e.target.value)} />
            <input className="text-input" style={{ height: 44, flex: 1, minWidth: 0, width: 'auto' }} placeholder="Say it as" value={pTo} onChange={(e) => setPTo(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') addPron() }} />
            <button className="btn primary" onClick={addPron} disabled={!pFrom.trim() || !pTo.trim()}><Plus size={17} /> Add</button>
          </div>
        </div>
        {pron.map((e) => (
          <div className="list-row" key={e.from}>
            <div className="grow"><div className="t">{e.from}</div><div className="d">read as “{e.to}”</div></div>
            <button className="btn sm ghost" aria-label={`Remove ${e.from}`} onClick={() => savePron(pron.filter((x) => x !== e))}><X size={16} /></button>
          </div>
        ))}
      </div>
      </SetCard>
      </section>
      <section className="set-group">
      <SetCard icon={<Palette size={19} />} title="Appearance" sub="The light of the room.">
      <div className="list">
        <div className="list-row col">
          <div className="t">Theme</div>
          <Seg value={st.theme} label="Theme" onChange={(t: Theme) => { settings.set({ theme: t }); applyTheme(t) }} options={[{ value: 'dark', label: 'Dark' }, { value: 'light', label: 'Light' }, { value: 'system', label: 'System' }]} />
        </div>
      </div>
      </SetCard>
      </section>
      <section className="set-group">
      <SetCard icon={<PictureInPicture2 size={19} />} title="Floating player" sub="A small λ that floats over your other apps.">
      <div className="list">
        <div className="list-row">
          <div className="grow">
            <div className="t">Floating bubble</div>
            <div className="d">{!IN_APP
              ? 'Only in the Logos app.'
              : !bubbleSupported()
                ? 'Comes with the newest Logos app — update the app and it appears here.'
                : bState && !bState.permission
                  ? 'Needs Android’s permission to display over other apps — switch it on to be taken there.'
                  : 'Drag it anywhere. Tap it for play, previous and next — and for what you copied.'}</div>
          </div>
          <Switch label="Floating bubble" on={bubbleUi ?? (bState ? bState.running : st.bubbleOn)} onChange={(v) => {
            if (!bubbleSupported()) return
            if (v && bState && !bState.permission) { openBubblePermission(); toast('Allow Logos to display over other apps, then switch the bubble on again'); return }
            setBubbleUi(v)
            setBubble(v)
            setTimeout(() => setBState(bubbleNativeState()), 450)
          }} />
        </div>
        <div className="list-row">
          <div className="grow">
            <div className="t">Play the clipboard</div>
            <div className="d">The lever. On: copy text anywhere, tap the bubble, and it plays — replacing what was playing, with an Undo so nothing is lost; opening Logos right after copying plays it too. Off: the bubble only controls playback, and pasting stays manual, as now. Android only lets Logos look at the clipboard at that tap — never in secret.</div>
          </div>
          <Switch label="Play the clipboard" on={st.bubbleAuto} onChange={(v) => settings.set({ bubbleAuto: v })} />
        </div>
      </div>
      {bState?.last ? <div className="muted small" style={{ marginTop: 10, padding: '0 4px' }}>Last clipboard try: {bState.last}</div> : null}
      {(() => { try { const j = JSON.parse(localStorage.getItem('logos.stage.journal') ?? '[]') as string[]; return j.length ? <div className="muted small" style={{ marginTop: 6, padding: '0 4px' }}>Stage moves: {j.slice(-4).join(' · ')}</div> : null } catch { return null } })()}
      </SetCard>
      </section>
      <section className="set-group">
      <BackupCard />
      <SetCard icon={<img src={`${import.meta.env.BASE_URL}icon-192.png`} alt="" />} title="About Logos" sub={`Version ${VERSION} · private, on-device text-to-speech`}>
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
    </div>
  )
}
