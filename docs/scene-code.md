# Scene code: improvements to pick up

From a review of the flying fox's code (November 2026), for the 3D scenes built from pieces: the flying fox, the
Cracroft abseil tower, the parts viewer and the 3D knot editor. The duplicate helpers it found are moved into
`src/lib` on the `shared-helpers` branch; the rest is here, roughly in the order worth doing.

## Where things are now

The scene engine is shared already, but it lives in the first scenes that needed it:

- `src/abseil-tower/tower.ts`: the `Piece` types, `rod`, `timber`.
- `src/abseil-tower/tower-gl.tsx`: `SceneGL`, `buildScene`, focusing on a target, standing somewhere.
- `src/abseil-tower/tower-view.tsx`: `PieceDrawing`, `Callouts`, `nearness`, `StrandSwatch`, beside the 650-line
  `TowerView`.
- `src/flying-fox/hardware.ts`, `knot-3d.ts` and `detail.ts`, which the parts viewer imports too.

`src/flying-fox/fox.ts` (about 4,000 lines) holds the site's ground and sizes, the hawser rig, rigging builders
(slings, figure 8s, big loops, swaged eyes, lashings, pulleys), geometry helpers, the whole model, the brake's poses,
the labels, the targets, the stances, the legend and the ground's shading. `run.ts`, the physics, imports its sizes
from it, so the physics depends on the whole drawing.

## Structure

- **A shared scene module** (`src/scene/`, say) for what every scene uses:
  - pieces and their transforms (`rod`, `timber`, `moved`, `posed`, `centreOf`, `nearness`, `pointsOf`);
  - the 3D renderer (from `tower-gl.tsx`) and the flat SVG renderer (`PieceDrawing`, `Callouts`, callout layout);
  - targets and stances (`Target`, `framing`, `panned`);
  - detail and its Auto setting, as a `useDetail(storageKey)` hook;
  - the viewer's controls: legend, view menu, look-at menu, zoom buttons, previous and next.
- **Hardware and soft goods together**, out of `flying-fox/`: `hardware.ts`, and from `fox.ts` the slings, figure 8s,
  big loops, `swagedEye`, `rigPulley`, `squareLashing`, `chokedSling`.
- **Split `fox.ts`**: `site.ts` (ground and sizes, which both physics and drawing read), a file for each part of the
  rig (tower, tree anchor, shear leg, log anchor, hawsers and Tirfor, trolleys, brake), `labels.ts`, `targets.ts`.
- **A `useFlatView` hook** for the flat views' camera and gestures, used by both the fox and the tower:
  `drawingSize`, `startOf`, `reframe`, `inFit`, `targetFit`, `leastZoom`, wheel zoom, pan, pinch, the two-finger swipe,
  telling a click from a drag. Both views have their own copy now.
- **`fox-view.tsx` down to the flying fox's own parts**: its scene settings, its fits and the run. The rest is
  generic (address state, gestures, detail, target boxes, about 270 lines of controls).
- Three types are called `Frame` (hardware's frame, and the fox and tower views' zoom and centre). Rename the views'.
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

- **Chain as instances.** Every link's the same shape: build it once and draw it as a three.js `InstancedMesh`. Helps
  at every detail level.
- **Low draws simpler shapes**: chain links with fewer points and 4 sides, figure 8s as the old ring (or resampled to
  fewer points), no stitching, plates without their edge faces. One `simple` option through the builders
  (`foxPieces({ run, simple })`), only on Low, so the other levels don't rebuild any more than now.
- **Changing detail rebuilds the whole 3D scene**, as `buildScene` is memoised on `sides`: about a million triangles,
  a stall Auto can mistake for a slow frame rate. Rebuild only what's changed, or let Auto change only the pixel ratio.
- **The flat views draw everything, on screen or not.** Zoomed 60 times, the view covers a few metres but still sorts
  and draws all 14,745 pieces. Leave out what's outside the view first: it saves far more than the detail setting.
- **Detail barely changes the flat views.** Only the 4,701 pieces with `fine` are affected, and across the whole site
  all three levels leave out the same ones; they differ only zoomed well in (at 60×, Low leaves out 2,939, Medium 610,
  High 224). The 3D view ignores `fine` altogether.
- `fox-view.tsx` builds the callouts' `ObstacleGrid` on every render (every pointer move, locked onto a target), and
  `foxLegend()` too. Memoise both.

## Smaller fixes

- In the flat views the zoom buttons' `reframe` leaves out `focus?.pan`, so they keep a locked view within different
  limits from the wheel and pinch.
- `new OrbitCamera(rad(flat.azimuth), rad(flat.elevation))` is built three times in `FoxView`.
- The frame-rate limits (45 and 58 a second) and Auto's four changes of direction are in both `detail.ts` and
  `tower-gl.tsx`'s `PerformanceMonitor`.
- `detail.ts` is generic but lives in `flying-fox/`, with the key `flying-fox:detail`; the parts viewer imports it.
- Two ways of drawing a carabiner: the simple one in `abseil-tower/rig.ts` and `hardware.ts`'s.
- Two hanging lines: `hanging` (a parabola, in `fox.ts`) and `hangingPath` (a catenary, in `hardware.ts`). Worth one
  name saying which is which.
