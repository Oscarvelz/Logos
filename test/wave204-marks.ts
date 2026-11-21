// 1.4.204 — the marks witness (the panel ⚑'s receipt) + the standing
// identity dedupe it relies on.
//   W1 a handled loose mark moves marksEpoch by exactly one
//   W2 the same moment marked again still moves the epoch (the press
//      WAS handled — the shell must not manufacture a ghost visit)
//      but files NO second mark (M-12 identity dedupe)
//   W3 a different sentence is a different mark, and moves the epoch
// Run: node ~/workspace/vela-work/run-ts-test.mjs test/wave204-marks.ts
import './waveB-lib-setup.ts'
import { listen, loadText } from '../src/player/listen.ts'
import { markCurrentMoment, marksEpoch, loadMarks } from '../src/lib/marks.ts'

let pass = 0, fail = 0
const check = (name: string, ok: boolean, extra = '') => { if (ok) { pass++; console.log('PASS', name) } else { fail++; console.log('FAIL', name, extra) } }

const T = 'First sentence stands here. Second sentence follows it. Third one closes the text.'
loadText(T)
const e0 = marksEpoch()
const r1 = await markCurrentMoment()
check('W1 loose mark lands', r1 === 'loose', String(r1))
check('W1 epoch moves by one', marksEpoch() === e0 + 1, `${e0} -> ${marksEpoch()}`)
check('W1 one mark filed', loadMarks().length === 1, String(loadMarks().length))

const r2 = await markCurrentMoment()
check('W2 re-mark handled as loose', r2 === 'loose', String(r2))
check('W2 epoch moves again', marksEpoch() === e0 + 2, `${e0} -> ${marksEpoch()}`)
check('W2 still one mark (identity dedupe)', loadMarks().length === 1, String(loadMarks().length))

listen.set({ current: 2 })
const r3 = await markCurrentMoment()
check('W3 another sentence marks', r3 === 'loose', String(r3))
check('W3 epoch moves', marksEpoch() === e0 + 3, `${e0} -> ${marksEpoch()}`)
check('W3 two marks filed', loadMarks().length === 2, String(loadMarks().length))

console.log(`wave204-marks: ${pass} pass, ${fail} fail`)
process.exitCode = fail ? 1 : 0
