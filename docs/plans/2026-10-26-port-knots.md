# Porting the knots to knot files

**Date:** 2026-10-26
**Branch:** `feat/knots` (worktree `.claude/worktrees/knots`)
**Written against:** feat/knots @ 896c4b4
**Spec:** `docs/knot-editor.md` (the file format and the drawing), `docs/knots.md` (the knots as they're drawn now)
**Scope:** both review groups are to be built now: the knots converted to knot files, then the knot pages drawing
from them. Removing the old pinned rope, the rope editor at `/knots/edit` and the code that builds the doubled knots
comes after, once the user is happy with the ported knots.

## Decisions

### What's ported

Every knot in `src/knots/index.ts`, each to one knot file, with every picture the page shows:

| Knot                            | Knot (finished)           | Steps | Built now from                                        |
| ------------------------------- | ------------------------- | ----- | ----------------------------------------------------- |
| Figure-8                        | its last step             | 7     | pinned ropes, `figure-eight-tying.json`               |
| Figure-8 on a bight             | `FIGURE_EIGHT_ON_A_BIGHT` | 7     | the figure-8 doubled in code (`doubled.ts`)           |
| Figure-8 rethreaded             | `FIGURE_EIGHT_RETHREADED` | 11    | cut from its finished drawing in code, round a bar    |
| Joining-8                       | `FIGURE_EIGHT_JOINED`     | 10    | the rethread's moves made with a second rope, in code |
| Round turn and two half hitches | `ROUND_TURN`              | none  | a pinned rope, `round-turn.json`, round a bar         |

- **The round turn is ported from `round-turn.json` as it is on disk**, which includes the user's uncommitted change
  (pins 8 and 13 removed). The file itself isn't touched.
- **What comes across:** the ropes, their over and under at every crossing, the arrows (with their `front` and
  `frontTo`), the bar (as a bar prop, end on or side on, with the round turn's `front` passes), the captions (as
  instructions), the step numbers ("Step 2 (cont.)" is number 2, like the step before), the knot's name, description
  and about text, and a frame.
- **What stays in `index.ts`:** the slug, the variant shown under the name, and `turned`. They're how the site lists
  and lays out a knot, not part of drawing it.
- **The frame** is the view the steps share now (`tyingView`, and the joined knot's own), in millimetres. A knot
  without steps gets the view its page fits now. Whether the finished knot's page reads the frame or keeps fitting its
  own view is settled in Task 5 against the screenshots.

### Units

The knots are in rope diameters, and every rope is 11 mm, as the editor's version 1 upgrade assumes: every
coordinate, length and bar size is multiplied by 11. Ropes keep their colours: the first orange, the second green.

### Fitting the editor's curves to the drawings (the user's call: fit closely)

The old pinned rope is a different curve (the shape bending least for a set length between pins), and half the knots
have no pins at all, so the converter works from the drawn ropes themselves, the same way for every knot:

- **The target** is each rope's centreline as drawn now, sampled finely (`centreline` in `rope-path.ts`).
- **Starting pins:** the rope's two ends, and for a pinned rope, its old pins too (they lie on the drawing).
- **Each pin holds the drawing's direction there**, and each segment's two tensions are fitted (Nelder–Mead from
  `numeric.ts`, kept within the editor's tension limits) to bring it as close as it goes to the drawing between its
  pins.
- **Where a segment still strays** more than the tolerance from the drawing (0.1 diameters, 1.1 mm, at its worst
  point), a pin is added halfway along it (by length), and both halves are fitted again.
- **Then pins let go of their angles where they can:** each pin, in turn, is tried with no angle (its direction then
  comes from Hobby's method, as in the editor), and is left free if every segment still meets the tolerance. Free
  pins make the knot easier to reshape in the editor. Linked pins' leaders always keep their angles (the file needs
  them).
- **No lengths are locked.** The knots were drawn to look right, not to a length, and the editor holds a length only
  where it's asked to.
- The converter reports each picture's pin count and its worst miss, so a knot that needs many pins shows up.

### Doubled strands (the user's call: linked pins)

Wherever two stretches of rope run side by side now (the two legs of the bight, the rethread's end following the
rope back, the joining-8's second rope following the first), one leads and the other is linked to it pin by pin:

- **Finding the pairs** from the drawings, not from `doubled.ts`'s working: a stretch is paired where another
  stretch (of another rope, or of the same rope further along) runs beside it about the old spacing apart (1.1
  diameters, within 0.05: the doubled knots were built exactly that far apart, and 0.2 paired the round turn's
  wraps by mistake) and parallel or the reverse, square across from it (within about 9°). (Settled in the build.) Where the two part (round the bight's loop and its tails, where
  the rethread's end hasn't reached yet, the joined ropes' ends running out), each has free pins of its own.
- **The leader** is the stretch met first: the bight's first leg, the rope rethreaded before its end comes back, the
  first rope of the joining-8. The follower is linked on the side it lies, reversed where it runs the other way.
- **The pair keeps its centreline and widens to the editor's spacing**, 1.25 diameters (outlines just touching, the
  spacing the user chose for linked pins), from the old 1.1: the leader's pins are fitted to the pair's centreline set
  out by 0.625 diameters, holding its direction, and the follower's land 1.25 from them. The doubled knots come out
  about a seventh of a diameter wider. Both are set out square to the leader's direction, as the editor places a
  linked pin. Past each end of a pair, the free rope eases back from there to its drawing over 2 diameters, so its
  target has no step for a pin's direction to be taken across. (Settled in the build.)
- **The follower is held to the tolerance too:** a pin is added to the leader (with its follower's) where the
  follower strays, as on a tight bend, where a curve set out sideways isn't another Bézier.
- **Links within one rope** (the bight's legs, the rethreaded end) are allowed: links name pins by id across the
  picture, so a pin can follow one of its own rope's pins. Task 1 checks the editor draws and edits these.

### Over and under

- **Rope crossings:** the converter finds the ported picture's crossings (`pictureCrossings`) and sets each from the
  drawing now: whichever of the two ropes is on a segment marked `over` at the nearest point (along the rope, from
  the fit, so a rope crossing itself finds the right stretch) is on top. A crossing where both or neither are marked
  is left unset and reported: the editor shows it as a warning, to set by hand.
- **Arrows:** an arrow is behind the ropes at every crossing, in front where it's `front`, and with `frontTo`, in
  front as far as that point and behind after.
- **The round turn's bar passes:** each pass across the bar is in front where it's within a `front` entry (along the
  rope), and behind otherwise.

### A pass's cover (settled in the build)

The round turn showed the editor couldn't draw a rope wrapped round a side-on bar: a pass's cover was the whole
stretch within the bar's band, and a wrap turning back at the bar's edge never leaves it, so a pass in front ran into
the pass behind after it and couldn't be drawn over. A pass's cover now also ends where the strand turns back across
the prop (each kind with passes says which way is across: up and down, for the bar), since the next pass begins
there.

### The pages (review group 2)

- **The knots read their files.** `index.ts` imports each knot's JSON and reads it with `parseKnotFile` (failing the
  build on an error), and each picture is drawn with the editor's own drawing (`PictureDrawing`) in an SVG in
  millimetres, at `PAGE_SCALE` pixels per 11 mm, so the rope is as thick on the page as now.
- **Worked out on the server, as now:** a picture's geometry, crossings and path data are worked out where the page
  renders and handed to the drawing rounded (as `RopeDrawing` rounds), so the page hydrates without a mismatch.
- **The finished knot has its own fitted view** (`knotView`, as `ropeView` fitted it: ends running 8 diameters past
  its lowest crossing), not the file's frame, which is the steps' and takes in their long tails; the steps use the
  frame. Drawings reach the browser drawn (server components handed to the client page), so none of the editor's
  working ships to it. (Settled in the build.)
- **The tying overlay and the list of knots** draw from the files too, with their layouts unchanged (`turned`, the
  list's one size per rope diameter, the step labels from the numbers).
- **The old code stays** (pinned rope, rope editor, `/knots/edit`, `doubled.ts`, the old JSON), unused by the pages,
  until the user asks for it to go.

### Where things go

- The knot files: `src/knots/files/<slug>.json`, written by the converter and then edited in the knot editor like
  any other file.
- The converter: `src/knots/port/`, its fitting and pairing as pure functions with tests, and a run that writes the
  files, gated like `npm run figures`: `npm run port-knots` (`PORT_KNOTS=1 vitest run src/knots/port/port.test.ts`).
  It's run once to make the files; after that, the files are the source and the converter goes with the old code.

## Tasks

### Review group 1: the knot files (visual checkpoint: every knot open in the editor, beside its page now)

- [x] **1. Fitting** — Fit editor strands to a drawn rope, closely, with as few pins as it takes
  - `fitStrand(target, startPins, tolerance)`: the pins (with angles where they need them) and tensions, and the
    worst miss.
  - Tests: a straight rope takes two pins; a half circle meets the tolerance; a pinned figure-8 step keeps its old
    pins; letting go of angles never takes a segment past the tolerance.
- [x] **2. Pairs and links** — Find stretches running side by side and link one to the other
  - `pairedStretches(ropes)`: the pairs (ropes, ranges along them, side, reversed or not).
  - The leader fitted to the pair's centreline set out, the follower linked pin for pin, free pins where they part.
  - Tests: two parallel lines pair, crossing ones don't; a bight's legs pair reversed within one rope; a follower
    within one rope places, draws and drags in the editor as one in another rope does.
- [x] **3. Converting a knot** — Turn a knot's pictures into a knot file
  - Ropes, arrows and bar to strands and a prop; over and under, arrows' and passes' sides; captions, numbers,
    details and the frame.
  - The run: `npm run port-knots` writes `src/knots/files/*.json` and prints, for each picture, its pins, its worst
    miss and any crossing left unset.
  - Tests: every file parses; every rope crossing is set or reported; the figure-8's steps keep their numbers and
    captions.
- [x] **4. Check** — Every picture against its drawing now
  - Screenshots of each knot file open in the editor beside its page now, for the user, with the run's report.

### Review group 2: the pages read the files (visual checkpoint: every knot page before and after)

- [x] **5. Pages from files** — Draw the knot pages, the tying overlay and the list from the knot files
  - `index.ts` reads the files; the page, overlay and list draw each picture with `PictureDrawing`, worked out on
    the server.
  - Screenshots of every page, overlay step and the list, before and after, compared.
- [x] **6. Docs** — `docs/knots.md` says the knots are knot files, edited in the knot editor, and what the old code
      still there is for; `docs/knot-editor.md`'s "Later" loses porting and the pages reading the files.

## Docs impact

`docs/knots.md` (Task 6), `docs/knot-editor.md` (Task 6). No page text changes.

## Out of scope

- Removing the old pinned rope, rope editor, `/knots/edit`, `doubled.ts`, `figure-eight-doubled.ts` and the old JSON.
- Reshaping any knot by hand: the user does that in the editor after the port.
- The bend limit as a setting, arrows of their own widths, props beyond the bar, exporting SVG.
