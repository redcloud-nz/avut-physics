# Knots

Exploring knots drawn in 2D SVG: how they look, how they're tied (with props like a bar and hands), and how
they tighten. Work in progress at `/knots`, not listed on the home page.

## Stages

1. **A loose figure-8** (done). Drawn from its centreline.
2. **Tying it.** An animation of the figure-8 being tied, with hands and a bar.
3. **Tightening it.** Pulling the ends and watching the knot draw up.

## How a rope is held

A rope (`src/knots/rope.ts`) is its centreline: points evenly spaced along its middle, in metres, with x and y
in the page's plane and z out of it. z is only ever a rope diameter or so either way, just enough to say which
strand is on top where the rope crosses itself. All three stages work on this one shape, so whatever moves the
rope (an authored path, a tying animation, a simulation) only has to produce points.

A knot is authored with `layRope`: the crossings, each named and placed, and the points the rope passes
through, in order, with `over("waist")` or `under("waist")` where it passes a crossing. The points are smoothed
with a natural cubic spline (which bends least through them, as a loose rope does) and respaced evenly, and the rope rises over or dips under at each named
crossing. Over and under are written down, never worked out: the geometry is only used to check that the rope
crosses itself at the named crossings and nowhere else, and `layRope` throws if it doesn't, or if a crossing
isn't passed once over and once under.

The figure-8 is laid out upright as it's usually shown: both ends run up the middle (the standing part from
the bottom, the tail out of the top) with the two loops stacked between them, the same shape turned upside
down. Its test reads the crossings back off the drawn rope and works out the knot's
determinant (`src/knots/invariants.ts`): 5 for a figure-8, 3 for an overhand, 1 for no knot. So a slip in
the authoring that ties a different knot fails the test.

## Drawing

`RopeDrawing` draws the whole rope once, then draws again every stretch that overlaps another strand on the
page, lowest first. This doesn't rely on finding crossings, so it should still hold when the knot is tight and
strands lie side by side or on top of each other. The weave's dashes follow distance along the rope, so once the
rope moves, offsetting them by how far the rope has slid will show it running through the knot.

## Next

- **Tying.** Probably keyframes: a handful of centreline shapes from straight rope to loose knot, with the
  rope between them made by moving its control points, not its sampled points, so it stays smooth and keeps
  its length. Hands and a bar are SVG props placed by the same keyframes (a hand holds a point some distance
  along the rope). Over/under has to change as the end passes through, so each keyframe carries its own
  layers, or the z comes from the animation itself.
- **Tightening.** A small simulation in 3D (position-based dynamics: keep neighbouring points a fixed distance
  apart, resist bending, keep strands at least a diameter apart, and pull the ends). It has to be in 3D:
  in 2D every crossing is a collision. Many short steps, so the rope can't pass through itself. Friction
  between strands decides how far a knot draws up for a given pull, which is where the physics gets
  interesting (and where we'd need to say what we've assumed).
- The tying and tightening frames could be computed ahead, like the articles' figures, if they turn out too
  slow to run in the page.
