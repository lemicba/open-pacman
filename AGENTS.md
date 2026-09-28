# AGENTS.md

Pac-Man MVP in vanilla JS/HTML/CSS. Learning project for spec-driven development. There is **no build tooling, no tests, no linter** — do not assume `npm run *`, lint, or typecheck commands exist.

## Run / verify

Open `src/index.html` directly in a browser (no dev server, no bundler). Verification is manual: play a round and check win/lose/overlay states.

## Architecture — no modules, script load order is a hard dependency chain

All files are plain `<script>` tags sharing globals — no ES modules, no imports. Order in `src/index.html`:

```
maze.js → game.js → render.js → main.js
```

- `maze.js` — maze data and constants: `MAZE` (2D number grid), `TUNNEL_ROW`, `PACMAN_START`, `GHOST_STARTS`
- `game.js` — state and rules: `createGame()`, `update(game)`; consumes maze.js globals
- `render.js` — all canvas drawing: `draw(ctx, game, frame)`
- `main.js` — game loop, keyboard input, overlay screens; consumes `createGame`/`update`/`draw`

When adding a file, add its `<script>` tag in `src/index.html` **after** its dependencies. Watch out for global name collisions.

## Game-engine quirks

- Grid cell values: `0` empty, `1` wall, `2` dot, `3` ghost door. The door blocks Pac-Man but not ghosts (`isWall` takes an `actor` arg).
- Actor positions are floats in cell units. Speeds are per-frame fractions (`PACMAN_SPEED = 1/8`, `GHOST_SPEED = 1/10`) chosen so actors realign on integer cells; changing a speed to an arbitrary fraction breaks the turning logic.
- `createGame()` copies `MAZE` into `game.grid` so dots can be eaten while `MAZE` stays pristine for restarts.
- `TUNNEL_ROW` (14) wraps horizontally.
- Canvas is 560×620, `TILE = 20`.

## Spec-driven workflow

This repo exists to practice spec-driven development:

- Specs live in `specs/`, named `NN-slug`. When adding a spec, match the language and section structure of existing ones.
- Flow: `/spec <feature>` designs the spec → user sets status to Approved → `/spec-impl NN-slug` implements it on a git branch named after the spec.
- `/spec-impl` refuses to run on any spec state other than Approved (`Aprobado`); it stops on Draft, En revisión, etc.
- Skills are vendored in `.agents/skills/` and pinned in `skills-lock.json` (source: `klerith/fernando-skills`). Do not edit them by hand.

## Language

Project content (UI strings, code comments, README, specs) is Spanish. Keep new content in Spanish.
