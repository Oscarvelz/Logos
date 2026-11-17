// Where a loose Listen session was left — the draft leg of "Continue listening".
// Books remember themselves (meta.pos) and clips remember themselves
// (clip.pos); this is the same courtesy for a pasted text.
import { listen } from '../player/listen.ts'
import { describeText } from './describe.ts'
import { detectLang } from './text.ts'
import { textKey } from './marks.ts'

const KEY = 'logos.resume.session'
export type SessionResume = { key: string; idx: number; title: string; at: number; done?: boolean }

/** The stored record, raw — including a finished one. */
function readRecord(): SessionResume | null {
  try { return JSON.parse(localStorage.getItem(KEY) ?? 'null') as SessionResume | null } catch { return null }
}

/**
 * The resume on offer, if any. A record that learned its session
 * FINISHED (cure T1-15) is not a resume: the tracker used to save
 * {key, idx} only when `current` changed, finish() never changes
 * `current`, and nothing annotated the record — so a text played to
 * the end was offered back as a mid-text resume at its last
 * sentence ("Sentence N"), and tapping it replayed that sentence
 * and finished again. A completed text masqueraded as an
 * interrupted one. The record now learns `done` the moment the
 * session finishes, and this door — the one every consumer reads
 * through — returns nothing for it. Replaying the text clears the
 * mark the ordinary way: the tracker saves fresh records as the
 * new session's sentences change.
 */
export function loadSessionResume(): SessionResume | null {
  const r = readRecord()
  return r && !r.done ? r : null
}

let started = false
let lastIdx = -1
let lastDoneKey = ''
export function initResumeTracking() {
  if (started) return
  started = true
  listen.subscribe(() => {
    const s = listen.get()
    if (!s.active) return
    // The finished edge (cure T1-15): annotate the record for THIS
    // text as done, once, when the session that produced it reaches
    // the end — by whichever road finished it (the player's own
    // finish() or the native voice's done report, both of which set
    // the same flag).
    if (s.finished) {
      const key = textKey(s.text)
      if (key !== lastDoneKey) {
        lastDoneKey = key
        const r = readRecord()
        if (r && r.key === key && !r.done) {
          try { localStorage.setItem(KEY, JSON.stringify({ ...r, done: true, at: Date.now() })) } catch { /* full */ }
        }
      }
      // A finished session has no resume place to save (cure
      // R3-T1-2). The handler used to FALL THROUGH from this
      // annotation to the fresh-record save below: any finishing
      // set in which `current` also moved — applyNativePos's done
      // branch is exactly that set, and the done-first adoption
      // shape creates the record from nothing — overwrote the
      // annotation in the same pass with a fresh, un-done record,
      // and the finished text was offered back as a mid-text
      // resume. T1-15's law is now structural: while `finished`
      // stands, this handler annotates and returns; the fresh save
      // below only ever runs for a session still in progress.
      // lastIdx follows the finish so a later replay's first move
      // is judged against the sentence the reading ended on.
      lastIdx = s.current
      return
    }
    // Not finished: re-arm the edge, so a replay of the same text
    // that finishes again annotates its own fresh record too.
    lastDoneKey = ''
    if (s.current === lastIdx) return
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
