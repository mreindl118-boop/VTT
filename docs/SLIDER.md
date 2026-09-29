# DM/Player view slider

One control, one number: `t ∈ [0, 1]`, per DM screen.

- `t = 0` — **safe to point at players.** Only what the party has earned is drawn.
- `t = 1` — **the DM sees everything.**
- The **Player Display** window is hard-pinned at `t = 0`. It never reads the DM's `t`.

Implementation: `app/src/core/slider.ts` (pure math, unit-tested) and `app/src/ui/viewSlider.ts` (control).

## Control

- Vertical track on the right screen edge (left in left-handed mode), thumb-reachable one-handed on iPad.
- Continuous drag. **Detents** at 0 and 1: values within 0.04 of an end snap to it, with a visual tick and
  `navigator.vibrate(8)` where supported.
- **Peek**: press and hold the eye button → `t` animates to 1; release → springs back to the value held before.
- Present on every map, every level, and the regional map. Keyboard: `[` / `]` step 0.1, `\` holds peek.

## Visibility classes

Every scene object declares exactly one `vis` class (`VisClass` in `app/src/core/schema.ts`).

| Class | At `t = 0` | As `t` rises |
|---|---|---|
| `player` | Drawn when a player token can see it (line of sight + enough light, docs §5) | unchanged |
| `explored` | Drawn desaturated + dimmed ("memory") | returns to full colour with `hidden(t)` |
| `unexplored` | Solid fog | fog thins with `fog(t)`, gone at 1 |
| `secret-door` | Drawn as the plain adjacent wall — pixel-identical | door + DM marker crossfade in with `hidden(t)` |
| `trap` | Invisible | trigger zone ghosts in with `hidden(t)` |
| `hidden-creature` | Invisible | ghosts in with `hidden(t)` |
| `hidden-object` | Invisible | ghosts in with `hidden(t)` |
| `dm-note` | Invisible | fades in last with `label(t)` |

Fog, `explored`, `unexplored` and `player` are not per-object flags in practice: they are the per-level
**coverage bitmap** (1-ft cells; see `docs/UNITS.md`) sampled in every material's fragment shader by world
XZ. An object's authored `vis` can still force `unexplored` (e.g. a room the DM wants dark until entered).

## Curves

```
hidden(t) = smoothstep(0.15, 0.85, t)     // traps, secret doors, hidden creatures/objects
fog(t)    = 1 − smoothstep(0.10, 0.90, t) // fog density over unexplored space
label(t)  = smoothstep(0.60, 1.00, t)     // dm-note: keys, page refs, notes, light radii
```

Mid-values are deliberate: at `t = 0.5` hidden things read as translucent ghosts over thinned fog, never as
z-fighting or half-loaded geometry. Hidden objects render with depth-write off and a cool violet tint while
`0 < hidden(t) < 1` so they read as "DM ghost", not as a bug.

## Reveals (DM tools)

Reveals override the slider **for players**: a revealed object is treated as `player` at every `t`,
including on the Player Display. All are persisted per campaign in IndexedDB and are undoable.

| Tool | Effect |
|---|---|
| Reveal / hide area key | the room's floor polygon is stamped into the coverage bitmap as seen / cleared |
| Reveal secret door | the door becomes a normal `door` for players (wall flag switches) |
| Reveal creature / object | that object becomes `player` |
| Paint / erase fog | brush on the coverage bitmap |
| Mark explored | stamp room as `explored` |
| Undo | pops the campaign reveal log |

Everything the slider can show can also be revealed with these tools, so a DM can run an entire session
on one shared screen at `t = 0`.

## Player Display

`?display=player` opens a window that subscribes to the campaign over `BroadcastChannel('mistlab')`.
It receives reveals, token moves and (optionally) the DM camera. It never receives `t`. There is no DM UI in
it at all: no slider, no labels, no toolbar.
