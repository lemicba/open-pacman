# SPEC 01 — Cuatro fantasmas con personalidades clásicas

> **Estado:** Approved
> **Depende de:** —
> **Fecha:** 2026-09-28
> **Objetivo:** Los 4 fantasmas clásicos (Blinky, Pinky, Inky, Clyde) con personalidades propias, salida escalonada de la pocilga por temporizador y Blinky persiguiendo agresivamente a Pac-Man.

## Alcance

**Dentro:**

- 4 fantasmas con las personalidades clásicas del arcade:
  - **Blinky** (agresivo): persecución directa sobre la celda de Pac-Man.
  - **Pinky** (emboscador): apunta a 4 celdas delante de la dirección de Pac-Man.
  - **Inky** (flanqueador): su objetivo se calcula con el vector Blinky → (2 celdas delante de Pac-Man), duplicado.
  - **Clyde** (tímido): persigue a Pac-Man, pero se retira a su esquina inferior izquierda cuando está a ≤ 8 celdas (distancia Manhattan).
- Liberación escalonada por temporizador: Blinky 0 s, Pinky 3 s, Inky 6 s, Clyde 9 s, contados desde el arranque de la partida.
- Rebote vertical dentro de la pocilga mientras esperan su turno.
- Re-escalonado completo tras una muerte de Pac-Man con vidas restantes.
- Colores clásicos por fantasma: rojo, rosa, cian, naranja.

**Fuera de alcance (para futuras specs):**

- Modo scatter/frightened y power pellets.
- Velocidades distintas entre fantasmas.
- Liberación por contador de dots (estilo arcade exacto).
- Pathfinding real (BFS/A*); se mantiene el greedy actual.

## Modelo de datos

```js
// maze.js — GHOST_STARTS pasa de 2 a 4 entradas, dentro de la pocilga
const GHOST_STARTS = [
  { x: 12, y: 14, kind: 'blinky', releaseAt: 0 }, // segundos
  { x: 13, y: 14, kind: 'pinky',  releaseAt: 3 },
  { x: 14, y: 14, kind: 'inky',   releaseAt: 6 },
  { x: 15, y: 14, kind: 'clyde',  releaseAt: 9 },
];
```

```js
// game.js — estado por fantasma en createGame()
{
  x, y, dir, speed, kind,
  released: false, // ya salió de la pocilga
}
// y en el estado de la partida:
game.frames = 0; // contador de frames desde el arranque/escalonado
```

Convenciones:

- Coordenadas en celdas, origen arriba-izquierda.
- `releaseAt` en segundos; se compara contra `game.frames / 60` (suposición: `requestAnimationFrame` ≈ 60 fps).
- Kinds `hunter` y `random` actuales se reemplazan por `blinky` / `pinky` / `inky` / `clyde`.

## Plan de implementación

1. `src/js/maze.js`: reemplazar `GHOST_STARTS` por las 4 entradas con `kind` y `releaseAt`. Prueba manual: cargar `src/index.html`, ver 4 fantasmas dentro de la pocilga (colores por índice aún).
2. `src/js/game.js`: en `createGame()`, añadir `released: false` a cada fantasma y `frames: 0` al juego; en `update()`, incrementar `game.frames`. Prueba: el juego corre igual que antes.
3. `src/js/game.js`: rebote vertical en la pocilga mientras `!released` (subir/bajar entre y 13 e y 15 en su columna, invirtiendo dirección), sin colisionar con Pac-Man (la puerta ya lo bloquea). Prueba: los 4 rebotan, ninguno sale.
4. `src/js/game.js`: liberación — cuando `game.frames >= releaseAt * 60`, marcar `released` y forzar `dir: 'up'` hasta alinear en y 11 (fuera de la pocilga); recién ahí entra a `decideGhost`. Prueba: salen de a uno a los 0/3/6/9 s.
5. `src/js/game.js`: reescribir `decideGhost()` con las 4 personalidades (greedy: entre las direcciones sin reversa, elegir la de menor distancia Manhattan al objetivo propio de cada kind). Inky necesita acceder a la posición de Blinky → búsqueda por `kind`, no por índice. Prueba: Blinky acosa directo; Pinky se adelanta; Inky flanquea; Clyde se retira al acercarse.
6. `src/js/render.js`: `GHOST_COLORS` pasa de array por índice a mapa por `kind` (`blinky: '#ff0000'`, `pinky: '#ffb8ff'`, `inky: '#00ffff'`, `clyde: '#ffb852'`). Prueba: colores clásicos correctos.
7. `src/js/game.js`: en `resetPositions()`, restablecer `released: false`, dirección de rebote y `game.frames = 0` (re-escalonado). Prueba: morir con vidas restantes reinicia el escalonado 0/3/6/9 s.

