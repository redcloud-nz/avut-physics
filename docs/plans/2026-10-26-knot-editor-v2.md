# Knot editor version 2: millimetres, rope sizes, the frame, the grid and linked pins

**Date:** 2026-10-26
**Branch:** `feat/knots` (worktree `.claude/worktrees/knots`)
**Written against:** feat/knots @ 0e9e6ec
**Spec:** `docs/knot-editor.md`, its "Version 2 (proposed)" section
**Scope:** all three review groups are to be built now. A setting for the bend limit, arrows with widths of their own,
and doubled strands come later.

## Decisions

The design is in the spec. What it leaves to the build is settled here.

### Units and sizes

- **Millimetres throughout the editor.** Coordinates, lengths, prop sizes and the frame are millimetres in the file
  and in the editor's state. Nothing converts on the way in or out except the version 1 upgrade (× 11).
- **One rope size per rope, read where a size is needed.** A rope's `diameter` is its size. An arrow has none in the
  file; it counts as `ARROW_SIZE = 11` mm wherever a strand's size is needed (crossing clearances, drawing), so arrows
  stay the size they are now beside an 11 mm rope. One helper, `strandSize(strand)`, gives either.
- **What scales with the size, and how.** Every constant now in diameters keeps its value and is multiplied by the
  size of the strand it belongs to:
  - the bend warning (`TIGHTEST_BEND`, 1), by the rope's diameter;
  - an over stretch's reach past a crossing, by the size of the strand on top;
  - the clearance either side of a crossing, from both strands' half-widths (the strand on top's own half-width
    times the cosine of the angle, plus the other's), where it's one shared `HALF_WIDTH` now;
  - the step `coverAround` walks a pass with (0.1), by the passing strand's size;
  - a bar's pass margin (0.6), by the passing rope's diameter: `covers` takes the size as an argument;
  - the tape's length (1.2) and every width and dash in `Stretch`, by the rope's diameter;
  - the arrow's shaft, head and outline, by `ARROW_SIZE`;
  - the spacing of the samples crossings are found from (0.25), by the strand's size, so a millimetre picture isn't
    sampled eleven times as finely.
- **An over stretch always clears the strand under it.** It reaches the larger of its reach and its clearance, so a
  thin rope over a thick one is drawn over the thick one's whole width. (Settled in the build.)
- **The bar's lines** (`BarDrawing`'s outline and highlight) take a `unit`, 1 by default for the knot pages, and the
  editor draws them as beside an 11 mm rope. (Settled in the build.)
- **`Stretch` takes a `width`, 1 by default.** The existing knots don't pass one, so their markup stays exactly as it
  is: Task 1 checks it byte for byte.
- **Sizes not tied to a strand** are set in millimetres: the fitted view's margin (33 mm, for 3 diameters), a new
  strand's length (110 mm), a new bar (radius 17.6 mm, length 220 mm), and the frame a version 1 file is given (30 mm
  clear, out to whole centimetres).
- **Rounding.** The file rounds to 0.01 mm; a drag rounds to 0.1 mm; tensions stay at 0.01.
- **Zoom.** `BASE_SCALE` becomes 20 / 11 pixels per millimetre (so an 11 mm rope is 20 pixels across at 100%, as one
  diameter is now), and the least and most scales divide by 11 too. The percentages and levels don't change.
- **Tests stay in diameters.** The test helpers build ropes with a diameter of 1, so every existing test's numbers
  keep their meaning. Tests with arrows that depend on a size (crossing reach) use `ARROW_SIZE` explicitly.

### The frame

- `KnotFile.frame: { x, y, w, h }` (millimetres, `w` and `h` above 0), written between the details and the knot.
- A file-level edit, `setFrame`. A drag of an edge or corner is one history entry, so the reducer's `edit-file`
  respects `dragging` as `edit` does.
- Drawn as a dashed rectangle in `--line`, with everything outside it covered in `--background` at 60% (one path,
  even-odd, from far outside the view to the frame).
- Hit areas along its four edges and at its four corners (8 pixels wide), under the strands' and props' hit areas so
  those keep priority where they overlap it.
