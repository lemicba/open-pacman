# SPEC 02 — Power pellets y modo asustado

> **Estado:** Approved
> **Depende de:** SPEC 01
> **Fecha:** 2026-09-28
> **Objetivo:** 4 power pellets (2 arriba, 2 abajo) que asustan a los fantasmas liberados durante 8 segundos (azules, cara dolida, huyen de Pac-Man, comestibles con cadena 200/400/800/1600) y los comidos vuelven a la pocilga como ojos para salir escalonados tras el poder.

## Alcance

**Dentro:**

- 4 power pellets en las celdas con dot más cercanas a las 4 esquinas del área de juego (2 arriba, 2 abajo), usando un valor de grilla nuevo.
- Visual de la pellet: punto grande parpadeante (alterna visible/invisible cada ~10 frames mientras esté en el mapa).
- Comer una pellet suma 50 puntos y activa el modo asustado por 8 segundos (480 frames).
- Solo se asustan los fantasmas liberados en el mapa; los que esperan en la pocilga y los ojos en camino no.
- Fantasmas asustados: cuerpo azul, cara dolida (ojos blancos puntiagudos y boca ondulada), huyen de Pac-Man (greedy que maximiza distancia Manhattan) a velocidad 1/20.
- Aviso de fin: los últimos ~2 segundos (120 frames) alternan azul ↔ color original cada ~10 frames.
- Comer fantasma asustado: 200 / 400 / 800 / 1600 puntos (doble del anterior, `200 * 2**chainIndex`).
- Fantasma comido se convierte en ojos que viajan por el laberinto hasta la pocilga, sin dañar ni ser comible.
- Al llegar a la pocilga, el fantasma recupera su color y rebota como al arranque hasta poder salir.
- Salida escalonada corta tras el fin del poder: Blinky 0 s, Pinky 1 s, Inky 2 s, Clyde 3 s.
- Segunda pellet con poder activo: reinicia el cronómetro a 8 s y la cadena vuelve a 200; re-asusta solo a los fantasmas liberados en el mapa.
- Muerte de Pac-Man durante el poder: se cancela el estado del poder y corre el re-escalonado de SPEC 01.

**Fuera de alcance (para futuras specs):**

- Popups flotantes con el puntaje de cada fantasma comido.
- Modo scatter (alternancia perseguir/dispersarse).
- Duración del poder decreciente por nivel.
- Sonidos.

## Modelo de datos

```js
// src/js/maze.js — valor de celda nuevo
// 4 = power pellet (reemplaza al dot 2 en las 4 celdas elegidas)

// src/js/game.js — estado del juego en createGame()
game.power = {
  active: false,
  framesLeft: 0,   // 480 = 8 s * 60
  chainIndex: 0,   // 0→200, 1→400, 2→800, 3→1600
  endAtFrames: 0,  // frame absoluto de expiración (para el stagger de salida)
};

// src/js/game.js — estado por fantasma
{
  x, y, dir, speed, kind, released,
  mode: 'normal' | 'frightened' | 'eaten', // eaten = ojos volviendo a la pocilga
  exitAt: 0, // frame absoluto a partir del cual puede salir de la pocilga
}
```

Convenciones:

- La velocidad de un fantasma **solo cambia cuando está realineado en una celda entera**; hasta entonces mantiene la velocidad actual (regla de AGENTS.md sobre fracciones y realineado).
- Al ser comido, el fantasma se alinea a la celda entera más cercana y pasa a velocidad 1/5 (ojos).
- `exitAt = max(frame de llegada a la pocilga, power.endAtFrames + índiceDeKind * 60)` con índice Blinky 0, Pinky 1, Inky 2, Clyde 3.

## Plan de implementación

1. `src/js/maze.js`: elegir las 4 celdas (el dot más cercano a cada esquina) y cambiar su valor de 2 a 4. Prueba manual: cargar `src/index.html`, ver los 4 puntos grandes en las esquinas.
2. `src/js/render.js`: dibujar la power pellet con radio mayor que el dot, parpadeando (visible/invisible cada ~10 frames según `game.frames`). Prueba: parpadean las 4.
3. `src/js/game.js`: comer la pellet (celda 4 → vacío, +50 puntos, `power.active`, `framesLeft: 480`, `chainIndex: 0`, `endAtFrames`); los fantasmas con `released && mode === 'normal'` pasan a `frightened`. Prueba: al comerla, los libres se ponen azules.
4. `src/js/game.js`: en `update()`, descontar `framesLeft`; velocidad asustada 1/20 aplicada solo en celdas enteras (regla del modelo de datos); al llegar a 0, todos los `frightened` vuelven a `normal` (velocidad 1/10, también solo en celda entera). Prueba: duran ~8 s y vuelven a la normalidad.
5. `src/js/game.js`: `decideGhost()` con `mode === 'frightened'` elige la dirección (sin reversa) que **maximiza** la distancia Manhattan a Pac-Man. Prueba: los azules le huyen.
6. `src/js/render.js`: cuerpo azul (`#2121ff`), ojos blancos puntiagudos y boca ondulada para `frightened`; flash azul ↔ color original durante los últimos 120 frames. Prueba: cara dolida visible y aviso de fin.
7. `src/js/game.js`: colisión con fantasma `frightened` → sumar `200 * 2**chainIndex`, `chainIndex++`, fantasma a `mode: 'eaten'` (snap a celda entera, velocidad 1/5, ruta BFS hasta la celda de la puerta, luego forzar `down` hasta su celda de `GHOST_STARTS`). Prueba: ojos viajan, llegan a la pocilga y recobran el color.
8. `src/js/game.js`: llegada a la pocilga → `mode: 'normal'`, rebote vertical de SPEC 01, `exitAt` según convención; salida de la pocilga cuando `game.frames >= exitAt` con la mecánica de dos fases de SPEC 01. Prueba: tras el poder salen escalonados 0/1/2/3 s.
9. `src/js/game.js`: segunda pellet con `power.active` → reinicia `framesLeft: 480`, `endAtFrames` y `chainIndex: 0`; re-asusta solo a los `released && mode === 'normal'`. Prueba: cadena vuelve a 200.
10. `src/js/game.js`: muerte de Pac-Man con `power.active` → cancelar `power`, todos los fantasmas a `normal` (velocidad 1/10) y correr el re-escalonado de SPEC 01. Prueba: morir durante el poder reinicia limpio.

