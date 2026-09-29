// game.js
// Estado y reglas. Depende de globals de maze.js: MAZE, TUNNEL_ROW,
// PACMAN_START, GHOST_STARTS.

const DIRS = {
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
};
const OPPOSITE = { left: 'right', right: 'left', up: 'down', down: 'up' };

const PACMAN_SPEED = 0.125; // 1/8 celda/frame -> alinea cada 8 frames
const GHOST_SPEED = 0.1;    // 1/10 celda/frame
const FRIGHTENED_SPEED = 0.05; // 1/20 celda/frame (asustado)
const EATEN_SPEED = 0.2;        // 1/5 celda/frame (ojos volviendo a la pocilga)

// Crea una partida nueva. Copia MAZE (pristino) a game.grid para poder comer
// dots sin destruir el original, y reiniciar.
function createGame() {
  const grid = MAZE.map( ( row ) => row.slice() );
  // La celda de inicio de Pacman arranca sin dot.
  grid[ PACMAN_START.y ][ PACMAN_START.x ] = 0;

  let dots = 0;
  for ( const row of grid )
    for ( const v of row ) if ( v === 2 || v === 4 ) dots++;

  return {
    state: 'start',
    score: 0,
    lives: 3,
    frames: 0, // frames desde el arranque/escalonado (60 ≈ 1 s)
    dotsRemaining: dots,
    power: {
      active: false,
      framesLeft: 0, // 480 = 8 s * 60
      chainIndex: 0, // 0→200, 1→400, 2→800, 3→1600
      endAtFrames: 0, // frame absoluto de expiracion (para el stagger de salida)
    },
    grid,
    pacman: {
      x: PACMAN_START.x,
      y: PACMAN_START.y,
      dir: 'left',
      nextDir: null,
      speed: PACMAN_SPEED,
    },
    ghosts: GHOST_STARTS.map( ( g ) => ( {
      x: g.x,
      y: g.y,
      dir: 'up',
      speed: GHOST_SPEED,
      kind: g.kind,
      releaseAt: g.releaseAt,
      released: false,
      mode: 'normal', // 'normal' | 'frightened' | 'eaten' (ojos volviendo a la pocilga)
      exitAt: 0, // frame absoluto a partir del cual puede salir de la pocilga
    } ) ),
  };
}

function aligned( v ) {
  return Math.abs( v - Math.round( v ) ) < 1e-3;
}

// Una celda es muro para el actor dado?
//   pacman: bloqueado por pared (1) y puerta (3)
//   ghost:  bloqueado solo por pared (1)
function isWall( grid, x, y, actor ) {
  if ( y < 0 || y >= grid.length ) return true;
  if ( x < 0 || x >= grid[ 0 ].length ) return true;
  const v = grid[ y ][ x ];
  if ( v === 1 ) return true;
  if ( v === 3 && actor === 'pacman' ) return true;
  return false;
}

// Puede el actor avanzar desde (x,y) en la direccion dir?
function canMove( grid, x, y, dir, actor ) {
  const d = DIRS[ dir ];
  if ( !d ) return false;
  const tx = x + d.x;
  const ty = y + d.y;
  // Tunel: salir por un borde en la fila del tunel siempre es valido.
  if ( ty === TUNNEL_ROW && ( tx < 0 || tx >= grid[ 0 ].length ) ) return true;
  return !isWall( grid, tx, ty, actor );
}

function wrapTunnel( a, width ) {
  if ( Math.round( a.y ) === TUNNEL_ROW ) {
    if ( a.x < 0 ) a.x += width;
    else if ( a.x >= width ) a.x -= width;
  }
}

// Activa el modo asustado: 8 s, cadena 200..1600. Re-asusta solo a los
// fantasmas liberados en el mapa; la pocilga y los ojos no se asustan.
function activatePower( game ) {
  game.power.active = true;
  game.power.framesLeft = 480; // 8 s * 60
  game.power.chainIndex = 0;
  game.power.endAtFrames = game.frames + game.power.framesLeft;
  game.ghosts.forEach( ( g ) => {
    if ( g.released && g.mode === 'normal' ) g.mode = 'frightened';
  } );
}

