# Knot editor: design

A new editor for drawing knots and their tying steps, built from scratch beside the old rope editor
(`docs/rope-editor.md` lists that one's problems). The existing knots stay as they are, drawn by `pinned-rope.ts`, until
this editor has proved itself; then they're ported to its files. The build plan is
`docs/plans/2026-10-25-knot-editor.md`.

It's only for development for now, at `/knot-editor`, and only in Chrome or Edge (see Files).

## Strands: ropes and arrows

A picture's ropes and arrows are both strands. They're built and edited the same way, and differ only in how
they're drawn: a rope as rope, with its end taped; an arrow as a thin shaft with a head at its last pin. Where any two
strands cross, you choose which is on top, so an arrow can pass over one strand and under the next.

Each rope has a colour from a fixed set (orange, green and a few more), always written in the file, so adding or deleting a rope never changes another's colour. A new rope gets the first colour not already used in its picture, so a knot joining two ropes is orange and green, as on the knot pages, without setting anything. A rope can also have a name, shown in the panel.

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
- **Adding a pin** keeps the curve where it was: the new pin holds the curve's direction there (you can clear it), and the two halves take their tensions from the curve split at that point.
- **Shifting at a pin** slides rope through it: the segment before gets shorter by some amount and the one after
  longer, or the reverse, with the pin where it was. It needs both segments locked; with either free, the length just
  follows the curve.
- **Bends** tighter than 1.75 diameters are shaded on ropes as a warning, not stopped.

There's no physics in the curves: they're smooth by construction, and the bend warning is the only check that they
look like rope. Drawing one takes microseconds, so every change shows as soon as it's made.

## Props

Props are the things a knot is tied round or with. Each is of a kind, with that kind's own fields, and each kind is
kept in one place (`src/knot-editor/props/`): its type and checks, its drawing, and its fields in the panel. Adding a
kind touches nothing else.

A prop is drawn behind every strand, unless strands pass both in front of it and behind it. Then it's drawn over the strands but under their over stretches. It lists every pass across it with its side, front or behind, as crossings are listed, and you click a pass to swap it. A pass in front is drawn as an over stretch long enough to cover the prop.

The first kind is the bar: end on (a circle, behind the rope) or side on (with a length, passes in front and behind).
To come later: a carabiner and a ring, with passes in front and behind like the side-on bar; and hands, a tree and an
anchor, each a drawing placed with a position, rotation, size and flip, in front of or behind the strands.

## Files

The editor opens and saves files on your computer with the browser's file access (`showOpenFilePicker`,
`showSaveFilePicker`), which only Chrome and Edge have. Save writes back to the file that was opened, with nothing
written by the server. A dot in the title shows unsaved changes.

A file holds one knot as JSON, and only what can't be worked out:

```json
{
  "format": "avut-knot",
  "version": 1,
  "name": "Round turn and two half hitches",
  "description": "A line or so.",
  "about": "Longer text about the knot and its uses.",
  "knot": { "strands": [], "crossings": [], "props": [] },
  "steps": [
    { "number": 1, "instructions": "Pass the end round the bar twice.", "picture": {} },
    { "number": 1, "instructions": "…", "picture": {} }
  ]
}
```