## Criterios de aceptación

- [ ] Hay exactamente 4 power pellets: 2 arriba y 2 abajo, parpadeantes.
- [ ] Comer una pellet suma 50 puntos y asusta solo a los fantasmas liberados en el mapa.
- [ ] Los fantasmas asustados son azules con cara dolida y se alejan de Pac-Man.
- [ ] Los fantasmas asustados se mueven más lento que en modo normal.
- [ ] El poder dura 8 segundos.
- [ ] Los últimos ~2 segundos los fantasmas alternan azul y su color original.
- [ ] Comer el 1.er fantasma asustado da 200, el 2.º 400, el 3.º 800 y el 4.º 1600.
- [ ] El fantasma comido se convierte en ojos que viajan por el laberinto hasta la pocilga.
- [ ] Los ojos no matan a Pac-Man ni pueden ser comidos otra vez.
- [ ] El fantasma comido recupera su color apenas llega a la pocilga.
- [ ] Tras el fin del poder, los comidos salen escalonados a 0/1/2/3 s (Blinky/Pinky/Inky/Clyde).
- [ ] Si el poder expira mientras los ojos aún viajan, salen apenas llegan a la pocilga.
- [ ] Una segunda pellet con el poder activo reinicia el cronómetro y la cadena vuelve a 200.
- [ ] Una muerte de Pac-Man durante el poder cancela el estado del poder sin errores.
- [ ] Una partida completa (ganada o perdida) y su reinicio no producen errores en la consola.

## Decisiones

- **Sí:** 8 segundos de poder. Elegido por el usuario.
- **Sí:** huir de Pac-Man (greedy que maximiza Manhattan). Elegido por el usuario; reutiliza `decideGhost`.
- **Sí:** velocidad asustada 1/20. Elegido por el usuario; los cambios de velocidad solo en celda entera por la regla de realineado de AGENTS.md.
- **Sí:** ojos viajando a la pocilga con BFS. Elegido por el usuario; SPEC 01 descartó BFS para perseguir, pero los ojos necesitan llegada garantizada (el greedy puede ciclar). Grilla chica y estática: costo trivial.
- **Sí:** snap a celda entera al ser comido y velocidad de ojos 1/5. El realineado exige partir de celda entera al cambiar velocidad.
- **Sí:** 50 puntos por pellet. Valor clásico del arcade; el usuario no lo mencionó.
- **Sí:** valor de grilla 4 para la pellet. Distinto del dot 2 para no reciclar lógica de puntos.
- **Sí:** los ojos y los fantasmas en la pocilga no se re-asustan con una segunda pellet. Como el arcade.
- **Sí:** escalonado corto 0/1/2/3 s. Elegido por el usuario.
- **No:** teletransporte de ojos a la pocilga. Era la opción simple; el usuario eligió los ojos viajando.
- **No:** popups flotantes de puntaje, scatter, duración por nivel, sonidos. Fuera de alcance.

## Riesgos

| Riesgo | Mitigación |
| ------ | ---------- |
| Cambiar velocidad a mitad de celda rompe el realineado entero | La velocidad solo cambia en celdas enteras; volver a 1/10 demora como máximo ~19 frames |
| La huida greedy puede arrinconar a un fantasma asustado | Aceptado para el MVP: es justamente lo que permite comerlo |
| BFS contradice la decisión "sin pathfinding" de SPEC 01 | Acotado a los ojos; la persecución sigue greedy |
| `requestAnimationFrame` no garantiza 60 fps | Suposición ya documentada en SPEC 01; los 8 s son aproximados |

## Qué **no** está en esta spec

- Popups flotantes con el puntaje de cada fantasma comido.
- Alternancia perseguir/dispersarse (scatter).
- Duración del poder decreciente por nivel.
- Sonidos.

Cada uno de esos, si llega, va en su propia spec.
