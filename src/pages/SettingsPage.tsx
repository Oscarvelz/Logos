import { useEffect, useState } from 'react'
import { Cpu, Download, HardDrive, Loader2, Trash2 } from 'lucide-react'
import { useStore } from '../lib/store.ts'
import { settings, applyTheme, type Theme } from '../lib/settings.ts'
import { engine, ensureModel, deleteModel, storageEstimate, POCKET_SIZE_MB, PHONON_SIZE_MB, modelCacheBytes } from '../engine/engine.ts'
import { formatBytes } from '../lib/audio.ts'
import { Range, Seg, Switch, toast } from '../components/ui.tsx'
import { endSession } from '../player/listen.ts'

const VERSION = '1.4.6'

export function SettingsPage() {
  const st = useStore(settings)
  const e = useStore(engine)
  const [usage, setUsage] = useState<{ quota: number; usage: number } | null>(null)
  const [persisted, setPersisted] = useState<boolean | null>(null)
  const [modelBytes, setModelBytes] = useState(0)
  const refresh = () => { void storageEstimate().then(setUsage); void modelCacheBytes().then(setModelBytes) }
  useEffect(() => {
    refresh()
    void navigator.storage?.persisted?.().then(setPersisted)
  }, [e.status])

  const warming = e.status === 'loading' && e.phase === 'warm'

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-sub">Everything runs on this device. No account, no cloud.</p>
        </div>
      </div>

      <div className="section-label">Neural voice</div>
      <div className="card engine-card stack">
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
          <div style={{ color: 'var(--accent)' }}><Cpu size={30} /></div>
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

      <div className="list" style={{ marginTop: 12 }}>
        <div className="list-row">
          <HardDrive size={20} className="muted" />
          <div className="grow">
            <div className="t">Storage</div>
            <div className="d">Voice models {formatBytes(modelBytes)}{usage?.quota ? ` · ${formatBytes(usage.usage)} of ${formatBytes(usage.quota)} used` : ''}</div>
          </div>
          {persisted === false && <button className="btn sm" onClick={async () => { const ok = await navigator.storage?.persist?.(); setPersisted(Boolean(ok)); toast(ok ? 'Storage protected from automatic cleanup' : 'The browser declined — install the app to keep storage') }}>Protect</button>}
        </div>
        <div className="list-row">
          <div className="grow"><div className="t">Download on first play</div><div className="d">Fetch the neural voice automatically the first time you press play.</div></div>
          <Switch label="Download on first play" on={st.autoDownload} onChange={(v) => settings.set({ autoDownload: v })} />
        </div>
        <div className="list-row">
          <div className="grow"><div className="t">Device voice bridge</div><div className="d">Speak instantly with your phone’s built-in voice while the neural model downloads.</div></div>
          <Switch label="Device voice bridge" on={st.deviceFallback} onChange={(v) => settings.set({ deviceFallback: v })} />
        </div>
      </div>

      <div className="section-label">Playback</div>
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
      </div>

      <div className="section-label">Appearance</div>
      <div className="list">
        <div className="list-row col">
          <div className="t">Theme</div>
          <Seg value={st.theme} label="Theme" onChange={(t: Theme) => { settings.set({ theme: t }); applyTheme(t) }} options={[{ value: 'dark', label: 'Dark' }, { value: 'light', label: 'Light' }, { value: 'system', label: 'System' }]} />
        </div>
      </div>

      <div className="section-label">About</div>
      <div className="card card-pad credits">
        <div className="row" style={{ marginBottom: 12 }}>
          <img src={`${import.meta.env.BASE_URL}icon-192.png`} width={52} height={52} style={{ borderRadius: 14 }} alt="" />
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 30, lineHeight: 1 }}>Logos</div>
            <div className="muted small">Version {VERSION} · private, on-device text-to-speech</div>
          </div>
        </div>
        <p><strong>Based on <a href="https://github.com/SysAdminDoc/BetterTTS" target="_blank" rel="noreferrer">BetterTTS</a> by SysAdminDoc</strong> (MIT License). Logos is a simplified, phone-first rebuild; its listening player, export and service-worker isolation grew out of it.</p>
        <p>Voices: <a href="https://huggingface.co/gradium/phonon-40m-multilingual" target="_blank" rel="noreferrer">Phonon 40m multilingual</a> by Gradium, CC BY-NC 4.0 (non-commercial), with voices from <a href="https://huggingface.co/gradium/phonon-voices" target="_blank" rel="noreferrer">gradium/phonon-voices</a> (Apache 2.0), run with phonon-tts (MIT/Apache 2.0).</p>
        <p>Also <a href="https://github.com/kyutai-labs/pocket-tts" target="_blank" rel="noreferrer">Pocket TTS</a> by Kyutai (Manu Orsini, Simon Rouard, Gabriel De Marmiesse, Václav Volhejn, Neil Zeghidour, Alexandre Défossez), CC BY 4.0, run in the browser with <a href="https://github.com/thewh1teagle/pocket-tts-onnx" target="_blank" rel="noreferrer">pocket-tts-onnx</a> by thewh1teagle (CC BY 4.0) and ONNX Runtime Web.</p>
        <p>MP3 encoding: lamejs (LGPL-3.0). Fonts: Manrope & Instrument Serif (OFL).</p>
        <p className="muted small" style={{ marginBottom: 0 }}>© 2026 SysAdminDoc · © 2026 Oscar Arnoldo Velasquez (Logos modifications). Released under the MIT License.</p>
      </div>
    </div>
  )
}
