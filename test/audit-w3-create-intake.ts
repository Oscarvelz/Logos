// AUDIT Wave 3 — Create/Voices + Intake territory probe.
// Runs the REAL shipped modules: pronounce.ts, text.ts (segmentText),
// webtext.ts (normalizeUrl/isJustUrl), voices.ts (exportVoiceId,
// pickerActiveVoice). No app source modified.
const store = new Map<string, string>()
;(globalThis as any).localStorage = {
  getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
  setItem: (k: string, v: string) => { store.set(k, String(v)) },
  removeItem: (k: string) => { store.delete(k) },
}

import { pronEntries, savePronEntries, applyPron, subscribePronEntries } from '../src/lib/pronounce.ts'
import { segmentText } from '../src/lib/text.ts'
import { normalizeUrl, isJustUrl } from '../src/lib/webtext.ts'
import { exportVoiceId, pickerActiveVoice } from '../src/lib/voices.ts'

let pass = 0, fail = 0
const check = (name: string, ok: boolean, extra = '') => { if (ok) { pass++; console.log('PASS', name) } else { fail++; console.log('FAIL', name, extra) } }
const segs = (t: string) => segmentText(t).map((s) => s.text)

// ── T7-05 cascade ──────────────────────────────────────────────
savePronEntries([{ from: 'read', to: 'reed' }, { from: 'reed', to: 'red' }])
check('T7-05 read->reed does NOT cascade to red', applyPron('I read books') === 'I reed books', applyPron('I read books'))
check('T7-05 original reed still ->red in same pass', applyPron('I read reed books') === 'I reed red books', applyPron('I read reed books'))

// ── T7-06 whole word ───────────────────────────────────────────
savePronEntries([{ from: 'don', to: 'dawn' }, { from: 'word', to: 'wurd' }, { from: 'brien', to: 'bree-en' }])
check("T7-06 don't untouched (straight ')", applyPron("I don't know") === "I don't know", applyPron("I don't know"))
check('T7-06 don’t untouched (curly ’)', applyPron('I don’t know') === 'I don’t know', applyPron('I don’t know'))
check('T7-06 my_word untouched', applyPron('open my_word file') === 'open my_word file', applyPron('open my_word file'))
check("T7-06 O'Brien untouched", applyPron("O'Brien spoke") === "O'Brien spoke", applyPron("O'Brien spoke"))
check('T7-06 standalone don still fires', applyPron('I don know') === 'I dawn know', applyPron('I don know'))
check('T7-06 standalone word still fires', applyPron('the word is') === 'the wurd is', applyPron('the word is'))

// ── T7-03 witness / stale snapshot ─────────────────────────────
// Mirror SettingsPage exactly: state starts as pronEntries(); each
// own edit REPLACES the state array and saves it.
savePronEntries([])
let pronState = pronEntries()
const savePron = (list: { from: string; to: string }[]) => { pronState = list; savePronEntries(list) }
savePron([{ from: 'alpha', to: 'alfa' }])
check('T7-03 setup: state holds A only', pronState.length === 1 && pronState[0].from === 'alpha')
// Backup import lands (backup.ts calls savePronEntries([...prev, ...added])):
savePronEntries([...pronEntries(), { from: 'beta', to: 'beeta' }])
check('T7-03 imported B reaches the dictionary', pronEntries().some((e) => e.from === 'beta'))
check('T7-03 held snapshot array now contains B (witness sync)', pronState.some((e) => e.from === 'beta'), JSON.stringify(pronState))
// The next Settings edit, built from the held state as addPron does:
savePron([...pronState, { from: 'gamma', to: 'gama' }])
const after = pronEntries().map((e) => e.from)
check('T7-03 next edit does NOT wipe B', after.includes('alpha') && after.includes('beta') && after.includes('gamma'), after.join(','))
const persisted = JSON.parse(store.get('logos.pronounce.v1') ?? '[]') as { from: string }[]
check('T7-03 persisted storage keeps B too', persisted.some((e) => e.from === 'beta'))
let notified = 0
const unsub = subscribePronEntries(() => { notified++ })
savePronEntries([...pronEntries()])
check('T7-03 subscribePronEntries fires on save', notified === 1)
unsub()
savePronEntries([])

