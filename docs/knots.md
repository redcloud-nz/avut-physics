# Knots

Exploring knots drawn in 2D SVG: how they look, how they're tied (with props like a bar and hands), and how
they tighten. Work in progress, not listed on the home page: `/knots` lists the knots (`src/knots/index.ts`), and
each has a page at `/knots/<slug>`: the knot finished and how it's used (`knot-page.tsx`), with a button that
brings up tying it over the page, a figure at a time, laid out like a page of the visual introduction
(`tying-steps.tsx`). Knots without steps, like the round turn and two half hitches, show only the finished knot.

## The knot files

Each knot is a knot file, `src/knots/files/<slug>.json`, made and edited in the knot editor (`/knot-editor`, see
`docs/knot-editor.md`): its description, its details (paragraphs split at blank lines), the knot finished, its steps
and their frame. `index.ts` imports each file and reads it with `readKnotJson`, failing the build where one doesn't
read, and adds what the file doesn't hold: the knot's slug, its name split from its variant for the headline, and
whether the list lays it on its side (`turned`). To change a knot, open its file in the editor, save it back over the
file, and commit it.

The pages draw every picture with the editor's own drawing (`PictureDrawing`, through `KnotDrawing` in
`knot-drawing.tsx`), worked out on the server where the page renders, so only the drawn SVG reaches the browser and
it hydrates without a mismatch. Each step is drawn in the file's frame, so the rope stays put as the steps change, and
labelled from its number ("Step 2 of 5", or "Step 2 (cont.)" for a number shown again). The finished knot has a view of
its own (`knotView`), fitted to it: across the knot with a margin, from its top to 8 diameters below its lowest
crossing or pass across a prop, where its ends run out of the bottom (and as far above it where the rope runs on out of
the top too, `endsBothWays`: a bend, or a knot tied in the middle of a rope). Every knot is drawn at a fixed size per
millimetre (`PAGE_SCALE`, 11 pixels across an 11 mm rope), so the rope looks as thick in every illustration and a
bigger knot takes more room. The list of knots draws them all smaller, but again at one size per millimetre: the most
that still fits the biggest in its box.

The files were first made by a converter from the knots' earlier drawings (pinned ropes and doubled paths, laid out in
an older rope editor at `/knots/edit`), which fitted the editor's curves to each rope as drawn and linked pins where two
stretches run side by side. That code is gone (it's in git history before the commit that removed it); the files are
the source now.

## Next

- **Animating the tying.** Between one step and the next; the likely way is to match steps by distance along the rope
  (which needs every step to be the same length of rope).
- **Props beyond the bar**, like hands holding the rope.
- **Tightening.** A small simulation in 3D (position-based dynamics: keep neighbouring points a fixed distance apart,
  resist bending, keep strands at least a diameter apart, and pull the ends), starting from the rope sampled along its
  centreline. It has to be in 3D: in 2D every crossing is a collision. Many short steps, so the rope can't pass
  through itself. Friction between strands decides how far a knot draws up for a given pull, which is where the
  physics gets interesting (and where we'd need to say what we've assumed).
- The tying and tightening frames could be computed ahead, like the articles' figures, if they turn out too slow to
  run in the page.
