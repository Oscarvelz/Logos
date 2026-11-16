// Acceptance probe for the F8-5 completion (Wave 3 mop-up): plain
// abbreviations must keep the old guard's behaviour before capitals
// that CONTINUE a sentence (labels, numerals, names), while the named
// case — a true sentence end before a capitalised starter — still
// splits. Runs the REAL shipped segmentText.
import { segmentText } from '../src/lib/text.ts'
const segs = (t: string) => segmentText(t).map((s) => s.text)

let pass = 0, fail = 0
const check = (name: string, got: string[], want: string[]) => {
  const ok = JSON.stringify(got) === JSON.stringify(want)
  if (ok) { pass++; console.log('PASS', name) } else { fail++; console.log('FAIL', name, '\n  got ', JSON.stringify(got), '\n  want', JSON.stringify(want)) }
}

// The four over-split cases the closing audit named — all must stay joined.
check('Fig. A stays joined', segs('See Fig. A for details. It helps.'), ['See Fig. A for details.', 'It helps.'])
check('Vol. II stays joined', segs('He read Vol. II today. It was good.'), ['He read Vol. II today.', 'It was good.'])
check('approx. Noon stays joined', segs('Meet me at approx. Noon Hall. Come early.'), ['Meet me at approx. Noon Hall.', 'Come early.'])
check('Jan. Jones stays joined', segs('It was published in Jan. Jones spoke later.'), ['It was published in Jan. Jones spoke later.'])
// The named case and its siblings — true ends before starter capitals still split.
check('etc. She splits (the named case)', segs('He bought apples, etc. She went home.'), ['He bought apples, etc.', 'She went home.'])
check('U.S. It splits', segs('He lives in the U.S. It was home.'), ['He lives in the U.S.', 'It was home.'])
check('Dec. The splits', segs('It ended in Dec. The snow came.'), ['It ended in Dec.', 'The snow came.'])
// Mid-sentence abbreviations before lowercase — joined, as always.
check('etc. were stays joined', segs('Apples, etc. were on the list. Done.'), ['Apples, etc. were on the list.', 'Done.'])
check('U.S. Senate stays joined', segs('The U.S. Senate voted today. It passed.'), ['The U.S. Senate voted today.', 'It passed.'])
// Titles never split (F8-3 stands).
check('Gen. Grant stays joined', segs('Gen. Grant won the war. Peace came.'), ['Gen. Grant won the war.', 'Peace came.'])
check('Dr. Smith stays joined', segs('Dr. Smith spoke first. The room listened.'), ['Dr. Smith spoke first.', 'The room listened.'])

console.log(`F8-5 mop-up probe: ${pass}/${pass + fail} PASS`)
process.exitCode = fail ? 1 : 0