function movePacman( game ) {
  const p = game.pacman;
  const grid = game.grid;
  const width = grid[ 0 ].length;

  if ( aligned( p.x ) && aligned( p.y ) ) {
    p.x = Math.round( p.x );
    p.y = Math.round( p.y );

    // Aplicar giro pendiente si es posible.
    if ( p.nextDir && canMove( grid, p.x, p.y, p.nextDir, 'pacman' ) ) {
      p.dir = p.nextDir;
      p.nextDir = null;
    }
    // Comer dot.
    if ( grid[ p.y ][ p.x ] === 2 ) {
      grid[ p.y ][ p.x ] = 0;
      game.score += 10;
      game.dotsRemaining--;
    }
    // Comer power pellet.
    if ( grid[ p.y ][ p.x ] === 4 ) {
      grid[ p.y ][ p.x ] = 0;
      game.score += 50;
      game.dotsRemaining--;
      activatePower( game );
    }
    // Si no puede seguir, se detiene en la celda.
    if ( !canMove( grid, p.x, p.y, p.dir, 'pacman' ) ) return;
  }

  const d = DIRS[ p.dir ];
  p.x += d.x * p.speed;
  p.y += d.y * p.speed;
  wrapTunnel( p, width );
}

// Objetivo de cada fantasma segun su personalidad clasica del arcade.
function ghostTarget( game, g ) {
  const p = game.pacman;
  const px = Math.round( p.x );
  const py = Math.round( p.y );

  if ( g.kind === 'blinky' ) {
    // Agresivo: persecucion directa sobre la celda de Pac-Man.
    return { x: px, y: py };
  }
  if ( g.kind === 'pinky' ) {
    // Emboscador: 4 celdas delante de la direccion de Pac-Man.
    const d = DIRS[ p.dir ];
    return { x: px + d.x * 4, y: py + d.y * 4 };
  }
  if ( g.kind === 'inky' ) {
    // Flanqueador: vector Blinky -> (2 celdas delante de Pac-Man), duplicado.
    const blinky = game.ghosts.find( ( gh ) => gh.kind === 'blinky' );
    const d = DIRS[ p.dir ];
    const ax = px + d.x * 2;
    const ay = py + d.y * 2;
    return {
      x: 2 * ax - Math.round( blinky.x ),
      y: 2 * ay - Math.round( blinky.y ),
    };
  }
  // Clyde, timido: persigue, pero a <= 8 celdas (Manhattan) se retira
  // a su esquina inferior izquierda (1, 29).
  const dist = Math.abs( g.x - px ) + Math.abs( g.y - py );
  if ( dist <= 8 ) return { x: 1, y: 29 };
  return { x: px, y: py };
}

function decideGhost( game, g ) {
  const grid = game.grid;

  const options = Object.keys( DIRS ).filter(
    ( dir ) => dir !== OPPOSITE[ g.dir ] && canMove( grid, g.x, g.y, dir, 'ghost' )
  );
  // Sin salida (callejon): permitir el giro de 180.
  const choices = options.length ? options : [ '' + OPPOSITE[ g.dir ] ];

  // Asustado: huye de Pac-Man. Greedy sobre la misma lista de opciones sin
  // reversa, pero MAXIMIZANDO la distancia Manhattan a la celda de Pac-Man.
  const maximize = g.mode === 'frightened';
  const target = maximize
    ? { x: Math.round( game.pacman.x ), y: Math.round( game.pacman.y ) }
    : ghostTarget( game, g );
  const sign = maximize ? -1 : 1;

  // Greedy: entre las direcciones sin reversa, la de menor distancia
  // Manhattan al objetivo propio del kind (negada para maximizar).
  let best = choices[ 0 ];
  let bestDist = Infinity;
  for ( const dir of choices ) {
    const d = DIRS[ dir ];
    const dist =
      sign *
      ( Math.abs( g.x + d.x - target.x ) + Math.abs( g.y + d.y - target.y ) );
    if ( dist < bestDist ) {
      bestDist = dist;
      best = dir;
    }
  }
  g.dir = best;
}

