// 1.4.253 (Oscar, 2026-11-26): «En español ni siquiera lo lee
// bien porque interpone una coma. En lugar de leer mil
// doscientos piezas, dice 1 coma docientos. Y en lugar de decir
// dos mil treciento cincuenta y dos pares, dice 2 coma 352. Ese
// es un error de lectura.» The mirror of 252: a Spanish
// segment's English thousands commas become Spanish thousands
// dots before the voice sees them. This bench judges the new
// rule and its fences against the Spanish forms and against
// 252's own rules running in the same function.
const { spanishDecimals, speakable } = await import('../src/lib/text.ts')

let fails = 0
const eq = (got: string, want: string, name: string) => {
  const pass = got === want
  console.log(`${pass ? 'PASS' : 'FAIL'} ${name}${pass ? '' : ` — got «${got}», want «${want}»`}`)
  if (!pass) fails++
}

// His specimens, from the very message he photographed.
eq(spanishDecimals('MSE cerró a las 09:11 con 1,200 piezas acuñadas y 2,352 pares.'),
   'MSE cerró a las 09:11 con 1.200 piezas acuñadas y 2.352 pares.', 'his specimens: 1,200 → 1.200, 2,352 → 2.352')

// Longer chains group by dots.
eq(spanishDecimals('Había 1,234,567 registros.'), 'Había 1.234.567 registros.', '1,234,567 → 1.234.567')
// Five and six digits.
eq(spanishDecimals('Son 12,345 casos y 123,456 en total.'), 'Son 12.345 casos y 123.456 en total.', '12,345 / 123,456')

// A Spanish decimal comma is NOT a thousands group: it stands.
eq(spanishDecimals('Cuesta 2,00 dólares.'), 'Cuesta 2,00 dólares.', '2,00 (Spanish decimal) untouched')
eq(spanishDecimals('Mide 2,5 metros.'), 'Mide 2,5 metros.', '2,5 untouched')
// The full Spanish form stands.
eq(spanishDecimals('Son 1.234,56 dólares.'), 'Son 1.234,56 dólares.', '1.234,56 untouched')
// A Spanish thousands dot stands — and 252's decimal rule must not eat it after this rule runs.
eq(spanishDecimals('Cuesta 2.000 dólares.'), 'Cuesta 2.000 dólares.', '2.000 stands, not eaten as a decimal')

// Interactions with 252 in the same text: both crossings cured at once.
eq(spanishDecimals('Costó 1,234.56 dólares para 1,200 piezas a 2.00 cada una.'),
   'Costó 1234,56 dólares para 1.200 piezas a 2,00 cada una.', 'full form + thousands + decimal together')
// A malformed four-digit group after a comma is not a thousands shape.
eq(spanishDecimals('El código 1,2000 quedó así.'), 'El código 1,2000 quedó así.', '1,2000 untouched')
// A list with spaces is prose, not a number.
eq(spanishDecimals('Trajo 1, 200 no; trajo todo.'), 'Trajo 1, 200 no; trajo todo.', 'comma-space untouched')
// The clock in his message stands (colon time, untouched by every rule).
eq(spanishDecimals('Cerró a las 09:11 en punto.'), 'Cerró a las 09:11 en punto.', '09:11 untouched')

// The whole road, both languages.
eq(speakable('Hay 1,200 piezas.', 'es'), 'Hay 1.200 piezas.', 'speakable es rewrites thousands')
eq(speakable('There are 1,200 pieces.', 'en'), 'There are 1,200 pieces.', 'speakable en untouched')

console.log(fails === 0 ? 'ALL PASS' : `${fails} FAILURES`)
process.exit(fails === 0 ? 0 : 1)
