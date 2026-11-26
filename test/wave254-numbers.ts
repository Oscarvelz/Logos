// 1.4.254 (Oscar, 2026-11-26): «El motor de audio tiene que
// leer manteniendo el género de la palabra y leer también los
// números que están debajo de los miles. En lugar de decir
// cinco noventa, que lea quinientos noventa.» A Spanish
// segment's integers are spelled out in words before the voice
// sees them: composed whole, and agreeing with the noun they
// count. Judged here through speakable(), the whole road.
const { speakable } = await import('../src/lib/text.ts')

let fails = 0
const eq = (got: string, want: string, name: string) => {
  const pass = got === want
  console.log(`${pass ? 'PASS' : 'FAIL'} ${name}${pass ? '' : ` — got «${got}», want «${want}»`}`)
  if (!pass) fails++
}

// His specimens: the composed hundred, and the gender kept.
eq(speakable('Son 590 en total.', 'es'), 'Son quinientos noventa en total.', '590 → quinientos noventa')
eq(speakable('Leyó 1,200 piezas.', 'es'), 'Leyó mil doscientas piezas.', '1,200 piezas → mil doscientas piezas')

// Gender pairs on the same number.
eq(speakable('Hay 200 piezas y 200 libros.', 'es'), 'Hay doscientas piezas y doscientos libros.', '200 fem / masc')
eq(speakable('Son 21 piezas.', 'es'), 'Son veintiuna piezas.', '21 fem')
eq(speakable('Son 21 libros.', 'es'), 'Son veintiún libros.', '21 masc apocope')
eq(speakable('Hay 21 en total.', 'es'), 'Hay veintiuno en total.', '21 citation')
eq(speakable('Tiene 101 piezas y 101 libros.', 'es'), 'Tiene ciento una piezas y ciento un libros.', '101 both genders')
eq(speakable('Tiene 31 días.', 'es'), 'Tiene treinta y un días.', 'día is masculine (exception)')
eq(speakable('Llegaron 500 mujeres.', 'es'), 'Llegaron quinientas mujeres.', 'mujeres feminine (exception)')
eq(speakable('Hay 300 manos.', 'es'), 'Hay trescientas manos.', 'manos feminine (exception)')
eq(speakable('Las 200 piezas llegaron.', 'es'), 'Las doscientas piezas llegaron.', 'the article decides: las')

// Composition across the whole range.
eq(speakable('Hay 100 personas.', 'es'), 'Hay cien personas.', '100 → cien')
eq(speakable('Son 2.000 dólares.', 'es'), 'Son dos mil dólares.', '2.000 → dos mil')
eq(speakable('Leyó 12,345 casos.', 'es'), 'Leyó doce mil trescientos cuarenta y cinco casos.', '12,345 full composition')
eq(speakable('Son 999 piezas.', 'es'), 'Son novecientas noventa y nueve piezas.', '999 fem')
eq(speakable('Hay 0 errores.', 'es'), 'Hay cero errores.', '0 → cero')

// The fences: what is not a plain counted integer stands.
eq(speakable('Cuesta 2,00 dólares.', 'es'), 'Cuesta 2,00 dólares.', 'decimal keeps its digits (252)')
eq(speakable('Son las 09:11 en punto.', 'es'), 'Son las 09:11 en punto.', 'the clock stands whole')
eq(speakable('La versión 1.4.254 salió.', 'es'), 'La versión 1.4.254 salió.', 'version chain stands')
eq(speakable('Subió un 50% este mes.', 'es'), 'Subió un 50% este mes.', 'percent stands')
eq(speakable('El código es 1234567 hoy.', 'es'), 'El código es 1234567 hoy.', 'seven digits stand (a code, not a count)')

// English never rewritten.
eq(speakable('There are 590 pieces and 200 books.', 'en'), 'There are 590 pieces and 200 books.', 'en untouched')

console.log(fails === 0 ? 'ALL PASS' : `${fails} FAILURES`)
process.exit(fails === 0 ? 0 : 1)
