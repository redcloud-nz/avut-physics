# src/lib

The shared maths: vectors, geometry, curves, numerical methods and number formatting, with no React and nothing
specific to one page. Before writing a helper in a solver, scene or page, look here for one that already does it; if
it's general and missing, add it here (with tests) rather than locally, and add it to this list.

Everything is in SI units and plain functions or immutable classes. Physics coordinates have y up.

## Vectors and points

| File         | What's in it                                                                                                                                                                                                                                          |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `vector2.ts` | `Vector2`, immutable: `add`, `sub`, `scale`, `lerp`, `mid`, `neg`, `dot`, `cross`, `len`, `distanceTo`, `unit`, `safeUnit`, `clampLen`, `perp`, `angle`; `Vector2.fromAngle`, `Vector2.sum`, `vec2`.                                                  |
| `vector3.ts` | `Vector3`, immutable: the same arithmetic, `horizontalLen`, `angleTo`, `mirrorZ`, `xy`, and `turned(axis, angle)` (rotation about an axis). Also `turnBetween` (the turn from one direction to another) and `boundsOf` (the box points span). `vec3`. |

## Geometry in the plane

| File          | What's in it                                                                                                                                                                                                                                    |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `segment.ts`  | `Segment`, a straight piece between two points (a stretcher, a ladder, a piece of a polyline from `Segment.along`): its length, direction and middle, the point a fraction along, nearest points, distances, crossings, gaps and intersections. |
| `polyline.ts` | The `Polyline` type (a `readonly Vector2[]`), its arc lengths and its length.                                                                                                                                                                   |
| `hull.ts`     | `convexHull` of points in the plane (Andrew's monotone chain).                                                                                                                                                                                  |
| `wall.ts`     | The wall the lowers share: its face at x = 0, its anchor, and the rope's path over its edge.                                                                                                                                                    |

## Curves

| File           | What's in it                                                                                                                                                                                                                                                                       |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bezier.ts`    | `Cubic`, a cubic Bézier in 2D: points and derivatives along it, splitting, length, curvature, boxes, and where two cross.                                                                                                                                                          |
| `hobby.ts`     | Hobby's smooth curves through points (as in METAFONT): the directions and control points for a row of points.                                                                                                                                                                      |
| `curve3.ts`    | Curves in 3D as runs of points: a cubic Bézier (`cubicPoints`), a Catmull–Rom path through points (`catmullRom`), and a run of points thinned out where it's nearly straight (`thinned`).                                                                                          |
| `polyline3.ts` | Runs of points in 3D against each other: the nearest points between two segments (`segmentsNearest`) or two runs (`nearestBetween`, `nearestOnRun`), the way a closed loop faces (`loopNormal`), and where a run passes through a flat loop's inside, and which way (`piercings`). |
| `svg-path.ts`  | SVG path data: numbers, points and polylines written for it (`svgNumber`, `svgPoint`, `svgPoints`, `polylinePath`), and paths (M, L, H, V, C, A) read back as points (`pathPoints`).                                                                                               |

## Ropes in 3D

| File                | What's in it                                                                                                                                                                                    |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `rope-3d/rope.ts`   | A rope's setup (diameter, least bend, stiffness, straight bars and closed ones), and points' arc lengths and the point a distance along (`pointAt`), for any run of 3D points.                  |
| `rope-3d/pinned.ts` | A rope as pins and segments, one cubic Bézier each (`PinnedRope`): Hobby's directions worked in 3D, sampling it as points, fitting points back to pins, splitting a segment and removing a pin. |
| `rope-3d/sim.ts`    | Settling a rope by position-based dynamics: no stretch, a least bend, stiffness, not passing through itself, the bars or closed bars (a carabiner's rod).                                       |
| `rope-3d/stage.ts`  | A stage of tightening (`StageRun`): segments painted to shorten, hold or hold straight, stepped and watched, fitted back to pins.                                                               |
| `rope-3d/watch.ts`  | Watching a moving rope for passing through itself (`PassWatch`) or a closed bar (`timesThrough`).                                                                                               |
| `rope-3d/checks.ts` | What's wrong with a rope as it lies (`ropeProblems`): rope into rope or a bar, bends too tight.                                                                                                 |

## Numerical methods

One file per kind of method, imported by file: there's no index, so an article figure's hash covers only the methods
it uses.

| File                      | What's in it                                                                                        |
| ------------------------- | --------------------------------------------------------------------------------------------------- |
| `numeric/linear.ts`       | The `Matrix` alias (row-major `number[][]`), transposes, linear and least-squares solves, `maxAbs`. |
| `numeric/nonnegative.ts`  | Least squares with the answer kept non-negative (Lawson and Hanson).                                |
| `numeric/minimise.ts`     | Nelder–Mead, grid minima, golden-section search.                                                    |
| `numeric/roots.ts`        | Bisection (`bisect`) and a quadratic's roots in (0, 1).                                             |
| `numeric/differences.ts`  | A Jacobian by central differences.                                                                  |
| `numeric/held-balance.ts` | Newton's method on a balance with some constraints held exactly (the lowers' final solve).          |

## Drawing and display

| File              | What's in it                                                                                                                                                         |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `orbit-camera.ts` | `OrbitCamera`, a far-off (orthographic) camera at an azimuth and elevation: projecting points into the view and their depth. The flat views of the 3D scenes use it. |
| `format.ts`       | Numbers for display: `readout` for the visualisations' live readouts, `teaching` for the articles and the visual introduction.                                       |

## Small things

| File           | What's in it                                                              |
| -------------- | ------------------------------------------------------------------------- |
| `math.ts`      | `clamp`, `deg`, `rad`, `wrapDegrees`, `roundTo`, `linearScale`.           |
| `constants.ts` | `G`, standard gravity.                                                    |
| `random.ts`    | `seededPicker`, the repeatable random inputs tests use for random setups. |
| `utils.ts`     | `cn`, for joining class names (shadcn's components import it from here).  |
