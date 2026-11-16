// AUDIT Wave3 F5: engine-voice cleanup must repair defaultVoice per key
// in place — extra persisted keys inside defaultVoice must survive.
import './audit-w3-f5-setup.ts'
import { settings } from '../src/lib/settings.ts'

const store = (globalThis as any).__f5store as Map<string, string>
let pass = 0, fail = 0
const check = (name: string, ok: boolean) => { if (ok) { pass++; console.log('PASS', name) } else { fail++; console.log('FAIL', name) } }

const dv = settings.get().defaultVoice as Record<string, string>
console.log('dv=', JSON.stringify(dv))
check('bad en id repaired to pk_alba', dv.en === 'pk_alba')
check('good es id kept', dv.es === 'ph_b6FvJAiokjdqIti4')
check('extra key inside defaultVoice SURVIVES (F5)', dv.extraVoiceKey === 'keepme')
const persisted = JSON.parse(store.get('logos.settings.v1')!)
check('persisted defaultVoice also keeps extra key', persisted.defaultVoice?.extraVoiceKey === 'keepme')
check('persisted en repaired too', persisted.defaultVoice?.en === 'pk_alba')
console.log(`F5 probe: ${pass}/${pass + fail} PASS`)
process.exitCode = fail ? 1 : 0
