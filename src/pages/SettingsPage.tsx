import { useEffect, useState } from 'react'
import { Cpu, Download, HardDrive, Loader2, Trash2, Zap } from 'lucide-react'
import { useStore } from '../lib/store.ts'
import { settings, applyTheme, type Theme } from '../lib/settings.ts'
import { engine, ensureModel, deleteModel, cacheUsage, probeWebGpu, resolveEngine, isModelCached, gpuBroken, MODEL_SIZE_MB, POCKET_SIZE_MB, pocketCacheBytes, type Family } from '../engine/engine.ts'
import { formatBytes } from '../lib/audio.ts'
import { Range, Seg, Switch, toast } from '../components/ui.tsx'
import { endSession } from '../player/listen.ts'

const VERSION = '1.2.4'

export function SettingsPage() {
  const st = useStore(settings)
  const e = useStore(engine)
  const [usage, setUsage] = useState<{ model: number; voices: number; quota: number; usage: number } | null>(null)
  const [planned, setPlanned] = useState<{ device: string; dtype: string } | null>(null)
  const [persisted, setPersisted] = useState<boolean | null>(null)

  const [pocketBytes, setPocketBytes] = useState(0)
  const refresh = () => { void cacheUsage().then(setUsage); void resolveEngine().then(setPlanned); void pocketCacheBytes().then(setPocketBytes) }
  const pocketOn = e.family === 'pocket'

  const changeFamily = async (fam: Family) => {
    if (fam === e.family) return
    endSession()
    settings.set({
      defaultVoice: fam === 'pocket' ? { en: 'pk_alba', es: 'pk_lola' } : { en: 'af_heart', es: 'ef_dora' },
      voiceOverride: null,
    })
    await isModelCached()
    void ensureModel().catch(() => {})
    toast(fam === 'pocket' ? 'PocketTTS voices are now your defaults' : 'Kokoro voices are now your defaults')
  }
  useEffect(() => {
    refresh()
    void probeWebGpu()
    void navigator.storage?.persisted?.().then(setPersisted)
  }, [e.status, st.engine])



  const plannedLabel = planned ? `${planned.device === 'webgpu' ? 'WebGPU' : 'WASM'} · ${planned.dtype} · ~${MODEL_SIZE_MB[planned.dtype as 'q8']} MB` : 'WebGPU (not available here)'

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-sub">Everything runs on this device. No account, no cloud.</p>
        </div>
      </div>

      <div className="section-label">Neural voice engine</div>
      <div className="list" style={{ marginBottom: 12 }}>
        <div className="list-row col">
          <div><div className="t">Voice engine</div><div className="d">PocketTTS (Kyutai) is built for phone processors: fast and natural, {POCKET_SIZE_MB} MB per language. Kokoro has more voices but runs slower on phones. Any voice from either engine can still be picked on the Voices page.</div></div>
          <Seg value={e.family} label="Voice engine" onChange={changeFamily} options={[{ value: 'pocket', label: 'PocketTTS · fast' }, { value: 'kokoro', label: 'Kokoro' }]} />
        </div>
      </div>
      <div className="card engine-card stack">
        <div className="row between">
          <div>
            <div className="big">{e.status === 'ready' ? 'Ready' : e.status === 'loading' ? (e.phase === 'download' ? 'Downloading' : 'Ready') : e.status === 'error' ? 'Needs attention' : e.cached ? 'Downloaded' : 'Not downloaded'}</div>
            <div className="muted small" style={{ marginTop: 4 }}>
              {e.status === 'loading' && e.phase !== 'download'
                ? 'On this device · loading into memory in the background'
                : pocketOn
                ? (e.status === 'ready' ? `PocketTTS on WASM (${e.pocketLang === 'es' ? 'Spanish' : 'English'})${e.lastRtf ? ` · ${(1 / e.lastRtf).toFixed(1)}× real-time` : ''}` : `PocketTTS · ~${POCKET_SIZE_MB} MB per language`)
                : e.status === 'ready' ? `Kokoro-82M on ${e.device === 'webgpu' ? 'WebGPU' : 'WASM'} (${e.dtype})${e.lastRtf ? ` · ${(1 / e.lastRtf).toFixed(1)}× real-time` : ''}` : `Will use ${plannedLabel}`}
            </div>
          </div>
          <div style={{ color: 'var(--accent)' }}>{e.device === 'webgpu' ? <Zap size={30} /> : <Cpu size={30} />}</div>
        </div>
        {e.status === 'loading' && e.phase === 'download' && (
          <div>
            <div className="meter"><i style={{ width: `${Math.round(e.progress * 100)}%` }} /></div>
            <div className="row between small muted mono" style={{ marginTop: 6 }}><span>{formatBytes(e.loaded)} of {e.total ? formatBytes(e.total) : '…'}</span><span>{Math.round(e.progress * 100)}%</span></div>
          </div>
        )}
        {e.status === 'error' && <div className="error-note">{e.error}</div>}
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          {e.status !== 'ready' && !(e.status === 'loading' && e.phase !== 'download') && (
            <button className="btn primary" onClick={() => ensureModel().then(() => toast('Neural voice ready — works offline now')).catch((err) => toast((err as Error).message))} disabled={e.status === 'loading'}>
              {e.status === 'loading' ? <Loader2 size={18} className="spin" /> : <Download size={18} />} {e.cached ? 'Load now' : 'Download now'}
            </button>
          )}
          <button className="btn danger" onClick={async () => { endSession(); await deleteModel(); refresh(); toast('Voice model removed from this device') }} disabled={e.status === 'loading' || (pocketOn ? !pocketBytes && !e.cached : !usage?.model && !e.cached)}>
            <Trash2 size={18} /> Delete model
          </button>
        </div>
      </div>

      <div className="list" style={{ marginTop: 12 }}>
        {!pocketOn && <div className="list-row col">
          <div><div className="t">Kokoro engine</div><div className="d">Kokoro runs only on your phone’s graphics chip (WebGPU): the 163 MB half-size model first, the 326 MB one if that fails. The slower CPU (WASM) engine is gone; PocketTTS handles CPU speech much better.{e.webgpu === false ? ' WebGPU is not available in this browser.' : ''}{gpuBroken() ? ' WebGPU didn’t work on this device, so Kokoro voices can’t play here. Use PocketTTS.' : ''}</div></div>
        </div>}
        <div className="list-row">
          <HardDrive size={20} className="muted" />
          <div className="grow">
            <div className="t">Storage</div>
            <div className="d">PocketTTS {formatBytes(pocketBytes)} · Kokoro {formatBytes(usage?.model ?? 0)} · voices {formatBytes(usage?.voices ?? 0)}{usage?.quota ? ` · ${formatBytes(usage.usage)} of ${formatBytes(usage.quota)} used` : ''}</div>
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
        <p><strong>Based on <a href="https://github.com/SysAdminDoc/BetterTTS" target="_blank" rel="noreferrer">BetterTTS</a> by SysAdminDoc</strong> (MIT License). Logos is a simplified, phone-first rebuild; the Kokoro worker, Spanish phoneme path and service-worker isolation are adapted from it.</p>
        <p>Voices: <a href="https://huggingface.co/hexgrad/Kokoro-82M" target="_blank" rel="noreferrer">Kokoro-82M</a> by hexgrad (Apache-2.0), via <a href="https://github.com/hexgrad/kokoro" target="_blank" rel="noreferrer">kokoro-js</a> and <a href="https://github.com/huggingface/transformers.js" target="_blank" rel="noreferrer">Transformers.js</a> / ONNX Runtime Web. <a href="https://github.com/kyutai-labs/pocket-tts" target="_blank" rel="noreferrer">Pocket TTS</a> by Kyutai (Manu Orsini, Simon Rouard, Gabriel De Marmiesse, Václav Volhejn, Neil Zeghidour, Alexandre Défossez), CC BY 4.0, run in the browser with <a href="https://github.com/thewh1teagle/pocket-tts-onnx" target="_blank" rel="noreferrer">pocket-tts-onnx</a> by thewh1teagle (CC BY 4.0).</p>
        <p>Spanish phonemes: eSpeak NG via <a href="https://github.com/sjmik/ephone-js" target="_blank" rel="noreferrer">ephone</a> (GPL-3.0-or-later). MP3 encoding: lamejs (LGPL-3.0). Fonts: Manrope & Instrument Serif (OFL).</p>
        <p className="muted small" style={{ marginBottom: 0 }}>© 2026 SysAdminDoc · © 2026 Oscar Arnoldo Velasquez (Logos modifications). Released under the MIT License.</p>
      </div>
    </div>
  )
}
