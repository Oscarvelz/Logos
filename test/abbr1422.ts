import { speakable, segmentText } from '/workspace/work/voz/src/lib/text.ts'
for (const t of ["Las elecciones de 'midterms' en EEUU: significado.", "Viajó a EE.UU. y luego a EE. UU. con E.E.U.U. en mente.", "El Sr. López habló con RR.HH. del Ministerio.", "La palabra fuente no cambia; tampoco EEUUX ni UU."]) console.log(speakable(t,'es'))
console.log(speakable('The U.S. and the U.K. met in the USA.', 'en'))
console.log(segmentText('Viajó a EE. UU. el lunes. Luego volvió a casa.', 'es').map(s=>s.text))