- File > Knot Details… gains the frame's x, y, width and height.
- View > Fit fits the frame and everything in the picture.
- The view is kept on the knot (`view.ts`): it zooms out only until the frame fills half of it, across or down
  (further only where the picture reaches past the frame, far enough to fit it), and pans only until the frame's edge,
  or the edge of what's drawn past it, is in its middle. (The user's ask after group 2.)

### The grid and snapping

- `GRID = 20` mm in one place (`src/knot-editor/grid.ts`), every fifth line stronger. Drawn only over the visible view,
  under everything, in `--line-faint` and `--line`, with numbers in `--ink-muted` along the view's top and left edges
  at the strong lines. Where the lines would be under 8 pixels apart, only the strong ones are drawn; under 8 pixels
  for those too, none.
- View > Grid (key 5, on by default) and View > Snap to Grid (key 6, off by default), both toggles.
- Zoomed in, fine lines every 5 mm (four to each square, at half the grid lines' opacity) come in from 150%, and
  millimetre lines (at a quarter) from 600%, where the 5 mm lines are as far apart as the 20 mm lines at 150%. Every
  20 mm line is numbered from 200%, and every 5 mm line from 800% (the same ratio). The strong lines are 1.5 pixels
  wide, and the numbers are outlined in `--background` so they read over the picture. Drags snap to the finest lines
  drawn at the zoom: 1 mm from 600%, 5 mm from 150%, 20 mm below, and 100 mm where only the strong lines are left.
  (The user's asks at the checkpoint; they replace the plain 20 mm snapping below.)
- The numbers sit over the frame's dimming, so they stay readable outside the frame. Zoomed out, where the strong
  lines' numbers would be under 48 pixels apart, only every second, fifth or tenth strong line is numbered. The drawing
  is in `grid-drawing.tsx`, so that `./grid` names one file. (Settled in the build.)
- Snapping rounds to the nearest grid line. A pin drag snaps the pin under the pointer and moves the others by the
  same amount. A prop drag snaps the middle of the prop's bounds. A frame drag snaps the edges being dragged.

### Linked pins

- **The file.** A pin is either free (`x`, `y`, optional `angle`, as now) or linked:
  `{ "link": { "pin": [strand, pin], "side": "left" | "right", "gap"?: number, "reverse"?: true } }`. The reader
  checks that the leader exists, isn't the pin itself, and that following leaders never comes back round. A linked
  pin's leader may itself be linked.
- **Where it sits.** From the leader's place and direction `d` (its held angle, or for a linked leader, its own
  worked-out angle): the follower is at `leader + n × (leaderSize / 2 + followerSize / 2 + gap)`, `n` being `d`
  turned 90° to the left or right (y down, so left is `(d.y, -d.x)`), with angle `d`, or `d` reversed.
- **The leader holds an angle.** A free pin that leads must hold one; the reader refuses a free leader with none, and
  linking holds the leader's present direction as its angle first.
- **Geometry.** `pictureGeometry` resolves every linked pin to a place and angle before working out directions, then
  carries on as now. The geometry cache keys on the resolved values, not the pin objects, since a linked pin's
  object doesn't change when its leader moves.
- **Edits.** `linkPins(picture, geometry, leader, follower)` takes the side from which side of the leader the
  follower is now, `reverse` from whether the two run opposite ways, and no gap. `unlinkPin` writes the follower's
  resolved place and angle as a free pin. `setLink` sets side, gap and reverse.
- **Renumbering.** Links name pins, so every edit that renumbers pins (adding, deleting, a strand deleted) maps them
  through its `Renumbering`, as the selection is. A leader deleted unlinks its followers first, leaving them where they
  were.
- **The editor.** Edit > Link Pins (key L) links the second of two selected pins to the first; Edit > Unlink (Shift+L)
  unlinks the selected linked pins. Dragging a linked pin drags its leader (and so it); turning a linked pin's ring
  turns its leader. A linked pin's handle is drawn hollow, with a thin line to its leader. Its panel shows its place
  and angle (not typed), what it's linked to, and the side, gap and reverse to set.

## Tasks

### Review group 1: millimetres and rope sizes (visual checkpoint: an upgraded file looks as it did, and a 6 mm rope beside an 11 mm one)

- [x] **1. Rope drawings of any width** — Let `Stretch` and `Tape` draw ropes of any width
  - **Files:** `src/knots/rope-drawing.tsx`
  - **Do:** `Stretch` and `Tape` take an optional `width` (1 by default), and every stroke width, the weave's dash,
    `TRIM` and `TAPE_LENGTH` are multiplied by it.
  - **Done when:** the knot pages' SVG markup (figure-8, on a bight, rethreaded, joining, round turn) is byte for byte
    what it was before the change, compared in the browser. Type check, lint and `npm test` pass.

- [x] **2. File version 2** — Read and write knot files in millimetres, with rope diameters and the frame
  - **Files:** `src/knot-editor/format.ts`, `src/knot-editor/versions.ts`, `src/knot-editor/samples/v2.json`,
    `src/knot-editor/format.test.ts`, `src/knot-editor/edits.test.ts`, `src/knot-editor/editor.tsx`,
    `src/knot-editor/props/bar.tsx`
  - **Do:**
    - `CURRENT_VERSION = 2`, and one upgrade from version 1: every coordinate, locked length and prop size × 11,
      every rope given `diameter: 11`, and a frame fitted as in Decisions. (The frame part of this was drafted and set
      aside in the scratchpad's `v2-frame.patch`; it fitted in diameters, and needs scaling.)
    - The types, reader and writer: `Rope.diameter` (above 0, always written, after `colour`), `KnotFile.frame`, the
      file rounded to 0.01.
    - `samples/v2.json`: the version 1 sample upgraded and written by the editor. `v1.json` stays as it is.
    - A new knot (`untitledKnot`): one 11 mm orange rope from (0, 0) to (110, 0) and a 300 × 200 mm frame centred on
      it. A new bar: radius 17.6, length 220.
    - The test helpers build ropes with `diameter: 1`, and `FULL` and `BARE` get frames.
  - **Done when:** tests check the v1 sample upgrades (coordinates × 11, diameters, a frame round everything) and the
    v2 sample comes back byte for byte; a frame or diameter that's missing or not above 0 is refused, saying where.
    Type check, lint and `npm test` pass.

- [x] **3. Sizes from each rope** — Size bends, crossings, passes and drawings by each strand's own size
  - **Files:** `src/knot-editor/geometry.ts`, `src/knot-editor/crossing-geometry.ts`, `src/knot-editor/props/index.ts`,
    `src/knot-editor/props/bar.tsx`, `src/knot-editor/picture-drawing.tsx`, `src/knot-editor/arrow-drawing.tsx`,
    `src/knot-editor/canvas.tsx`, `src/knot-editor/zoom.ts`, `src/knot-editor/editor.tsx`,
    `src/knot-editor/inspector.tsx`, `src/knot-editor/status-bar.tsx`, `src/knot-editor/edits.ts`, their tests
  - **Do:**
    - `strandSize` and `ARROW_SIZE`, and every size in Decisions' list multiplied by its strand's size.
    - The canvas's margins and drag rounding, the zoom's base and limits, and a new strand's length in millimetres.
    - The panel: a rope's diameter, typed (above 0); units shown as mm on lengths and places. The status bar's
      pointer in millimetres to one place. A new rope takes the diameter of the picture's last rope.
    - `setRopeDiameter` in `edits.ts`.
  - **Done when:** tests check that a picture scaled by 11 with ropes of diameter 11 gives the same bends, crossings,
    over stretches and passes as the original with ropes of diameter 1 (scaled by 11); a 6 mm rope's bend warning
    starts at a 6 mm radius; a thin rope over a thick one clears it. In the browser, the v1 sample opened looks as it
    did before (screenshots compared), and a 6 mm rope drawn beside an 11 mm one is thinner throughout, tape and
    weave included. Type check, lint and `npm test` pass.
  - `visual`

Review group 1 ends here, with its visual checkpoint.

### Review group 2: the frame, the grid and snapping (visual checkpoint: the frame and a 20 mm grid)

- [x] **4. The frame** — Draw the knot's frame and change it by dragging or typing
  - **Files:** `src/knot-editor/frame.tsx`, `src/knot-editor/canvas.tsx`, `src/knot-editor/handles.tsx`,
    `src/knot-editor/edits.ts`, `src/knot-editor/state.ts`, `src/knot-editor/details-dialog.tsx`,
    `src/knot-editor/edits.test.ts`
  - **Do:** as in Decisions: the drawing and dimming, edge and corner dragging as one history entry, the fields in
    Knot Details, and View > Fit taking the frame in. `setFrame` refuses a width or height not above 0, and a drag
    stops an edge a millimetre short of the opposite one.
  - **Done when:** tests check `setFrame` and that a file-level drag is one undo step. In the browser, each edge and
    corner drags, Knot Details sets it, undo puts it back, and it's the same for every step. Type check, lint and
    `npm test` pass.
  - `visual`

- [x] **5. The grid and snapping** — Draw a fixed grid and snap drags to it
  - **Files:** `src/knot-editor/grid.ts`, `src/knot-editor/grid.tsx`, `src/knot-editor/canvas.tsx`,
    `src/knot-editor/menus.tsx`, `src/knot-editor/editor.tsx`, `src/knot-editor/grid.test.ts`
  - **Do:** as in Decisions: `GRID`, the drawing with its numbers and its thinning when zoomed out, the two View
    toggles, and snapping for pins, props and the frame. The snapping is a pure function in `grid.ts`, tested there.
  - **Done when:** tests check snapping (a value to its nearest line, a multi-pin drag keeping its shape) and which
    lines are drawn at a few zooms. In the browser, the grid draws and thins as you zoom out, and with snapping on a
    dragged pin, prop and frame edge land on grid lines. Type check, lint and `npm test` pass.
  - `visual`

Review group 2 ends here, with its visual checkpoint.

### Review group 3: linked pins (visual checkpoint: two ropes side by side round a bend, and a bight)

- [ ] **6. Linked pins in the file and geometry** — Read, write and resolve linked pins, and keep links through edits
  - **Files:** `src/knot-editor/format.ts`, `src/knot-editor/geometry.ts`, `src/knot-editor/edits.ts`,
    `src/knot-editor/format.test.ts`, `src/knot-editor/geometry.test.ts`, `src/knot-editor/edits.test.ts`
  - **Do:** as in Decisions: the pin union and its checks, resolving in `pictureGeometry` with the cache keyed on
    resolved values, `linkPins`, `unlinkPin`, `setLink`, and links renumbered by every edit that renumbers pins.
  - **Done when:** tests check a follower's place and angle on either side, reversed, with a gap and between ropes
    of two sizes; a chain of three; the reader refusing a missing leader, a loop and a free leader with no angle;
    links surviving a pin added before the leader, the leader's strand deleted (followers unlinked in place), and a
    follower deleted; and the cache recomputing a follower's segments when only its leader moved. Type check, lint
    and `npm test` pass.

- [ ] **7. Linked pins in the editor** — Link, unlink and drag linked pins
  - **Files:** `src/knot-editor/menus.tsx`, `src/knot-editor/editor.tsx`, `src/knot-editor/canvas.tsx`,
    `src/knot-editor/handles.tsx`, `src/knot-editor/inspector.tsx`, `src/knot-editor/shortcuts.tsx`
  - **Do:** as in Decisions: the two commands, dragging and turning through the leader, the hollow handle with its
    line to the leader, and the panel.
  - **Done when:** in the browser, two ropes linked at three pins run side by side round a bend, and stay so as the
    leader's pins are dragged and turned; a bight's two legs linked reversed run side by side; changing the side, gap
    and reverse in the panel moves the follower; unlinking leaves it in place. Type check, lint and `npm test` pass.
  - `visual`

- [ ] **8. Docs** — Bring the editor's design doc into line with version 2
  - **Files:** `docs/knot-editor.md`
  - **Do:** fold the "Version 2 (proposed)" section into the doc's body (Curves, Files, the page) as what's built,
    with the file examples in millimetres, and bring it into line with anything the build settled differently.
  - **Done when:** it reads correctly against the code. Prettier passes on it.

Review group 3 ends here, with its visual checkpoint.

## Docs impact

None on the site: the editor is dev only. Developer docs: `docs/knot-editor.md` (task 8).

## Out of scope

- The bend limit as a setting, arrows with widths of their own, and doubled strands.
- The knot pages reading the frame, and porting the existing knots.
- Any change to how the existing knots draw (Task 1 checks it).
