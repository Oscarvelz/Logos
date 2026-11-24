# NOTES-GROK

Notas de la línea `grok-lane`. No sustituyen a `NOTES.md`.
`source` y `main` no se tocan desde aquí.

## Temas eléctricos — ámbar en Tron, impresión en Cyberpunk

La línea se reseteó sobre `source` en 1.4.248 (el pegado a mano ya
integrado). El pulido anterior de esta línea no estaba en `source`
y dejaba el glitch de la marca encendido y un halo amarillo: las
dos cosas contradicen la ley. Esta nota es el reemplazo.

Qué cambió, y por qué. El cian `#00e5ff` sigue siendo el único
acento de Tron. El ámbar es el programa, con el hex de la ley
`#ff9d2a` — no un segundo soberano. Cyberpunk sigue imprimiendo
plano: amarillo `#fcee0a` sin halo, cian `#00f0ff` solo como dato,
magenta `#ff2a6d` solo como neón.

### Archivos

- `src/styles.css` — física de los dos temas.
- `src/pages/SettingsPage.tsx` — la muestra de Tron enseña vacío,
  cian y ámbar. El rojo de Ares sigue en el tema, raro, y ya no
  lidera la muestra.
- `src/lib/es.ts` — la frase de Tron, en español.
- `src/lib/presentation-stage.tsx` — la misma frase en la ficción.

### Tron

- Token `--amber: #ff9d2a`. Favoritos, voces elegidas, enlaces y
  el final de la barra de progreso lo usan. El haz de vuelta y el
  del muelle pasan de `#ffb21e` a ese mismo ámbar.
- Una sola traza ámbar en la retícula, junto a las trazas cian.
- Cada tarjeta lleva una escuadra ámbar de 1px y un filo cian.
  Las bandejas de ajustes llevan el ámbar en el canto izquierdo.
- Movimiento, solo si no hay `prefers-reduced-motion`: los haces
  de antes, más lentos; la marca respira en cian (sombra, no
  deformación); al pasar el cursor la tarjeta alza el filo.
  Con reducción de movimiento no hay animación.

### Cyberpunk

- Campo de puntos impresos, quieto. Las tarjetas pierden el
  brillo de arriba y ganan una escuadra amarilla plana y esquinas
  cortadas. El reproductor pierde el lavado amarillo y lleva, en
  la esquina opuesta, una escuadra cian de dato.
- El botón de reproducir es un anillo duro, no un resplandor.
  La navegación activa es una regla amarilla, no una píldora.
- El neón magenta queda en la estrella de favorito, pequeño.
- Movimiento, bajo la misma puerta: los haces planos, la franja
  de peligro que se desplaza muy lenta, y un glitch de dos
  fotogramas cada 9 segundos. El resto del tiempo la marca está
  limpia. Con reducción de movimiento, nada de eso corre.

## El aro del widget, en Tron

Oscar, con una foto del aro cian alrededor de la λ: el aro de
progreso del widget flotante, en Tron, tiene que ser ámbar — el
segundo color de Tron Legacy.

- `android/.../BubbleService.kt`, `RingView`. La pista, el arco y
  la cuenta del frente usan `#ff9d2a` (255, 157, 42) solo cuando
  la familia es Tron. La λ y el filo de la esfera siguen en cian
  `#00e5ff`. Los otros temas no cambian.
- El retiro del aro al terminar la lectura no se toca.

## Un solo ámbar

Oscar eligió el mockup. El reproductor de Tron es el ciclo, de
punta a punta, como el oro en Legacy: una sola luz.

- El espectro: ámbar quieto en los bordes, `#ffe9a0` en el centro.
- La barra: fondo `#3a3416`, recorrido `#f5c20a`, cabeza `#ffe9a0`.
- El cian se queda en la sala: grilla, título, botones.

La frase sigue en ámbar transparente y la palabra en `#9a7e28`.
El título sigue partiéndose un instante cada once segundos.

## El título, con los dos colores del cartel

Oscar mandó el cartel. El tubo del letrero es `#00f2ff`. El título
de la app, solo en Tron, queda en mayúsculas huecas con ese trazo.
La cara es Orbitron: la construcción del cartel, no su letra.

El ciclo se midió primero en `#ea9e17`. Oscar lo corrigió: más
amarillo, menos naranja. El valor que queda es `#f5c20a`.




