# Knot editor: design

A new editor for drawing knots and their tying steps, built from scratch beside the old rope editor
(`docs/rope-editor.md` lists that one's problems). The existing knots stay as they are, drawn by `pinned-rope.ts`, until
this editor has proved itself; then they're ported to its files. It was built to two plans:
`docs/plans/2026-10-25-knot-editor.md` (the editor) and `docs/plans/2026-10-26-knot-editor-v2.md` (millimetres, rope
sizes, the frame, the grid, ids and linked pins).

It's only for development for now, at `/knot-editor`, and only in Chrome or Edge (see Files).

Everything is in millimetres, with y down as in SVG: places, lengths, sizes and the frame. Angles are in degrees.

## Strands: ropes and arrows

A picture's ropes and arrows are both strands. They're built and edited the same way, and differ only in how
they're drawn: a rope as rope, with its end taped; an arrow as a thin shaft with a head at its last pin. Where any two
strands cross, you choose which is on top, so an arrow can pass over one strand and under the next.

Each rope has a colour from a fixed set (orange, green and a few more), always written in the file, so adding or deleting a rope never changes another's colour. A new rope gets the first colour not already used in its picture, so a knot joining two ropes is orange and green, as on the knot pages, without setting anything. A rope can also have a name, shown in the objects list and the panel.

Each rope has a diameter, 11 mm by default; a new rope takes the diameter of the picture's last rope. Everything that
goes with a rope's size is in its own diameters: how wide it's drawn (outline, body, weave, highlight and tape), the
bend warning, how far it's drawn over at a crossing, and how far past a prop a pass in front of it reaches. Arrows are
one fixed size for now, as they look beside an 11 mm rope, whatever the ropes' sizes; an arrow may later get a width of
its own, to show where ropes of different sizes go.

## Curves

Each strand is a row of pins with a segment between each pair, and each segment is one cubic Bézier curve.

- **Pins** are points the strand passes through. A pin can hold an angle, the way the strand runs through it. Both
  segments meet it in that direction, so there's no corner there.
- **Pins without an angle** get one from Hobby's method (as in MetaPost and TikZ's knot drawings), which picks the
  directions that make the smoothest curve through the pins. Each run of pins without angles is one small tridiagonal
  solve, and pins holding an angle end the run, so a change only spreads as far as the nearest pins either side
  holding one. The directions are solved as if every tension were 1, so they depend only on the pins.
- **Tension** shapes a segment: one number at each end, 1 by default. Higher pulls the curve tighter to the straight
  line between its pins, lower lets it bow out further. On the drawing these are the segment's two handles, which slide
  along the pin's direction, so dragging one reshapes the curve but can't put a corner in it. A segment's tensions
  shape only that segment.
- **Length** is worked out from the curve. It's held only when the segment is locked: then the editor scales both its
  tensions by one factor, keeping their ratio, until the curve has that length (a one-number search on that segment
  alone). The handles don't drag while it's locked. When no factor can (the tensions would have to go above 4 or below
  0.75), the segment shows red and the panel says why. The move still happens. Locking and unlocking never move the
  curve: lock takes the current length, and unlock keeps the scaled tensions.
- **Adding a pin** keeps the curve where it was: the new pin holds the curve's direction there, the segment's two ends hold theirs where they were free (you can clear any of them), and the two halves take their tensions from the curve split at that point.
- **Shifting at a pin** slides rope through it: the segment before gets shorter by some amount and the one after
  longer, or the reverse, with the pin where it was. It needs both segments locked; with either free, the length just
  follows the curve.
- **Bends** tighter than a radius of 1 of the rope's diameters (to the centre line: about as tight as a rope pulled
  snug round another of its size) are shaded on ropes as a warning, not stopped. The limit is to be made a setting
  later.

There's no physics in the curves: they're smooth by construction, and the bend warning is the only check that they
look like rope. Drawing one takes microseconds, so every change shows as soon as it's made.

## Linked pins

A pin can be linked to another, its leader, so it stays beside it: the two ropes then run side by side through there,
as parallel ropes or the two legs of a bight do.

- **Where it sits.** Beside the leader, square to the way the leader runs, on its left or its right (looking the way
  it runs). The ropes touch as drawn, outlines and all: half of each one's drawn width (1.25 diameters) apart centre
  to centre, unless the link has a `gap` (millimetres) to add.
