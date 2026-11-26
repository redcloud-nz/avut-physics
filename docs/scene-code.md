# Scene code: improvements to pick up

From a review of the flying fox's code (November 2026), for the 3D scenes built from pieces: the flying fox, the
Cracroft abseil tower, the parts viewer and the 3D knot editor. Done so far: the duplicate helpers it found are in
`src/lib`, the shared scene engine is in `src/scene/`, and the rigging gear any scene can use is in `src/rigging/` (see
AGENTS.md). The rest is here, roughly in the order
worth doing.

## Where things are now

The engine every scene shares is in `src/scene/`: the pieces, the 3D view (`SceneGL`), the flat SVG drawing, the
flat views' camera and gestures, the callout layout and detail. The hardware, rope, knots and slings are in
`src/rigging/`.

The flying fox is in parts: `site.ts` (the ground, sizes and fixed positions, which is all the physics in `run.ts`
reads), `colors.ts`, `labels.ts`, `targets.ts`, `ground.ts`, and the model in `rig/`, a file for each part of the rig
(`tower.ts`, `tree.ts`, `shear-leg.ts`, `log-anchor.ts` with the lizards and Tirfor, `hawsers.ts`, `trolleys.ts`,
`brake.ts`) and `shared.ts` for the builders several use. `fox.ts` puts them together.

## Structure

- **`pointsOf`** (in `parts/flat-view.tsx`) could join the other transforms in `src/scene/transforms.ts`.
- **The flying fox's own rigging builders** (in `src/flying-fox/rig/`) could join `src/rigging/` once they take their colours and the
  ground as arguments: `guy` and `picket`, `rigPulley`, `squareLashing`, `chokedSling`, `madeOff`, `swagedEye`.
- **`chain-weight.ts` mixes the physics** (`chainWeightHanging`, which `run.ts` reads) with the drawing of the chain
  heap.
- Keep the assembly editor in mind (`docs/knot-editor-3d.md`, "The assembly editor"): builders that return named
  frames, and placements kept apart from the pieces drawn.

## Speed

Measured on the whole flying fox (`foxPieces()`): 14,745 pieces (11,219 faces, 3,108 strands, 418 rods), about 980,000
triangles at 10 sides a tube (an estimate from point counts, not the renderer's own count).

| What                                                         | Share of triangles |
| ------------------------------------------------------------ | ------------------ |
| Chain weight's links (844, each a strand of about 23 points) | 38%                |
| Chain stays                                                  | 13%                |
| Figure 8s, big loops included                                | 20%                |
| Guy ropes and other rope                                     | about 15%          |
| Carabiners                                                   | 3%                 |
| Every other piece of hardware                                | under 2% each      |

- **Done: chain as instances.** A chain link's strand carries its `shape` (shared by every link of its size), and
  `buildScene` checks from each link's points where it's been put, builds the shape once and draws it as a three.js
  `InstancedMesh`. Closed loops no longer get two round ends hidden inside them. On the whole flying fox: geometry built
  1.26 to 0.54 million triangles, triangles drawn 1.26 to 1.03 million, `buildScene` about 175 to 105 ms. Any other
  shape used many times can carry a `shape` too.
- **Low draws simpler shapes**: chain links with fewer points and 4 sides, figure 8s as the old ring (or resampled to
  fewer points), no stitching, plates without their edge faces. One `simple` option through the builders
  (`foxPieces({ run, simple })`), only on Low, so the other levels don't rebuild any more than now.
- **Done: changing detail no longer rebuilds the whole 3D scene.** The faces are built once for each set of pieces, and
  the rods and strands are kept for the last two levels, so Auto stepping down and back up doesn't build them again; the
  level left lets go of the graphics card's copy. Auto's frame-rate watch starts afresh at each level. Most of the pause
  was the page itself: in 3D the flying fox and the tower still sorted every piece for the flat drawing on each render.
  Now they don't, and a change of level pauses about 130 ms the first time and under 120 ms after (a dev build on a Mac,
  from 450 to 580 ms).
- **Done: the flat views leave out what's off screen.** `useFlatView`'s `onScreen` checks a piece's reach across and up
  the view (worked out once for each camera) against what's in view, with a 20 pixel margin; the flying fox (with its
  overhead ground tiles) and the tower use it. Locked onto the flying fox's top tower from the side and zoomed in four
  steps, 1,886 SVG elements are drawn rather than 26,512, and a zoom step redraws in 110 to 180 ms rather than 360 to
  575 (dev build). The parts viewer's flat views draw one part, so don't.
- **Detail barely changes the flat views.** Only the 4,701 pieces with `fine` are affected, and across the whole site
  all three levels leave out the same ones; they differ only zoomed well in (at 60×, Low leaves out 2,939, Medium 610,
  High 224). The 3D view ignores `fine` altogether.
- `fox-view.tsx` builds the callouts' `ObstacleGrid` on every render (every pointer move, locked onto a target), and
  `foxLegend()` too. Memoise both.

## Smaller fixes

- Two ways of drawing a carabiner: the simple one in `abseil-tower/rig.ts` and `hardware.ts`'s.
- Two hanging lines: `hanging` (a parabola, in `rigging/rope.ts`) and `hangingPath` (a catenary, in `hardware.ts`). Worth one
  name saying which is which.