// Ruta BFS (distancia minima) desde una celda a otra por celdas
// transitables para fantasma (incluye puerta y pocilga). Especifica de
// los ojos: SPEC 01 descarto pathfinding para perseguir, pero los ojos
// necesitan llegada garantizada (el greedy puede ciclar).
function bfsRoute( grid, fromX, fromY, toX, toY ) {
  const W = grid[ 0 ].length;
  const key = ( x, y ) => y * W + x;
  const prev = new Map();
  prev.set( key( fromX, fromY ), null );
  const queue = [ key( fromX, fromY ) ];

  while ( queue.length ) {
    const cur = queue.shift();
    const cx = cur % W;
    const cy = Math.floor( cur / W );
    if ( cx === toX && cy === toY ) break;
    for ( const d of Object.values( DIRS ) ) {
      const nx = cx + d.x;
      const ny = cy + d.y;
      if ( isWall( grid, nx, ny, 'ghost' ) ) continue;
      const k = key( nx, ny );
      if ( prev.has( k ) ) continue;
      prev.set( k, cur );
      queue.push( k );
    }
  }

  // Reconstruir destino -> origen, voltear y quitar la celda inicial.
  const route = [];
  let cur = key( toX, toY );
  if ( !prev.has( cur ) ) return route; // inalcanzable (no deberia pasar)
  while ( cur !== null ) {
    route.push( { x: cur % W, y: Math.floor( cur / W ) } );
    cur = prev.get( cur );
  }
  route.reverse();
  route.shift();
  return route;
}

// Come un fantasma asustado: cadena 200/400/800/1600 y el fantasma
// vuelve como ojos (snap a celda entera, velocidad 1/5, ruta BFS
// hasta la celda de la puerta mas cercana).
function eatGhost( game, g ) {
  game.score += 200 * 2 ** game.power.chainIndex;
  game.power.chainIndex++;
  g.mode = 'eaten';
  g.x = Math.round( g.x );
  g.y = Math.round( g.y );
  g.speed = EATEN_SPEED;
  const doorX = g.x <= 13 ? 13 : 14;
  g.route = bfsRoute( game.grid, g.x, g.y, doorX, 12 );
  g.routeIndex = 0;
}

// Ojos volviendo a la pocilga: siguen la ruta BFS hasta la celda de la
// puerta, bajan hasta la fila de inicio (y 14) y avanzan horizontal
// hasta su celda de GHOST_STARTS. Al llegar: color y estado de pocilga.
function moveEaten( game, g ) {
  if ( aligned( g.x ) && aligned( g.y ) ) {
    g.x = Math.round( g.x );
    g.y = Math.round( g.y );

    const start = GHOST_STARTS.find( ( s ) => s.kind === g.kind );

    // Llegada a su celda de inicio: recupera color y estado de pocilga.
    if ( g.x === start.x && g.y === start.y ) {
      g.mode = 'normal';
      g.released = false;
      g.dir = 'up'; // rebote vertical de la pocilga
      g.speed = GHOST_SPEED;
      g.route = null;
      return;
    }

    let target;
    if ( g.routeIndex < g.route.length ) {
      // Fase 1: siguiente celda de la ruta BFS hacia la puerta.
      const next = g.route[ g.routeIndex ];
      if ( g.x === next.x && g.y === next.y ) g.routeIndex++;
      if ( g.routeIndex < g.route.length ) target = g.route[ g.routeIndex ];
    }
    if ( !target ) {
      // Ruta agotada: en la puerta. Bajar a la fila de inicio y luego
      // ir horizontal hasta su celda (dentro de la pocilga).
      target = g.y === 14 ? { x: start.x, y: 14 } : { x: g.x, y: 14 };
    }

    g.dir =
      target.x < g.x ? 'left' :
      target.x > g.x ? 'right' :
      target.y < g.y ? 'up' : 'down';
  }

  const d = DIRS[ g.dir ];
  g.x += d.x * g.speed;
  g.y += d.y * g.speed;
}