- `description`, `about` and `steps` are optional.
- Step numbers can repeat, for a step shown in more than one picture (the "Step 2 (cont.)" of the knot pages).
- A picture (`knot`, or a step's `picture`) holds its strands, the crossings between them, and its props. Its view is
  worked out from what's in it.

### Versions

Every file says which version of the format it's in. Any change to what a file means or how it's laid out bumps the
version by one, and comes with an upgrade from the version before. Opening an older file runs it through each upgrade
in turn, so files from any earlier version still open; the editor says when it's upgraded one, and saving writes the current version. Old versions' shapes aren't kept as types: an upgrade works on plain JSON, and the checks run on what comes out of the last one. A file from a newer editor is refused, saying so. A sample file is kept for each version, and a test
opens every one of them.

### Strands

```json
{
  "kind": "rope",
  "colour": "green",
  "pins": [
    { "x": 0, "y": 32, "angle": -90 },
    { "x": 0, "y": 0 },
    { "x": -2, "y": -3.5 }
  ],
  "segments": [{ "length": 32 }, { "tension": [1, 1.4] }]
}
```

- `kind` is `rope` or `arrow`. A rope always has a `colour`, and a `name` only when set.
- A pin's `angle` (degrees, y down as in SVG) only when it holds one.
- A segment's `length` only when locked, and `tension` only when it isn't 1 at both ends. On a locked segment,
  `tension` is the ratio the editor keeps while it scales them to meet the length.

### Crossings

A crossing says which of two segments is on top, by strand and segment number (counted from 0 in the file, from 1 on
screen):

```json
{ "over": [0, 3], "under": [1, 9] }
```

When two segments cross more than once, `n` (from 1) says which crossing, counting along whichever of the two comes
first in the picture's order, so it doesn't depend on which is on top. The editor finds where segments cross from the
curves and matches them to this list:

- A crossing with no entry is drawn with a marker until you choose.
- An entry whose segments no longer cross is listed in the panel as lost, not dropped.
- When two segments cross a different number of times than they have entries, their entries are shown "to check"
  until you confirm them, since `n` may no longer name the same crossing.
- Adding a pin moves the entries on the segment it splits to the half their crossing is on. Deleting one moves the
  entries of the two segments it joins onto the joined one. Either way the entries are counted again and the later
  segments' numbers move up or down. Deleting a strand removes its entries.

### Props

```json
{
  "kind": "bar",
  "x": 0,
  "y": 0,
  "r": 1.6,
  "length": 20,
  "passes": [
    [0, 3, 1, "front"],
    [0, 5, 1, "behind"]
  ]
}
```

A prop's `passes` lists every pass across it as `[strand, segment, n, side]`, `n` counting that segment's passes across it. They're matched and kept up as crossings are: a pass with no entry is unset (drawn behind, with a marker), an entry with no pass is lost, and when a segment's count of passes changes its entries are shown to check.

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
│ Steps    │                                      │ Length 5.31 │
│  1       │             drawing                  │ [x] Locked  │
│  1       │                                      │ Tension     │
│  2       │                                      │  1.0   1.4  │
│  + Add   │                                      │             │
├──────────┴──────────────────────────────────────┴─────────────┤
│ x 3.25  y -1.50   Zoom 140%   2 bend warnings   1 crossing unset │
└───────────────────────────────────────────────────────────────┘
```

- **Menu bar** (shadcn's Menubar, on Radix), each item with its keyboard shortcut:
  - File: New, Open…, Save, Save As…, Knot details… (name, description, about)
  - Edit: Undo, Redo, Delete, Select All
  - Insert: Pin, Rope, Arrow, Prop (each kind), Step
  - View: Zoom In, Zoom Out, Fit, Pin Numbers, Handles, Crossings, Bend Warnings
  - Help: Shortcuts
- **Left:** the knot and its steps; choosing one puts its picture in the drawing.
- **Drawing:**
  - Click a pin, segment or prop to select it, shift-click for more.
  - Drag a pin or prop to move it; drag a pin's ring to turn its angle; drag a handle to change a tension.
  - Double-click a segment to add a pin there; click a crossing to swap which strand is on top, or a pass across a
    prop to move it in front or behind.
  - Scroll to zoom, drag the background to pan.
- **Right:** what's selected, every value typed or changed there:
  - pin: x, y, angle (blank for none), shift;
  - segment: length, locked, both tensions;
  - a rope's pin or segment: also the rope's colour and name;
  - prop: its kind's fields;
  - nothing: the step's number and instructions.
- **Status bar:** the pointer's position, the zoom, warnings, and whether the file's saved.

## How it's built

- `src/knot-editor/`: the editor, apart from `src/knots`. The file format and its checks in `format.ts`, its versions
  and upgrades in `versions.ts`, prop kinds in `props/`, and its state in a reducer (the document, selection and undo
  history; each change makes a new document that shares what it didn't change, so undo keeps whole documents).
- `src/lib/`: the curve maths, with tests: Hobby's directions, the Bézier control points from directions and
  tensions, length, tightest bend, where two curves cross.
- Each segment's curve, length, bends and bounding box are kept until its pins or its own values change. Crossings
  are only looked for between segments whose boxes overlap.
- Dragging reads the pointer straight from its events and applies at most one change a frame. Nothing else is held
  in state on pointer moves.
- A picture draws as the knot pages do: props behind, every strand whole, props with passes, the over stretches, then the ropes' taped ends. Ropes are drawn with the
  same pieces as `RopeDrawing`, so a ported knot draws the same on its page as in the editor.

## Order of work

1. The curve maths, the versioned file format, and a picture's geometry.
2. The layout split, the page with its menu bar, and New, Open and Save.
3. Drawing and editing strands: undo, the drawing, selecting and dragging, the panel and warnings.
4. Crossings, and props.
5. Steps and the knot's details.

Later: props beyond the bar, taped ends, exporting SVG, porting the existing knots, and the knot pages reading these
files.
