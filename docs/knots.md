# Knots

Exploring knots drawn in 2D SVG: how they look, how they're tied (with props like a bar and hands), and how
they tighten. Work in progress, not listed on the home page: Rescue Knots, at `/rescue-knots`, lists the knots
(`src/knots/index.ts`), laid out like the visual introduction's first page, with a share picture of its own (`share-image.tsx`), and each has
a page at
`/rescue-knots/<slug>`: the knot finished and how it's used (`knot-page.tsx`), with a button that
brings up tying it over the page, a figure at a time, laid out like a page of the visual introduction
(`tying-steps.tsx`). Knots without steps, like the round turn and two half hitches, show only the finished knot.

## The knot files

Each knot is a knot file, `src/knots/files/<slug>.json`, made and edited in the knot editor (`/knot-editor`, see
`docs/knot-editor.md`): its description, its details (paragraphs split at blank lines), the knot finished, its steps
and their frame. `index.ts` imports each file and reads it with `readKnotJson`, failing the build where one doesn't
read, and adds what the file doesn't hold: the knot's slug, its name split from its variant for the headline, and
whether the list lays it on its side (`turned`). Knots still to come are listed too, greyed out as
coming soon, with no page: those with no file yet (`soon` in `index.ts`), and those with a file marked `comingSoon`
while their drawing's worked on (the alpine butterfly), which are still in the knot editor's library. To change a knot, open its file in the editor, save it back over the
file, and commit it.

The pages draw every picture with the editor's own drawing (`PictureDrawing`, through `KnotDrawing` in
`knot-drawing.tsx`), worked out on the server where the page renders, so only the drawn SVG reaches the browser and
it hydrates without a mismatch. Each step is drawn in the file's frame, so the rope stays put as the steps change, and
labelled from its number ("Step 2 of 5", or "Step 2 (cont.)" for a number shown again). The finished knot on its page
is drawn in the same frame. For now every file's frame is the same size, 280 × 400 mm, placed round its own knot, so
every knot's pictures take the same room; a rope's ends should run on past the frame's edge rather than stop inside
it. Every knot is drawn at a fixed size per millimetre (`PAGE_SCALE`, 11 pixels across an 11 mm rope), so the rope
looks as thick in every illustration. Where a rope runs off an edge, the drawing fades out over the last 3 diameters
towards it, a hint that the rope goes on.

The list of knots and the terminology page draw the finished knots smaller, each in a view of its own (`knotView`),
fitted to it: across the knot with a margin, from its top to 8 diameters below its lowest crossing or pass across a
prop, where its ends run out of the bottom (and as far above it where the rope runs on out of the top too: a bend, or
a knot tied in the middle of a rope). A knot drawn lying across (`sideways`, as the alpine butterfly is) has its ends
running out of both sides instead: its view goes round the rope from top to bottom, and 8 diameters either side of
its crossings (`knotEnds` says which). They're again at one size per millimetre: the most that still fits the biggest
in its box.

Ropes are shaded as tubes, dark at their edges and light along their middle, in bands of stroke (an SVG gradient
can't follow a stroke round a bend), with a highlight a little up and to the left; bars are shaded with gradients.

The files were first made by a converter from the knots' earlier drawings (pinned ropes and doubled paths, laid out in
an older rope editor at `/knots/edit`), which fitted the editor's curves to each rope as drawn and linked pins where two
stretches run side by side. That code is gone (it's in git history before the commit that removed it); the files are
the source now.

The share picture draws two knots as their pages do. Next won't let a route import `react-dom/server`, so
`share-image.test.ts` draws them to SVG and keeps that in `share-knots.json`, a file snapshot: when a knot or the drawing
changes, the test fails until it's drawn again with `npx vitest run src/knots/share-image.test.ts -u`. The picture swaps
the colour tokens in that SVG for their values in `globals.css`, since next/og draws without the stylesheet.

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