- **Which way it runs.** The same way as the leader, or the reverse, as the two legs of a bight do.
- **The leader holds an angle.** Linking holds a free leader's direction as it is, as adding a pin does: otherwise its
  direction would come from the curve, which in a bight would depend on the linked pin itself. A leader's angle can be
  turned but not cleared.
- **Linking** (Edit > Link Pins) links the second of two selected pins to the first, on whichever side of it it is
  now, reversed if it runs the other way now.
- **Moving.** Dragging or turning the leader carries the linked pin. Dragging a linked pin moves its leader (the free
  pin heading its chain of links), and turning its ring turns the leader, so either can be picked up. A pin can lead
  several, and a linked pin can lead another (three ropes side by side), but links can't go round in a loop.
- **Unlinking** (Edit > Unlink, or the panel) leaves the pin where it is, holding its direction. Deleting a leader
  unlinks its followers the same way.
- **Between linked pins** the two curves are close to parallel, not exactly: a Bézier moved sideways isn't another
  Bézier, so on a tight bend the gap narrows or widens a little. Linking more pins along the way holds it closer.
  Linked pins are how doubled rope is drawn (a bight, or a knot tied on one, as the figure-8 on a bight is): each
  leg is a strand of its own, linked pin by pin to the other.

## Props

Props are the things a knot is tied round or with. Each is of a kind, with that kind's own fields, and each kind is
kept in one place (`src/knot-editor/props/`): its type and checks, its drawing, and its fields in the panel. Adding a
kind touches nothing else.

A prop is drawn behind every strand, unless strands pass both in front of it and behind it. Then it's drawn over the strands but under their over stretches. It lists every pass across it with its side, front or behind, as crossings are listed, and you click a pass to swap it. A pass in front is drawn as an over stretch long enough to cover the prop.

The first kind is the bar: end on (a circle, behind the rope) or side on (with a length, passes in front and behind).
A new one is 17.6 mm in radius and 220 mm long. To come later: a carabiner and a ring, with passes in front and behind
like the side-on bar; and hands, a tree and an anchor, each a drawing placed with a position, rotation, size and flip,
in front of or behind the strands.

## The frame

The knot has one frame, shared by the knot and every step: what the knot's page will show, so the steps line up as you
step through them.

- **Drawn** as a dashed rectangle, with everything outside it dimmed.
- **Set** by dragging its edges or corners on the drawing (an edge stops a millimetre short of the opposite one), or
  typed in File > Knot Details…. A drag of it is one step to undo.
- **A new knot** starts with a frame 300 mm wide and 200 mm high, centred on its first rope.
- **The view is kept on it.** View > Fit takes in the frame and everything drawn. Zooming out stops where the frame
  fills half the view, across or down, and panning stops where the frame's edge is in the middle of the view; both
  stretch to take in anything drawn outside the frame, so it can still be reached.

## Files

The editor opens and saves files on your computer with the browser's file access (`showOpenFilePicker`,
`showSaveFilePicker`), which only Chrome and Edge have. Save writes back to the file that was opened, with nothing
written by the server. A dot in the title shows unsaved changes.

A file holds one knot as JSON, and only what can't be worked out:

```json
{
  "format": "avut-knot",
  "version": 3,
  "name": "Round turn and two half hitches",
  "description": "A line or so.",
  "about": "Longer text about the knot and its uses.",
  "frame": { "x": -150, "y": -100, "w": 300, "h": 200 },
  "knot": { "strands": [], "crossings": [], "props": [] },
  "steps": [
    { "number": 1, "instructions": "Pass the end round the bar twice.", "picture": {} },
    { "number": 1, "instructions": "…", "picture": {} }
  ]
}
```

