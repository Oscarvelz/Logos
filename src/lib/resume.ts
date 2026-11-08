// Where a loose Listen session was left — the draft leg of "Continue listening".
// Books remember themselves (meta.pos) and clips remember themselves
// (clip.pos); this is the same courtesy for a pasted text.
import { listen } from '../player/listen.ts'
import { describeText } from './describe.ts'
import { detectLang } from './text.ts'
import { textKey } from './marks.ts'

const KEY = 'logos.resume.session'
export type SessionResume = { key: string; idx: number; title: string; at: number }

export function loadSessionResume(): SessionResume | null {
  try { return JSON.parse(localStorage.getItem(KEY) ?? 'null') as SessionResume | null } catch { return null }
}

let started = false
let lastIdx = -1
export function initResumeTracking() {
  if (started) return
  started = true
  listen.subscribe(() => {
    const s = listen.get()
    if (!s.active || s.current === lastIdx) return
    lastIdx = s.current
    if (s.current === 0 && !s.playing) return
    const r: SessionResume = {
      key: textKey(s.text),
      idx: s.current,
      title: describeText(s.text.slice(0, 12000), detectLang(s.text.slice(0, 2000)).lang).title || 'Listen',
      at: Date.now(),
    }
    try { localStorage.setItem(KEY, JSON.stringify(r)) } catch { /* full */ }
  })
}