function moveGhost( game, g ) {
  const grid = game.grid;
  const width = grid[ 0 ].length;

  // Ojos volviendo a la pocilga: logica propia, no dañan ni son comibles.
  if ( g.mode === 'eaten' ) {
    moveEaten( game, g );
    return;
  }

  // Aun no liberado: rebote vertical en la pocilga (y entre 13 y 15),
  // invertiendo direccion en los extremos. La puerta ya bloquea a Pac-Man.
  // Liberado por temporizador (game.frames >= releaseAt * 60): salida en
  // dos fases hasta alinear en y 11; la puerta solo existe en x 13-14, asi
  // que quien esta en x 12/15 primero se corre a la columna de puerta mas
  // cercana. Recien alineado en y 11 se marca released y decideGhost manda.
  if ( !g.released ) {
    if ( game.frames < g.releaseAt * 60 ) {
      if ( aligned( g.x ) && aligned( g.y ) ) {
        g.y = Math.round( g.y );
        if ( g.y <= 13 ) g.dir = 'down';
        else if ( g.y >= 15 ) g.dir = 'up';
      }
      const d = DIRS[ g.dir ];
      g.x += d.x * g.speed;
      g.y += d.y * g.speed;
      return;
    }
    // Fase 1: terminar el rebote hasta alinear en y entera.
    if ( !aligned( g.y ) ) {
      const d = DIRS[ g.dir ];
      g.y += d.y * g.speed;
      return;
    }
    g.y = Math.round( g.y );
    // Fase 2: horizontal hasta la columna de la puerta (x 13 o 14).
    const doorX = Math.round( g.x ) <= 13 ? 13 : 14;
    if ( Math.round( g.x ) !== doorX ) {
      g.dir = g.x < doorX ? 'right' : 'left';
      g.x += DIRS[ g.dir ].x * g.speed;
      return;
    }
    g.x = doorX;
    // Fase 3: subir cruzando la puerta hasta alinear en y 11.
    if ( g.y > 11 + 1e-3 ) {
      g.dir = 'up';
      g.y -= g.speed;
      return;
    }
    g.y = 11;
    g.released = true; // fuera de la pocilga: sigue el flujo normal
  }

  if ( aligned( g.x ) && aligned( g.y ) ) {
    g.x = Math.round( g.x );
    g.y = Math.round( g.y );
    // Cambio de velocidad solo en celda entera (regla de realineado);
    // a mitad de celda el fantasma mantiene la velocidad actual.
    g.speed = g.mode === 'frightened' ? FRIGHTENED_SPEED : GHOST_SPEED;
    decideGhost( game, g );
    if ( !canMove( grid, g.x, g.y, g.dir, 'ghost' ) ) return;
  }

  const d = DIRS[ g.dir ];
  g.x += d.x * g.speed;
  g.y += d.y * g.speed;
  wrapTunnel( g, width );
}

function resetPositions( game ) {
  const p = game.pacman;
  p.x = PACMAN_START.x;
  p.y = PACMAN_START.y;
  p.dir = 'left';
  p.nextDir = null;
  game.frames = 0; // re-escalonado de la liberacion (0/3/6/9 s)
  game.ghosts.forEach( ( g, i ) => {
    g.x = GHOST_STARTS[ i ].x;
    g.y = GHOST_STARTS[ i ].y;
    g.dir = 'up'; // direccion inicial del rebote en la pocilga
    g.released = false;
  } );
}

function collides( a, b ) {
  return Math.abs( a.x - b.x ) < 0.5 && Math.abs( a.y - b.y ) < 0.5;
}

function update( game ) {
  game.frames++;

  // Cronometro del poder: al llegar a 0, todos los frightened vuelven a
  // normal. La velocidad 1/10 se recupera recien al realinear en celda entera.
  // (Antes de los movimientos para que la expiracion coincida con endAtFrames.)
  if ( game.power.active ) {
    game.power.framesLeft--;
    if ( game.power.framesLeft <= 0 ) {
      game.power.active = false;
      game.power.framesLeft = 0;
      game.ghosts.forEach( ( g ) => {
        if ( g.mode === 'frightened' ) g.mode = 'normal';
      } );
    }
  }

  movePacman( game );
  game.ghosts.forEach( ( g ) => moveGhost( game, g ) );

  for ( const g of game.ghosts ) {
    if ( !collides( game.pacman, g ) ) continue;
    // Ojos: no dañan a Pac-Man ni pueden ser comidos otra vez.
    if ( g.mode === 'eaten' ) continue;
    // Asustado: se lo come Pac-Man (cadena 200/400/800/1600).
    if ( g.mode === 'frightened' ) {
      eatGhost( game, g );
      continue;
    }
    game.lives--;
    if ( game.lives <= 0 ) {
      game.state = 'lost';
      return;
    }
    resetPositions( game );
    break;
  }

  if ( game.dotsRemaining <= 0 ) game.state = 'won';
}

window.createGame = createGame;
window.update = update;
window.DIRS = DIRS;
