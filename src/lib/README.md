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

| File          | What's in it                                                                                                                                                                         |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `bezier.ts`   | `Cubic`, a cubic Bézier in 2D: points and derivatives along it, splitting, length, curvature, boxes, and where two cross.                                                            |
| `hobby.ts`    | Hobby's smooth curves through points (as in METAFONT): the directions and control points for a row of points.                                                                        |
| `curve3.ts`   | Curves in 3D as runs of points: a cubic Bézier (`cubicPoints`) and a Catmull–Rom path through points (`catmullRom`).                                                                 |
| `svg-path.ts` | SVG path data: numbers, points and polylines written for it (`svgNumber`, `svgPoint`, `svgPoints`, `polylinePath`), and paths (M, L, H, V, C, A) read back as points (`pathPoints`). |

## Ropes in 3D

| File                    | What's in it                                                                                                                                                                                         |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `rope-3d/rope.ts`       | A rope as points in numbered segments (`Rope3`): arc lengths, the point a distance along (`pointAt`), spacing, segments, and respacing. Its `arcLengths` and `pointAt` work on any run of 3D points. |
| `rope-3d/sim.ts`        | Settling a rope by position-based dynamics: no stretch, a least bend, stiffness, not passing through itself or the bars.                                                                             |
| `rope-3d/curve.ts`      | A smooth curve through locked ends (cubic Hermite pieces), for moving a handle along.                                                                                                                |
| `rope-3d/operations.ts` | The 3D knot editor's edits as steppers: moving a handle, tightening, smoothing.                                                                                                                      |

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
