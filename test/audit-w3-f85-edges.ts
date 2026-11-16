// AUDIT Wave 3 — F8-5 edge sweep (supplement to audit-w3-create-intake.ts):
// does the now-conditional ABBREV guard over-split abbreviations that
// legitimately precede a capital mid-sentence?
import { segmentText } from '../src/lib/text.ts'
const segs = (t: string) => segmentText(t).map((s) => s.text)
for (const t of [
  'See Fig. A for details. It helps.',
  'He read Vol. II today. It was good.',
  'He bought apples, etc. She went home.',
  'Meet me at approx. Noon Hall. Come early.',
  'It was published in Jan. Jones spoke later.',
]) console.log(JSON.stringify(t), '=>', JSON.stringify(segs(t)))
process.exitCode = 0
