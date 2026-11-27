// 1.4.257 — Oscar's consistency ruling: Voices is the only
// center for changing the reader's voice. His specimen, verbatim
// from his phone (2026-11-27): Noa wears "Default · Español",
// Marcos wears "Now reading · Español", and no button in Voices
// can make Noa read — «No puedo elegir en voces la que quiero
// predeterminar». This bench judges the cured truth:
// voiceCardTruth offers Make default on every card whose voice
// is not the resolved reader for its language (the stored-but-
// outranked default included), never on the resolved reader's
// own card, and the deed's state change (store the default,
// release the governing pick) makes the predetermined voice
// the resolved reader.
const { voiceCardTruth, resolvedVoiceId, governingOverride, voiceById } = await import('../src/lib/voices.ts')

let fails = 0
const check = (name: string, ok: boolean) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`); if (!ok) fails++ }

const NOA = 'ph_b6FvJAiokjdqIti4'
const MARCOS = 'ph_jvPx8j8zLGQ3utZz'
const ZOEY = 'ph_NbpkqMVS3CJeq2j8'
const LOLA = 'pk_lola'
const noa = voiceById(NOA)!
const marcos = voiceById(MARCOS)!
const zoey = voiceById(ZOEY)!
const lola = voiceById(LOLA)!

// His phone, exactly: default ES = Noa, default EN = Zoey, a
// standing Listen pick of Marcos governing Spanish (auto mode).
const his = { defaultVoice: { en: ZOEY, es: NOA }, voiceOverride: MARCOS, langMode: 'auto' as const }
check('Marcos is the resolved Spanish reader under the pick', resolvedVoiceId(his, 'es') === MARCOS)
check('Noa wears the Default flag', voiceCardTruth(his, noa).flag === 'default')
check('Marcos wears the Now reading flag', voiceCardTruth(his, marcos).flag === 'reading')
check('Noa — the outranked default — is offered Make default', voiceCardTruth(his, noa).makeDefault === true)
check('Marcos — the resolved reader — is offered no Make default', voiceCardTruth(his, marcos).makeDefault === false)
check('Zoey — the resolved English reader — is offered no Make default', voiceCardTruth(his, zoey).makeDefault === false)
check('Lola — neither default nor reader — is offered Make default', voiceCardTruth(his, lola).makeDefault === true)

// The deed, as VoicesPage performs it for Noa: store the
// default (already Noa) and release the governing pick.
const after = {
  defaultVoice: { ...his.defaultVoice, es: NOA },
  voiceOverride: governingOverride(his, 'es') ? null : his.voiceOverride,
  langMode: his.langMode,
}
check('After the deed the pick is released', after.voiceOverride === null)
check('After the deed Noa is the resolved Spanish reader', resolvedVoiceId(after, 'es') === NOA)
check('After the deed Noa is offered no Make default', voiceCardTruth(after, noa).makeDefault === false)

// No pick standing: the default offers nothing, others do.
const plain = { defaultVoice: { en: ZOEY, es: NOA }, voiceOverride: null, langMode: 'auto' as const }
check('No pick: the default offers no Make default', voiceCardTruth(plain, noa).makeDefault === false)
check('No pick: a non-default offers Make default', voiceCardTruth(plain, marcos).makeDefault === true)
check('No pick: Marcos wears no flag', voiceCardTruth(plain, marcos).flag === null)

// Manual mode: the pick governs BOTH languages, so the other
// language's resolved reader is the pick too — and its default
// is likewise offered the deed that releases it.
const manual = { defaultVoice: { en: ZOEY, es: NOA }, voiceOverride: MARCOS, langMode: 'es' as const }
check('Manual mode: Marcos resolves for English too', resolvedVoiceId(manual, 'en') === MARCOS)
check('Manual mode: Zoey is offered Make default', voiceCardTruth(manual, zoey).makeDefault === true)
check('Manual mode: the deed for English also releases the pick', governingOverride(manual, 'en')?.id === MARCOS)

if (fails) { console.log(`wave257: ${fails} FAILURES`); process.exit(1) }
console.log('wave257: ALL PASS')
