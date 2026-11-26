// 1.4.252 (Oscar, 2026-11-26): «Esta cifra la lee como 2,000
// dólares en lugar de 2 dólares. Entrena el motor de audio para
// que no las confunda.» A Spanish segment's English-shaped
// decimals are rewritten to the Spanish form in speakable()
// before the voice sees them. This bench judges the rewrite and
// its fences: the Spanish forms must come through untouched.
const { spanishDecimals, speakable } = await import('../src/lib/text.ts')

let fails = 0
const eq = (got: string, want: string, name: string) => {
  const pass = got === want
  console.log(`${pass ? 'PASS' : 'FAIL'} ${name}${pass ? '' : ` — got «${got}», want «${want}»`}`)
  if (!pass) fails++
}

// His specimen, verbatim shape: the dot decimal becomes the comma form.
eq(spanishDecimals('El costo de la etapa 1 es: 2.00 dólares, como se acordó.'),
   'El costo de la etapa 1 es: 2,00 dólares, como se acordó.', 'his specimen: 2.00 dólares → 2,00 dólares')

// The Spanish thousands form is NOT a decimal: it stands.
eq(spanishDecimals('Cuesta 2.000 dólares.'), 'Cuesta 2.000 dólares.', '2.000 stays two thousand')
// The full Spanish form stands.
eq(spanishDecimals('Son 1.234,56 dólares.'), 'Son 1.234,56 dólares.', '1.234,56 untouched')
// The full English money form becomes the Spanish one.
eq(spanishDecimals('Son 1,234.56 dólares.'), 'Son 1234,56 dólares.', '1,234.56 → 1234,56')
// Cents shapes rewrite, several in one sentence.
eq(spanishDecimals('Pagó 15.50 dólares y luego 3.75 dólares.'),
   'Pagó 15,50 dólares y luego 3,75 dólares.', 'two decimals in one sentence')
// A dot with one digit is not the named confusion: it stands.
eq(spanishDecimals('La versión 2.5 del sistema.'), 'La versión 2.5 del sistema.', '2.5 untouched')
// A dot with four digits stands.
eq(spanishDecimals('El valor es 3.1416 hoy.'), 'El valor es 3.1416 hoy.', '3.1416 untouched')
// Chained dots are not decimals: they stand.
eq(spanishDecimals('La versión 1.4.250 salió ayer.'), 'La versión 1.4.250 salió ayer.', '1.4.250 untouched')
// Sentence-final decimal before the closing dot.
eq(spanishDecimals('El total fue 2.00.'), 'El total fue 2,00.', 'sentence-final 2.00.')
// A percent rides along.
eq(spanishDecimals('Subió un 2.00% este mes.'), 'Subió un 2,00% este mes.', '2.00% → 2,00%')
// The whole road: speakable() applies it on Spanish segments…
eq(speakable('Cuesta 2.00 dólares.', 'es'), 'Cuesta 2,00 dólares.', 'speakable es rewrites')
// …and never on English ones.
eq(speakable('It costs 2.00 dollars.', 'en'), 'It costs 2.00 dollars.', 'speakable en untouched')

console.log(fails === 0 ? 'ALL PASS' : `${fails} FAILURES`)
process.exit(fails === 0 ? 0 : 1)
