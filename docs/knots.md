# Knots

Exploring knots drawn in 2D SVG: how they look, how they're tied (with props like a bar and hands), and how
they tighten. Work in progress, not listed on the home page: `/knots` lists the knots (`src/knots/index.ts`), and
each has a page at `/knots/<slug>`: the knot finished and how it's used (`knot-page.tsx`), with a button that
brings up tying it over the page, a figure at a time, laid out like a page of the visual introduction
(`tying-steps.tsx`). Knots without steps, like the figure-8 on a bight, show only the finished knot. Finished knots
are drawn on their pages at a fixed size per rope diameter (`PAGE_SCALE` in `tying-drawing.tsx`), so the rope looks
as thick in every illustration and a bigger knot takes more room. The list of knots draws them all smaller, but again at
one size per rope diameter: the most that still fits the biggest in its box.

Knots with two strands through them (`doubled.ts`) are drawn from the same knot tied in a single strand: its
centreline scaled (by 1 for the figure-8, the same size as the single one) and two strands laid side by side along it.
Where the strands cross, the one standing for the single strand's over pass is marked over. On the bight, the two
strands part a little before the single strand's end leaves the knot and join round a loop as wide as the knot. Joined,
they're two ropes, the second following the first back through the knot, so each rope's end comes out beside the
other's standing part. `figure-eight-doubled.ts` builds the figure-8 on a bight and the joining-8 this way from the
finished figure-8 of the tying steps. The figure-8 rethreaded comes out the same as the figure-8 on a bight, so it's
drawn the same way, with its loop reaching a little further and a short tail, so its taped running end shows below the knot, and tied round a bar (`bar.tsx`) seen end on, the loop wrapped
round it. The figure-8 on a bight's tying steps are the figure-8's, the rope doubled all the way (`folded`), with the
strands parting near the single strand's end and coming round in a little loop, the fold, whose tip is where the end was.
Its step 4 has no room to show the fold passing over the 8 and up through the top loop, so the fold sits below the 8 and an
arrow shows the way (`frontTo`: in front of the rope as far as one of its points, behind it after). Its last step is the
knot finished. The figure-8 rethreaded's steps are cut from its finished drawing: the rope as far along it as the end has
reached, so the end follows the rope back exactly where it lies finished, with a free end (a curve from the cut, marked over
where it's pulled across the knot) where the slack is pulled out to the side. Each move of the rethread is the end lined up
at a place it goes under a strand, with an arrow along its way through, then (cont.) pushed through and pulled out. The joining-8's steps are the same moves, made with the second rope's end
while the first rope (a step's `first`) stays put: its second rope lies through the knot where the rethread does, a set
distance shorter. A knot joining two ropes draws the second in green, and its view stops as far past
the knot at the top as at the bottom, where the ropes run on out both ways.

The round turn and two half hitches (`round-turn.ts`) is tied round a bar seen side on (a `Bar` with a `length`),
running across the drawing. The rope goes in front of the bar and behind it, so the bar is drawn over the whole rope and
under the stretches marked over. It's a pinned rope like the tying steps, in `round-turn.json`, and its `front` list says
which passes across the bar go in front of it (marked over, a little past the bar's edges); the rest go behind, where
the bar hides them. Its turns go up the bar's front and down its back. Seen side on, they're a wave that doubles back
sharply over the bar's top and bottom, as a helix does, so the pins there don't hold a direction (the rope turns at them),
and only the half hitches below the bar are held to the smooth-bend test. Each half hitch goes down beside the standing
part, round it in an oval, in front of it along the bottom and behind it along the top, then out over its own way down
and on down outside it.

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

- **Tying.** Shown as people tie it, by twisting a loop: still frames (a bight, the end round behind into a
  loop, the loop given half a turn into an 8, the end round in front over the top loop, the end pulled
  through), stepped through one at a time. Each step is a pinned rope (`pinned-rope.ts`): pins along it, the
  rope between them and any direction a pin holds, with the rope between the pins solved as the smoothest
  curve of that length. They're kept in `figure-eight-tying.json` and laid out in the rope editor at
  `/knots/edit` (development only), which saves every change straight into that file and picks up changes
  made to it elsewhere. It works on any knot listed in `editable.ts`, each in its own file (`?knot=round-turn` for
  the round turn), and where one's tied round a bar seen side on, clicking a pass across the bar puts it in front or
  behind. It's hard to use, and `docs/rope-editor.md` lists its problems. Its replacement is being built at
  `/knot-editor` (development only, Chrome or Edge; `docs/knot-editor.md`), which draws strands as Bézier curves
  through pins and opens and saves knot files on your computer. The old editor is kept until the knots are ported to
  the new one's files. A step can carry arrows (smooth curves through a few points, with a head at the last)
  showing where the rope goes next, and a step in between, the same rope as the one before with arrows on it,
  shows a move on its own; marked as continuing it, the step after keeps the same number ("Step 2 (cont.)"). Animating between them is left for later; the likely way is to
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
