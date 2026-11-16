// AUDIT Wave3 T4-12: deliberate deleteModel() must clear logos.kept
// stamps + keep note, so next launch does not blame the phone.
import './audit-w3-del-setup.ts'
import { deleteModel, engine } from '../src/engine/engine.ts'

const store = (globalThis as any).__delstore as Map<string, string>
let pass = 0, fail = 0
const check = (name: string, ok: boolean) => { if (ok) { pass++; console.log('PASS', name) } else { fail++; console.log('FAIL', name) } }

check('premise: stamps seeded', !!store.get('logos.kept'))
await deleteModel()
check('logos.kept gone after deleteModel', store.get('logos.kept') === undefined)
check('logos.keepNote gone after deleteModel', store.get('logos.keepNote') === undefined)
check('pocket digest registry gone after deleteModel', store.get('logos.pocketDigests') === undefined)
check('engine reports not cached after deleteModel', engine.get().cached === false)
console.log(`T4-12 probe: ${pass}/${pass + fail} PASS`)
process.exitCode = fail ? 1 : 0