- `description`, `about` and `steps` are optional.
- Step numbers can repeat, for a step shown in more than one picture (the "Step 2 (cont.)" of the knot pages).
- A picture (`knot`, or a step's `picture`) holds its strands, the crossings between them, and its props.
- Numbers are rounded to 0.01 (a hundredth of a millimetre); a drag rounds to 0.1 mm.

### Ids

Every strand, segment, pin and prop has an `id`, a whole number from 1, unique in its picture and written first.
Crossings, passes and links name things by id, so adding or deleting pins and strands never renumbers a reference.
One counter runs across the file: a new thing gets the lowest number above every id in the file, and a picture copied
into a step keeps its ids, so an id is the same thing in every step that has it. When a pin is inserted, the first half
of the segment it splits keeps the segment's id; when one is deleted, the joined segment keeps the first one's. The
file doesn't store the counter; it's worked out from the ids there.

### Versions

Every file says which version of the format it's in. Any change to what a file means or how it's laid out bumps the
version by one, and comes with an upgrade from the version before. Opening an older file runs it through each upgrade
in turn, so files from any earlier version still open; the editor says when it's upgraded one, and saving writes the current version. Old versions' shapes aren't kept as types: an upgrade works on plain JSON, and the checks run on what comes out of the last one. A file from a newer editor is refused, saying so. A sample file is kept for each version, and a test
opens every one of them.

- **Version 1** was in rope diameters.
- **Version 2** is in millimetres, with a diameter for each rope and the knot's frame. The upgrade takes a diameter as
  11 mm (every coordinate, locked length and prop size times 11, every rope 11 mm across) and fits a frame round every
  pin and prop of every picture, 30 mm clear, out to whole centimetres.
- **Version 3** adds ids. The upgrade numbers everything in order across the file; it can't know which things in two
  steps are the same, so upgraded steps don't share ids.

### Strands

```json
{
  "id": 1,
  "kind": "rope",
  "colour": "green",
  "diameter": 11,
  "pins": [
    { "id": 2, "x": 0, "y": 352, "angle": -90 },
    { "id": 3, "link": { "pin": 17, "side": "left", "gap": 2, "reverse": true } },
    { "id": 4, "x": -22, "y": -38.5 }
  ],
  "segments": [
    { "id": 5, "length": 352 },
    { "id": 6, "tension": [1, 1.4] }
  ]
}
```

- `kind` is `rope` or `arrow`. A rope always has a `colour` and a `diameter`, and a `name` only when set.
- A free pin's `angle` (degrees) only when it holds one.
- A linked pin holds only its link, since its place and angle are worked out from its leader (`pin`, by id): `gap`
  only when it isn't 0, and `reverse` only when set. The leader must be in the picture, the links mustn't go round in
  a loop, and a free pin that leads must hold an angle.
- A segment's `length` only when locked, and `tension` only when it isn't 1 at both ends. On a locked segment,
  `tension` is the ratio the editor keeps while it scales them to meet the length.

### Crossings

A crossing says which of two segments (by id) is on top:

```json
{ "over": 6, "under": 23 }
```

When two segments cross more than once, `n` (from 1) says which crossing, counting along whichever of the two comes
first in the picture's order (the lower strand, then the lower segment), so it doesn't depend on which is on top. The
editor finds where segments cross from the curves and matches them to this list:

- A crossing with no entry is drawn with a red marker until you choose. Clicking it puts the pair's first segment on
  top; clicking again swaps them.
- An entry whose segments no longer cross is listed in the panel as lost, not dropped, with a button to delete it.
- When two segments cross a different number of times than they have entries, their entries are shown "to check"
  (an amber ring) until you confirm them, since `n` may no longer name the same crossing. That includes a pair
  crossing twice with only one of them set so far. Confirming replaces the pair's entries with its crossings as
  they're drawn now, numbered afresh; one drawn with no side yet gets the pair's first segment on top.
- Crossings too close for both over stretches to fit get the amber ring too. View > Crossings letters every crossing
  (A, B…), so the panel can name them.
- Adding a pin moves the entries on the segment it splits to the half their crossing is on. Deleting one moves the
  entries of the two segments it joins onto the joined one. Either way the entries are counted again. An entry
  between the two segments a delete joins is left naming one segment twice, shown "to check" until you remove it.
  Deleting a strand removes its entries.

### Props

```json
{
  "id": 21,
  "kind": "bar",
  "x": 0,
  "y": 0,
  "r": 17.6,
  "length": 220,
  "passes": [
    [8, 1, "front"],
    [10, 1, "behind"]
  ]
}
```

A prop's `passes` lists every pass across it as `[segment, n, side]` (the segment by id), `n` counting that segment's passes across it. They're matched and kept up as crossings are: a pass with no entry is unset (drawn behind, with a marker), an entry with no pass is lost, and when a segment's count of passes changes its entries are shown to check. Clicking an unset pass puts it in front, and clicking again swaps it; confirming a segment's passes enters each as it's drawn now, so one unset is entered behind.

The file is laid out exactly as Prettier would format it, since the commit hook runs Prettier on JSON too: the editor formats it with Prettier itself.

## The page

The editor has its own look, with none of the site's chrome. The root layout keeps only `<html>`, `<body>`, fonts and
metadata. The site's footer, scroll box and `ScrollMemory` move to a `(site)` route group's layout, with every existing
page moved under it (no address changes), and the editor sits in an `(editor)` group with its own layout. Both still share
the one root layout, so going between them isn't a full page load. A new `not-found.tsx` at the top draws the site's
chrome for addresses that match no page.

```
┌───────────────────────────────────────────────────────────────┐
│ File  Edit  Insert  View  Help              round-turn.json • │
├──────────┬──────────────────────────────────────┬─────────────┤
│ Knot     │                                      │ Segment 4   │
│ Steps    │                                      │ Length 58.4 │
│  1 Make… │             drawing                  │ [x] Locked  │
│  1 Seen… │                                      │ Tension     │
│  2 Pass… │                                      │  1.0   1.4  │
│ ⧉ ↑ ↓ ✕  │                                      │             │
├──────────┴──────────────────────────────────────┴─────────────┤
│ x 35.8  y -16.5 mm  1 crossing unset  Saved  − ───●─── + 140% │
└───────────────────────────────────────────────────────────────┘
```

- **Menu bar** (shadcn's Menubar, on Radix), each item with its keyboard shortcut if it has one. Inserting has none,
  and of the View toggles only Grid (G) and Snap to Grid (F) do:
  - File: New, Open…, Save, Save As…, Knot Details… (a dialog for the name, description, about text and frame)
  - Edit: Undo, Redo, Delete, Select All, Select None, Select Next Pin, Select Previous Pin, Move (Up, Left, Down,
    Right, Turn Anticlockwise, Turn Clockwise), Link Pins, Unlink
  - Insert: Pin, Rope, Arrow, Prop (each kind), Step
  - View: Zoom In, Zoom Out, Fit, Pin Numbers, Handles, Crossings, Bend Warnings, Grid, Snap to Grid
  - Help: Shortcuts
- **Left:** the knot, then each step as its number and the start of its instructions; choosing one puts its picture
  in the drawing. Insert > Step adds a step after the one shown, a copy of its picture numbered one more (with the
  knot shown, after the last step, a copy of the knot). The step shown can be duplicated (the copy keeps its number),
  moved up or down, or deleted. The editor never numbers steps again: numbers are only typed. Below them, the objects
  in the picture shown: its ropes and arrows, each with its colour, then its props. Choosing one selects it whole.
  Each list's heading has a + button: on Steps it adds a step as Insert > Step does, and on Objects it opens a menu
  of a rope, an arrow and each kind of prop.
- **Drawing:**
  - Click a pin, segment or prop to select it; shift-click pins and segments to select more.
  - Drag a pin or prop to move it; drag a pin's ring to turn its angle; drag a handle to change a tension; drag the
    frame's edges or corners to set it.
  - Double-click a segment to add a pin there; click a crossing to swap which strand is on top, or a pass across a
    prop to move it in front or behind.
  - A linked pin's handle is a ring rather than a dot, with a thin line to its leader.
  - Scroll to zoom, drag the background to pan.
- **Keyboard**, so the right hand can stay on the mouse:
  - W, A, S and D (or the arrow keys) move what's selected: pins, a segment's two pins, a whole strand, or a prop.
    Each press goes 1 mm, or 10 mm with Shift. With snap on, it takes the first pin (or the prop's centre) to the
    next line of the grid that way, the finest drawn at the zoom, or with Shift the level above; the rest go with it.
  - Q and E turn the selected pins anticlockwise and clockwise on the screen: 5°, or 15° with Shift, and with snap
    on, to the next multiple of that. A pin holding no angle starts from the way its curve runs.
  - Moves and turns go as drags do: a linked pin moves or turns the free pin heading its chain. A run of presses is
    one entry in the history, so one undo takes it all back.
  - Tab and Shift+Tab select the next or previous pin, along its strand and on into the next; Escape selects nothing.
    On a button, slider or menu, Tab, Escape and the arrow keys are its own; clicking the drawing gives them back.
- **Right:** what's selected, every value typed or changed there, with its unit:
  - pin: x, y, angle (blank for none), shift;
  - linked pin: its place and angle (shown, not typed), what it's linked to, its side, gap and direction, and Unlink;
  - segment: length, locked, both tensions;
  - rope or arrow, chosen in the objects list: its pins and length (shown), and for a rope its colour, diameter and
    name; Delete deletes it;
  - prop: its kind's fields;
  - nothing: the step's number and instructions (on the knot, a hint);
  - and below, whatever's selected: lost entries, each to delete, and crossings and passes to check, each to
    confirm.
- **Status bar:** the pointer's position (millimetres, to one place), each kind of warning counted, whether the file's
  saved, and the zoom, as in Excel: − and + step to the next round level (… 75%, 100%, 125% …), the slider between runs
  on a log scale with 100% in its middle, and clicking the percentage goes back to 100%. At 100% an 11 mm rope is 20
  pixels across, and the zoom runs from 5% to 2000%, less where the frame stops it zooming out.

### The grid and snapping

- **View > Grid** (on by default) draws a fixed grid under the picture: lines every 20 mm, every 100 mm stronger,
  numbered along the top and left of the view. Zoomed in, finer lines come in: every 5 mm from 150%, and every
  millimetre from 600% (where the 5 mm lines are as far apart as the 20 mm lines are at 150%). The numbers come in on
  the 20 mm lines from 200% and on the 5 mm lines from 800%. Zoomed out, lines closer than 8 pixels apart are left out,
  and only every second, fifth or tenth 100 mm line is numbered where their numbers would crowd. The numbers are
  outlined so they read over the picture.
- **View > Snap to Grid** (off by default) snaps dragged pins, props and the frame's edges to the finest lines drawn at
  the zoom: 1 mm, 5 mm, 20 mm, or 100 mm zoomed far out. A drag of several pins snaps the one under the pointer and
  moves the rest with it, keeping their shape; a prop's middle snaps. Angles and tensions aren't snapped, and typed
  values never are.

## How it's built

- `src/knot-editor/`: the editor, apart from `src/knots`. The file format and its checks in `format.ts`, its versions
  and upgrades in `versions.ts`, ids in `ids.ts`, prop kinds in `props/`, the grid in `grid.ts`, the view's limits in
  `view.ts`, and its state in a reducer (the document, selection and undo history; each change makes a new document
  that shares what it didn't change, so undo keeps whole documents). Edits that make things are given new ids by the
  reducer, worked out from the file.
- `src/lib/`: the curve maths, with tests: Hobby's directions, the Bézier control points from directions and
  tensions, length, tightest bend, where two curves cross.
- A picture's geometry places linked pins from their leaders first (`placedPins`), then works out each segment's
  curve, length, bends and bounding box, keeping them until its pins' places and directions or its own values change
  (compared by value, as a linked pin moves with its leader without itself changing). Crossings are only looked for
  between segments whose boxes overlap.
- The editor's selection, hit areas and panel names are by position ("Rope 2, pin 3"), as they're about what's on
  screen; matching crossings and passes works by position too, turned to and from ids at the picture's edge.
- Dragging reads the pointer straight from its events and applies at most one change a frame. Nothing else is held
  in state on pointer moves.
- A picture draws as the knot pages do: props behind, every strand whole, props with passes, the over stretches, then the ropes' taped ends. Ropes are drawn with the
  same pieces as `RopeDrawing` (`Stretch` and `Tape`, given each rope's width), so a ported knot draws the same on its
  page as in the editor; the knot pages pass no width, and draw exactly as before.

## Order of work

1. The curve maths, the versioned file format, and a picture's geometry.
2. The layout split, the page with its menu bar, and New, Open and Save.
3. Drawing and editing strands: undo, the drawing, selecting and dragging, the panel and warnings.
4. Crossings, and props.
5. Steps and the knot's details.
6. Version 2: millimetres and rope sizes; the frame, the grid and snapping; ids and linked pins.

Later: the bend limit as a setting, arrows with widths of their own, props beyond the bar, exporting
SVG, porting the existing knots, and the knot pages reading these files (and their frames).
