// "From a web page": paste a link, get the page's clean text, then listen now,
// keep it for later, or save its audio. Used by Library (+) and by Listen's paste.
import { useEffect, useRef, useState } from 'react'
import { AudioLines, ClipboardPaste, Clock, FileAudio, Globe, Link2, Loader2, Play, RotateCcw } from 'lucide-react'
import { Sheet, toast } from './ui.tsx'
import { fetchWebText, normalizeUrl, type WebText } from '../lib/webtext.ts'
import { detectLang, estimateSeconds, formatDuration } from '../lib/text.ts'
import { describeText } from '../lib/describe.ts'
import { saveForLater } from '../lib/library.ts'
import { queueExport } from '../player/exporter.ts'
import { settings } from '../lib/settings.ts'
import { drafts } from '../lib/drafts.ts'
import { navigate } from '../lib/router.ts'
import { loadText, play as listenPlay } from '../player/listen.ts'

type Phase = 'input' | 'loading' | 'ready' | 'error'

export function WebImport({ open, onClose, initialUrl, onAudioFile }: { open: boolean; onClose: () => void; initialUrl?: string; onAudioFile?: () => void }) {
  const [url, setUrl] = useState('')
  const [phase, setPhase] = useState<Phase>('input')
  const [res, setRes] = useState<WebText | null>(null)
  const [err, setErr] = useState('')
  const ctrl = useRef<AbortController | null>(null)

  const go = async (raw = url) => {
    const norm = normalizeUrl(raw)
    if (!norm) { setErr('Paste a web address, like a news story or an article.'); setPhase('error'); return }
    setUrl(norm); setPhase('loading'); setErr('')
    ctrl.current?.abort(); ctrl.current = new AbortController()
    try {
      const r = await fetchWebText(norm, ctrl.current.signal)
      setRes(r); setPhase('ready')
    } catch (e) {
      if ((e as Error).name === 'AbortError') return
      setErr((e as Error).message); setPhase('error')
    }
  }

  useEffect(() => {
    if (!open) { ctrl.current?.abort(); return }
    setRes(null); setErr('')
    if (initialUrl) { setUrl(initialUrl); void go(initialUrl) } else { setUrl(''); setPhase('input') }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialUrl])

  const pasteUrl = async () => {
    try {
      const c = (await navigator.clipboard.readText()).trim()
      const n = normalizeUrl(c)
      if (n) { setUrl(n); void go(n) } else toast('No link on the clipboard')
    } catch { toast('Clipboard blocked — long-press the field to paste') }
  }

  const lang = res ? detectLang(res.text.slice(0, 4000)).lang : 'en'
  const info = res ? describeText(res.text, lang) : null
  const st = settings.get()
  const speed = Math.min(2, Math.max(0.6, st.listenSpeed))

  const listenNow = () => {
    if (!res) return
    drafts.set({ listen: res.text }); loadText(res.text); onClose(); navigate('listen')
    setTimeout(() => void listenPlay(), 350)
  }
  const later = async () => {
    if (!res) return
    await saveForLater(res.text, { title: res.title || info!.title, summary: info?.summary, lang, voice: st.voiceOverride ?? '', duration: estimateSeconds(res.text, 1), url: res.url, site: res.site })
    onClose(); toast('Saved to Listen later', { label: 'Library', run: () => navigate('library') }, 4000)
  }
  const saveAudio = () => {
    if (!res) return
    const r = queueExport(res.text, { voice: st.voiceOverride, speed, format: st.format, title: res.title || info!.title, summary: info?.summary, origin: 'listen', url: res.url, site: res.site })
    onClose(); toast(r === 'queued' ? 'Queued for your Library' : 'Making the audio · it will be in your Library', { label: 'Library', run: () => navigate('library') }, 5000)
  }

  return (
    <Sheet open={open} onClose={onClose} title={phase === 'ready' ? undefined : 'From a web page'}>
      {(phase === 'input' || phase === 'error') && (
        <>
          <form className="url-field" onSubmit={(e) => { e.preventDefault(); void go() }}>
            <Link2 size={18} />
            <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Paste a link" inputMode="url" autoCapitalize="off" autoCorrect="off" spellCheck={false} aria-label="Web address" autoFocus={!initialUrl} />
            <button type="button" className="icon-btn" onClick={() => void pasteUrl()} aria-label="Paste link"><ClipboardPaste size={18} /></button>
          </form>
          {phase === 'error' && <div className="web-err">{err}</div>}
          <button className="btn primary block" style={{ height: 52, marginTop: 12 }} onClick={() => void go()} disabled={!url.trim()}>
            {phase === 'error' ? <><RotateCcw size={17} /> Try again</> : <><Globe size={17} /> Bring the text</>}
          </button>
          <p className="muted small" style={{ margin: '10px 4px 0', lineHeight: 1.45 }}>Logos keeps only the article itself: no menus, ads, links, captions or reference lists.</p>
          {onAudioFile && (
            <>
              <div className="or-rule"><span>or</span></div>
              <button className="keep-opt" onClick={() => { onClose(); onAudioFile() }}>
                <span className="keep-ic"><FileAudio size={22} /></span>
                <span className="grow"><b>Add an audio file</b><small>MP3, M4A, WAV or OGG from this phone</small></span>
              </button>
            </>
          )}
        </>
      )}
      {phase === 'loading' && (
        <div className="web-loading">
          <Loader2 size={30} className="spin" />
          <div className="wl-t">Reading the page</div>
          <div className="wl-s">{(() => { try { return new URL(url).hostname.replace(/^www\./, '') } catch { return url } })()}</div>
          <button className="btn sm ghost" onClick={() => { ctrl.current?.abort(); setPhase('input') }}>Cancel</button>
        </div>
      )}
      {phase === 'ready' && res && (
        <>
          <div className="web-site"><Globe size={13} /> {res.site}</div>
          <div className="keep-title" style={{ marginTop: 4 }}>{res.title || info?.title}</div>
          <div className="keep-sub">{res.words.toLocaleString()} words · about {formatDuration(estimateSeconds(res.text, speed))} at {speed}×</div>
          <div className="web-preview" lang={lang}>
            {res.text.split('\n\n').slice(1, 5).map((p, i) => <p key={i}>{p}</p>)}
          </div>
          <div className="keep-opts" style={{ marginTop: 14 }}>
            <button className="keep-opt primary" onClick={listenNow}>
              <span className="keep-ic"><Play size={20} fill="currentColor" /></span>
              <span className="grow"><b>Listen now</b><small>Opens it in Listen and starts reading</small></span>
            </button>
            <button className="keep-opt" onClick={() => void later()}>
              <span className="keep-ic"><Clock size={21} /></span>
              <span className="grow"><b>Listen later</b><small>Keeps the text in your Library</small></span>
            </button>
            <button className="keep-opt" onClick={saveAudio}>
              <span className="keep-ic"><AudioLines size={21} /></span>
              <span className="grow"><b>Save the audio</b><small>{st.format.toUpperCase()} you can play offline and share</small></span>
            </button>
          </div>
        </>
      )}
    </Sheet>
  )
}
