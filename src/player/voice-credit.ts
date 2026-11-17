/**
 * The voice credit for a finished export (T7-14), computed from the
 * samples each voice actually rendered. In Auto the exporter's pick
 * switches per segment language, so a mixed-language book is sung by
 * several voices; the old credit named only the FIRST segment's
 * voice — for exactly the books per-segment switching exists for,
 * the Library credited a voice that may have sung one sentence.
 *
 * The credit: `voice` names the dominant voice — the one that
 * rendered the most audio (ties go to the first used) — so a
 * single-voice export keeps exactly the credit it always had.
 * `voices` lists every voice used, in first-use order, and is
 * present only when more than one sang.
 */
import { voiceById } from '../lib/voices.ts'

export function voiceCredit(voiceSamples: Map<string, number>): { voice: string; voices?: string[] } {
  const usedVoices = [...voiceSamples.keys()]
  let dominant = usedVoices[0] ?? ''
  for (const id of usedVoices) {
    if ((voiceSamples.get(id) ?? 0) > (voiceSamples.get(dominant) ?? 0)) dominant = id
  }
  const voice = voiceById(dominant)?.id ?? ''
  return usedVoices.length > 1 ? { voice, voices: usedVoices } : { voice }
}
