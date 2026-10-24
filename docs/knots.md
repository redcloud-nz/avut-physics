# Knots

Exploring knots drawn in 2D SVG: how they look, how they're tied (with props like a bar and hands), and how
they tighten. Work in progress at `/knots`, not listed on the home page.

## Stages

1. **A loose figure-8** (done). Written as SVG path segments, each plain or over.
2. **Tying it.** The figure-8 being tied, step by step, with hands and a bar (animated later).
3. **Tightening it.** Pulling the ends and watching the knot draw up.

## How a knot is written

For drawing and animating, a rope is SVG path data (`src/knots/rope-path.ts`), in rope diameters with y down
as in SVG, so a stroke 1 wide is the rope's thickness. It's a list of segments, each a few path commands
(M, L, H, V, C and A) carrying on from where the last ended, and each either `plain` or `over`. Mark the stretch
of rope going over at every place it crosses itself, reaching at least a diameter either side; leave the rest
plain. Over and under are written down, never worked out from the shape.

The figure-8 (`figure-eight.ts`) is about a dozen segments: half circles (arcs) for the top of the upper loop
and the bottom of the lower loop, and cubic Béziers for the S-curves through the middle, their control points
straight above or below their ends so they meet the half circles smoothly. It's laid out upright as it's
usually shown, both ends running up the middle, and looks the same turned upside down.

`src/lib/svg-path.ts` turns path data into points, so the tests can measure the rope without a browser. They
read the crossings off the drawn path and check each has exactly one strand marked over, then work out the
knot's determinant (`src/knots/invariants.ts`): 5 for a figure-8, 3 for an overhand, 1 for no knot. A slip that
ties a different knot fails the test. They also check that over segments reach a diameter past their crossings,
that the rope never bends tighter than 1.75 diameters (no corners), and that strands only meet where they cross.

## Drawing

`RopeDrawing` draws the whole path once as a tube (outline, body, the sheath's weave, a highlight), then each
`over` segment again on top. The redrawn segments have square ends, pick up the weave by their distance along
the rope, and stop their outlines just short of their ends, so they join the rope underneath without a seam.
Drawing over segments last is only right while no two of them overlap each other, which holds for a loose
knot but not a tight one.

## Next

- **Tying.** Shown as people tie it, by twisting a loop: `figure-eight-tying.ts` has the steps as still
  frames (a bight, the end round behind into a loop, the loop given half a turn into an 8, the end poked into
  the top loop, the end pulled through), stepped through one at a time. Animating between them is left for later; the likely way is to
  match steps by distance along the rope (which needs every step to be the same length of rope). `firstPart` (the rope cut at a length along it) is kept for
  retracing a follow-through and for cutting blended frames to the rope's length. Hands and a bar as SVG props
  come after that.
- **Tightening.** Starts from the path sampled into points along its centreline. A small simulation in 3D (position-based dynamics: keep neighbouring points a fixed distance
  apart, resist bending, keep strands at least a diameter apart, and pull the ends). It has to be in 3D:
  in 2D every crossing is a collision. Many short steps, so the rope can't pass through itself. Friction
  between strands decides how far a knot draws up for a given pull, which is where the physics gets
  interesting (and where we'd need to say what we've assumed).
- The tying and tightening frames could be computed ahead, like the articles' figures, if they turn out too
  slow to run in the page.