## Criterios de aceptación

- [ ] Al iniciar la partida, los 4 fantasmas están dentro de la pocilga y solo Blinky sale de inmediato.
- [ ] Pinky, Inky y Clyde salen aproximadamente a los 3, 6 y 9 segundos respectivamente.
- [ ] Mientras esperan, los fantasmas rebotan verticalmente dentro de la pocilga sin salir de ella.
- [ ] Blinky toma de forma sistemática el camino que reduce su distancia a Pac-Man.
- [ ] Pinky se dirige a la celda 4 posiciones delante de la dirección actual de Pac-Man.
- [ ] Inky calcula su objetivo usando la posición de Blinky (flanqueo).
- [ ] Clyde se retira hacia la esquina inferior izquierda cuando está a ≤ 8 celdas de Pac-Man.
- [ ] Tras una muerte con vidas restantes, los 4 vuelven a la pocilga y el escalonado se reinicia en 0/3/6/9 s.
- [ ] Los colores son rojo (Blinky), rosa (Pinky), cian (Inky) y naranja (Clyde).
- [ ] Los 4 mantienen velocidad 1/10 de celda por frame.
- [ ] Una partida completa (ganada o perdida) y su reinicio no producen errores en la consola.

## Decisiones

- **Sí:** personalidades clásicas arcade. Elegido por el usuario; son distintas entre sí y verificables una por una.
- **Sí:** liberación por temporizador 0/3/6/9 s. Elegido por el usuario; determinista y fácil de verificar a ojo.
- **Sí:** rebote vertical mientras esperan y re-escalonado tras muerte. Elegidos por el usuario; consistentes con el arranque.
- **Sí:** misma velocidad (1/10) para los 4. AGENTS.md advierte que fracciones arbitrarias rompen el realineado en celdas enteras.
- **Sí:** reemplazar `hunter`/`random` por los kinds clásicos. Nomenclatura canónica del arcade.
- **Sí:** distancia Manhattan y elección greedy (sin BFS). Reutiliza la lógica del hunter actual; suficiente para el MVP.
- **Sí:** temporizador en frames (`game.frames`, ~60 fps por rAF). Sin relojes externos ni `Date`; tolerable para un MVP.
- **Sí:** esquina de retiro de Clyde = celda (1, 29), inferior izquierda.
- **No:** reproducir el bug del arcade en Pinky (4 arriba + 4 a la izquierda). Complica la spec sin valor de juego.
- **No:** scatter/frightened/power pellets. Fuera de alcance; merecen su propia spec.
- **No:** liberación por contador de dots. El temporizador es más simple y determinista.

## Riesgos

| Riesgo                                                                                | Mitigación                                   |
| ------------------------------------------------------------------------------------- | -------------------------------------------- |
| `requestAnimationFrame` no garantiza 60 fps exactos                                  | Tolerable en un MVP; suposición documentada  |
| Inky depende de la posición de Blinky                                                 | Búsqueda por `kind`, no por índice           |
| La puerta (3) no bloquea fantasmas: si la lógica de rebote se rompe, cualquiera saldría antes de tiempo | Aceptado; verificación manual de los tiempos |

## Qué **no** está en esta spec

- Power pellets y modo asustado (fantasmas comestibles).
- Alternancia perseguir/dispersarse (scatter) con cronómetro de fases.
- Velocidades distintas por fantasma.
- Liberación por dots comidos.

Cada uno de esos, si llega, va en su propia spec.
