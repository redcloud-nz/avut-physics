# Rope editor: what's wrong with it

The rope editor at `/knots/edit` (`src/knots/rope-editor.tsx`) lays out pinned ropes (`src/knots/pinned-rope.ts`) for
the knots' drawings and tying steps. It got the figure-8's steps and the round turn drawn, but it's hard enough to use
that it likely wants rebuilding from scratch. These are the problems found using it, with what causes them, to keep in
mind for the next one.

## 1. It holds the rope's length, and kinks it

Moving a pin nearly always puts a kink in the rope. Every stretch between two pins has a fixed length (`lengths`), and
the solver must meet it exactly. It finds the smoothest curve of that length, not the smoothest curve. Move a pin
nearer its neighbour and the spare rope has to go somewhere, so it bulges or kinks. Move it further away than the rope
between them and the solver can't meet the pin, so the editor refuses the move (see 2).

- A smooth curve matters more than the length. The length should follow from where the pins are, unless it's locked.
- Locking a length is still worth having sometimes: in a tying step, where the rope has to be the same length as in
  the step before, or for the slack in a loop.
- Crossings are marked by how far along the rope they are (`over`, `front`). So changing any length upstream moves the
  marks off their crossings, and they have to be put right by hand. They'd be better tied to the crossing itself:
  which two stretches cross, which is on top.
- Flipping a crossing removes every `over` entry within 2 of it along the rope (`OVER_MATCH`). Where two crossings are
  that close, it clears the other one's mark too, and nothing shows it's gone. That happened on the round turn's first
  hitch.

## 2. It's slow, and doesn't show when a change has happened

A change could seem to do nothing, or take seconds to show.

- **Slow solves.** Each solve builds one dense matrix over every link of the rope plus every pin condition: about
  280 × 280 for the round turn. It solves it directly (cubic in that size) up to 100 times, with a line search that
  works out every condition again at each try. The rope is split into 0.5-diameter links all along, however straight
  it is. The matrix is banded (bending only couples neighbouring links), so a banded or sparse solve would be far
  faster. A coarser rope where it's straight would help too.
- **On the main thread.** It solves synchronously on every pointer move while dragging, and the page can't redraw
  until each solve finishes. Nothing drops stale moves or coalesces them into one per frame.
- **Too much redone.** Each change also builds the rope's path, its crossings and its passes across the bar again, and
  re-renders the whole editor. The pointer's position is in state, so every mouse move re-renders even with nothing
  dragged. Every step is solved when the page opens, not only the one shown.
- **Saving reloads the page.** Each change writes the knot's JSON file, which the page itself imports. The dev server
  reloads the module, and the editor reads the file back. That's slow, and can land while you're still working.
- **Silent refusals.** When the solver can't meet the pins, the change is dropped and the rope stays as it was. All
  that says so is a line of small status text, so it looks like nothing happened.

The next editor should:

- solve off the main thread, or at least once per frame with the latest pointer position;
- only recompute what a change affects;
- show plainly when it's working, when a change is done, and when it can't be met (with why, and where).

## 3. The panel on the right

The controls panel has grown a piece at a time: knot links, step navigation, add and remove step, save and revert,
the caption, "continues the step before", a paragraph of help, add arrow, show numbers, undo. It's hard to find things
in and doesn't fit how it's used.

- **Saved and drafts.** "Save step" approves a step for the knot pages, while every change is also written to the file
  straight away as a draft. That's two kinds of saved, and it isn't clear which one the page is showing.
- **No pin details.** There's no way to see or type a selected pin's position, angle or the lengths either side.
  Those are only labels on the drawing, and changed only by dragging.
- **Help in a paragraph.** What a click or drag does is explained in a block of text, not shown where you'd do it.

What the panel should hold, and how it's laid out, is still to be worked out.