// ── F8-3 honorifics ────────────────────────────────────────────
check('F8-3 Gen. Grant stays one sentence', JSON.stringify(segs('Gen. Grant won the war. Peace came.')) === JSON.stringify(['Gen. Grant won the war.', 'Peace came.']), JSON.stringify(segs('Gen. Grant won the war. Peace came.')))
check('F8-3 Sen. Smith stays one sentence', segs('Sen. Smith spoke first. The room listened.').length === 2, JSON.stringify(segs('Sen. Smith spoke first. The room listened.')))
check('F8-3 Rev. Hale stays one sentence', segs('Rev. Hale prayed aloud. All bowed.').length === 2, JSON.stringify(segs('Rev. Hale prayed aloud. All bowed.')))
check('F8-3 Gov. / Col. / Sgt. / Capt. / Lt. / Hon. / Rep. stay joined',
  ['Gov. Reed led. All left.', 'Col. Reed led. All left.', 'Sgt. Reed led. All left.', 'Capt. Reed led. All left.', 'Lt. Reed led. All left.', 'Hon. Reed led. All left.', 'Rep. Reed led. All left.'].every((t) => segs(t).length === 2),
  ['Gov. Reed led. All left.', 'Col. Reed led. All left.', 'Sgt. Reed led. All left.', 'Capt. Reed led. All left.', 'Lt. Reed led. All left.', 'Hon. Reed led. All left.', 'Rep. Reed led. All left.'].map((t) => segs(t).length).join(','))

// ── F8-4 U.S. before a capital ─────────────────────────────────
check('F8-4 "The U.S. Senate voted today." is one sentence', JSON.stringify(segs('The U.S. Senate voted today. It passed.')) === JSON.stringify(['The U.S. Senate voted today.', 'It passed.']), JSON.stringify(segs('The U.S. Senate voted today. It passed.')))

// ── F8-5 unconditional guard ───────────────────────────────────
check('F8-5 "etc. She" splits at the true end', JSON.stringify(segs('He bought apples, etc. She went home.')) === JSON.stringify(['He bought apples, etc.', 'She went home.']), JSON.stringify(segs('He bought apples, etc. She went home.')))
check('F8-5 "U.S. It" splits at the true end', JSON.stringify(segs('He lives in the U.S. It was home.')) === JSON.stringify(['He lives in the U.S.', 'It was home.']), JSON.stringify(segs('He lives in the U.S. It was home.')))
check('F8-5 mid-sentence etc. before lowercase stays joined', segs('Apples, etc. were on the list.').length === 1, JSON.stringify(segs('Apples, etc. were on the list.')))

// ── T7-10 basis: letter-less text yields zero segments ─────────
check('T7-10 segmentText("!!! ???") = 0', segmentText('!!! ???').length === 0)
check('T7-10 segmentText(emoji) = 0', segmentText('😀 🎉 ✨').length === 0)
check('T7-10 segmentText("Hello.") = 1', segmentText('Hello.').length === 1)

// ── F8-6 bare domain ending a sentence ─────────────────────────
check('F8-6 normalizeUrl(example.com.) non-null', normalizeUrl('example.com.') !== null, String(normalizeUrl('example.com.')))
check('F8-6 normalizeUrl(example.com,) non-null', normalizeUrl('example.com,') !== null, String(normalizeUrl('example.com,')))
check('F8-6 isJustUrl(example.com.) true', isJustUrl('example.com.') === true)
check('F8-6 isJustUrl(https://example.com/article.) true', isJustUrl('https://example.com/article.') === true)
check('F8-6 bare domain with path + period', normalizeUrl('example.com/article.') !== null, String(normalizeUrl('example.com/article.')))
check('F8-6 control: balanced paren URL keeps its )', normalizeUrl('https://en.wikipedia.org/wiki/Apple_(fruit)') === 'https://en.wikipedia.org/wiki/Apple_(fruit)', String(normalizeUrl('https://en.wikipedia.org/wiki/Apple_(fruit)')))

// ── T7-11 explicit pick wins for every segment ────────────────
const fakeSt = { defaultVoice: { en: 'pk_alba', es: 'pk_lola' } } as { defaultVoice: Record<'en' | 'es', string> }
check('T7-11 Spanish pick renders ENGLISH segments too', exportVoiceId('pk_lola', 'en', fakeSt) === 'pk_lola', exportVoiceId('pk_lola', 'en', fakeSt))
check('T7-11 Spanish pick renders Spanish segments', exportVoiceId('pk_lola', 'es', fakeSt) === 'pk_lola')
check('T7-11 Auto (null) still resolves per language (en)', exportVoiceId(null, 'en', fakeSt) === 'pk_alba')
check('T7-11 Auto (null) still resolves per language (es)', exportVoiceId(null, 'es', fakeSt) === 'pk_lola')
check('T7-11 ghost pick falls back to default', exportVoiceId('ph_GHOST999', 'en', fakeSt) === 'pk_alba', exportVoiceId('ph_GHOST999', 'en', fakeSt))

// ── T7-12 picker orphan ────────────────────────────────────────
check('T7-12 ungrouped active voice is returned as orphan', pickerActiveVoice('pk_lola', new Set(['pk_alba']))?.id === 'pk_lola')
check('T7-12 grouped active voice is not duplicated', pickerActiveVoice('pk_lola', new Set(['pk_lola'])) === undefined)
check('T7-12 null active yields no orphan', pickerActiveVoice(null, new Set()) === undefined)

console.log(`AUDIT-W3-CREATE-INTAKE probe: ${pass}/${pass + fail} PASS`)
process.exitCode = fail ? 1 : 0
