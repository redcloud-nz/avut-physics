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
- **Adding a pin** keeps the curve where it was: the new pin holds the curve's direction there, the segment's two ends hold theirs where they were free (you can clear any of them), and the two halves take their tensions from the curve split at that point.
- **Shifting at a pin** slides rope through it: the segment before gets shorter by some amount and the one after
  longer, or the reverse, with the pin where it was. It needs both segments locked; with either free, the length just
  follows the curve.
- **Bends** tighter than a radius of 1 diameter (to the centre line: about as tight as a rope pulled snug round
  another of its size) are shaded on ropes as a warning, not stopped. The limit is to be made a setting later.

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
  entries of the two segments it joins onto the joined one. Either way the entries are counted again and the later
  segments' numbers move up or down. An entry between the two segments a delete joins is left naming one segment
  twice, shown "to check" until you remove it. Deleting a strand removes its entries.

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

A prop's `passes` lists every pass across it as `[strand, segment, n, side]`, `n` counting that segment's passes across it. They're matched and kept up as crossings are: a pass with no entry is unset (drawn behind, with a marker), an entry with no pass is lost, and when a segment's count of passes changes its entries are shown to check. Clicking an unset pass puts it in front, and clicking again swaps it; confirming a segment's passes enters each as it's drawn now, so one unset is entered behind.

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
│  1 Make… │             drawing                  │ [x] Locked  │
│  1 Seen… │                                      │ Tension     │
│  2 Pass… │                                      │  1.0   1.4  │
│ ⧉ ↑ ↓ ✕  │                                      │             │
├──────────┴──────────────────────────────────────┴─────────────┤
│ x 3.25  y -1.50   1 crossing unset   Saved  − ───●──── + 140% │
└───────────────────────────────────────────────────────────────┘
```

- **Menu bar** (shadcn's Menubar, on Radix), each item with its keyboard shortcut:
  - File: New, Open…, Save, Save As…, Knot Details… (a dialog for the name, description and about text)
  - Edit: Undo, Redo, Delete, Select All
  - Insert: Pin, Rope, Arrow, Prop (each kind), Step
  - View: Zoom In, Zoom Out, Fit, Pin Numbers, Handles, Crossings, Bend Warnings
  - Help: Shortcuts
- **Left:** the knot, then each step as its number and the start of its instructions; choosing one puts its picture
  in the drawing. Insert > Step adds a step after the one shown, a copy of its picture numbered one more (with the
  knot shown, after the last step, a copy of the knot). The step shown can be duplicated (the copy keeps its number),
  moved up or down, or deleted. The editor never numbers steps again: numbers are only typed.
- **Drawing:**
  - Click a pin, segment or prop to select it; shift-click pins and segments to select more.
  - Drag a pin or prop to move it; drag a pin's ring to turn its angle; drag a handle to change a tension.
  - Double-click a segment to add a pin there; click a crossing to swap which strand is on top, or a pass across a
    prop to move it in front or behind.
  - Scroll to zoom, drag the background to pan.
- **Right:** what's selected, every value typed or changed there:
  - pin: x, y, angle (blank for none), shift;
  - segment: length, locked, both tensions;
  - a rope's pin or segment: also the rope's colour and name;
  - prop: its kind's fields;
  - nothing: the step's number and instructions (on the knot, a hint);
  - and below, whatever's selected: lost entries, each to delete, and crossings and passes to check, each to
    confirm.
- **Status bar:** the pointer's position, each kind of warning counted, whether the file's saved, and the zoom, as in
  Excel: − and + step to the next round level (… 75%, 100%, 125% …), the slider between runs on a log scale with 100%
  in its middle, and clicking the percentage goes back to 100%. 100% is 20 pixels per rope diameter, and the zoom runs
  from 5% to 2000%.

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

## Version 2 (proposed)

Not built yet; for review. Three changes to the file, made together as version 2 since each would bump the version on
its own: millimetres instead of rope diameters, a diameter for each rope, and the knot's frame. Linked pins (for
parallel ropes), the grid and snapping come with them.

### Millimetres

Every coordinate and length in the file and the editor is in millimetres (y down, as now): pins, locked lengths, props
and the frame. Angles stay in degrees and tensions are unitless, so they don't change.

- **Rounding.** The file rounds to 0.01 mm (about what 1e-4 diameters is now), and a drag to 0.1 mm.
- **On screen.** The panel and status bar show millimetres. The zoom becomes pixels per millimetre, with 100% set so an
  11 mm rope looks as it does now (20 pixels across), so the slider and its levels stay as they are.
- **Upgrading a version 1 file** takes a rope diameter as 11 mm: every coordinate, locked length and prop size is
  multiplied by 11, and every rope gets a diameter of 11.

### Rope sizes

Each rope has a `diameter` (millimetres), always written, like its colour. A new rope takes the diameter of the last
rope added (11 mm in a new file); the panel sets it.

Everything now sized in diameters is sized by each rope's own diameter instead:

- **Drawing.** `Stretch` takes the rope's width and scales its outline, body, weave and highlight with it, and the tape
  is 1.2 of the rope's diameters long. The existing knots pass a width of 1 (their units are diameters), so they draw
  exactly as now.
- **The bend warning** is in the rope's own diameters (1 for now, to become a setting).
- **Over stretches.** How far one reaches past a crossing, and how far it must clear the strand under it, come from
  both strands' widths, not one shared half-width.
- **Props.** A bar's pass margin (how far past it a strand in front is drawn over) is in the passing rope's diameters.
- **Arrows** are one fixed size for now, the size they are beside an 11 mm rope today, whatever the ropes' sizes. An
  arrow may later get a width of its own, to show where ropes of different sizes go.

### The frame

The knot has one frame, `"frame": { "x": …, "y": …, "w": …, "h": … }` in millimetres, shared by the knot and every step:
what the knot's page will show, so the steps line up as you step through them.

- **Drawn** as a dashed rectangle, with everything outside it dimmed. View > Fit fits the frame and everything in it.
- **Set** by dragging its edges or corners on the drawing, or typed in File > Knot Details…. It snaps to the grid when
  snapping is on.
- **A new knot** starts with a frame 300 mm wide and 200 mm high, centred on its first rope.
- **Upgrading a version 1 file** fits one round every pin and prop of every picture, 30 mm clear, out to whole
  centimetres.

### Linked pins (parallel ropes)

A pin can be linked to another, its leader, so it stays beside it: the two ropes then run side by side through there.

- **Where it sits.** Beside the leader, square to the leader's direction, on its left or its right. By default the
  ropes touch (half of each one's diameter apart, centre to centre); a `gap` (millimetres) adds space between them.
- **Which way it runs.** The same way as the leader, or the reverse (`reverse`), as the two legs of a bight do.
- **The leader holds an angle.** Linking holds the leader's direction as it is, as adding a pin does. Otherwise the
  leader's direction would come from the curve, which in a bight would depend on the linked pin itself.
- **Moving.** Dragging or turning the leader carries the linked pin. Dragging the linked pin moves the leader with it,
  so either can be picked up. A pin can lead several, and a linked pin can lead another (three ropes side by side),
  but links can't go round in a loop.
- **Unlinking** leaves the pin where it is, holding its direction.
- **In the file**, a linked pin holds only its link, `{ "link": { "pin": [strand, pin], "side": "left", "gap": 2,
"reverse": true } }` (`gap` and `reverse` only when set), since its place and angle are worked out from the leader.
- **Between linked pins** the two curves are close to parallel, not exactly: a Bézier moved sideways isn't another
  Bézier, so on a tight bend the gap narrows or widens a little. Linking more pins along the way holds it closer. If
  that isn't enough, a doubled strand (one strand drawn as two ropes, as the figure-8 on a bight is) is the stronger
  way, left for later.

### The grid and snapping

- **View > Grid** draws a grid under the picture at one fixed spacing, with every fifth line stronger and the
  numbers (millimetres) along the top and left of the view. The spacing is one constant, starting at 20 mm, to be
  tried at different sizes once it's built. Zoomed far out, where the lines would be under 8 pixels apart, only the
  stronger ones are drawn.
- **View > Snap to Grid** snaps dragged pins, props and the frame's edges to the grid's lines. A drag of several pins
  snaps the one under the pointer and moves the rest with it, keeping their shape. Angles and tensions aren't
  snapped, and typed values never are.
