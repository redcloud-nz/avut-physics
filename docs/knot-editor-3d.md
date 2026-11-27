# 3D knot editor: design

**Status (2026-11-25):** built, at `/knot-editor-3d`, on branch `knot-editor-3d`. The figure 8's twist is fixed
(`src/rigging/knots/figure-8.json`), and it's drawn on the flying fox's trolleys, tying the dropper into the rider's
carabiner. Its other uses (the rethreaded 8s, the joining rope's) still stand in as turns round a bar. What changed from the design below as it was built is under Built.

**Rework planned (2026-11-27):** pins and segments as in the 2D editor, the carabiner as its closed loop, new knots
from any drawing file, and tightening painted and run in stages. See "Rework: pins and staged tightening" at the end;
where it differs from what's above, it wins.

An editor for shaping knots in 3D by hand, a few segments at a time, and tightening them, saved to files. It's for
the flying fox's figure 8s first: their 3D shape comes from tightening the Rescue Knots drawing, which leaves strands
twisted in places, and fixing a twist means moving rope about half way round the knot while watching what happens.
Talking moves through by segment number and millimetres worked for small fixes but is too slow and too hard to judge
for that.

It grows out of what's in `src/flying-fox/` now: `knot-3d.ts` (a drawing lifted into 3D, numbered segments, axes),
`knot-tighten.ts` (tightening by position-based dynamics) and `knot-edit.ts` (moving, tightening and smoothing
segments, run by hand from a script). The trial figure 8 those were tried on is `fig8-trial.json`, shown in the parts
viewer as "Figure 8, tightened (trial)".

## What it's for

- **One figure 8, many knots.** Every figure 8 the flying fox uses (on a bight round a carabiner, rethreaded, the
  joining rope's) shares one tightened figure 8 core. Only where the strands come into and leave the core differs
  between them. The editor makes that core; how each knot routes its strands is set out under Using the knots.
- **Fixing it by hand.** The tightening gets a knot's shape and size close, but can leave the doubled strands twisted
  round each other. You fix those as you would holding the knot: pick the stretch of rope to work, move it, and draw
  it up again.

## The rope

- **A rope is its centreline,** points about a quarter of a diameter apart, in metres, with its diameter. The
  tightening works on points, so the file keeps them.
- **Segments.** The rope's divided into numbered segments, about 20 mm long to start with, counted from its start (the
  standing end). Each point belongs to a segment, and keeps it as rope is added, taken up or slides through the knot:
  a segment is a piece of the rope itself, not a place in the knot.
- **Props.** A bar the knot's tied round (a carabiner's bar), as a straight rod with a centre, a direction and a
  radius. More kinds can come later.
- **What the rope can't do,** in every edit: pass through itself or a prop, or bend tighter than its least bend
  (`minBend`, about one diameter to its centreline: rope's stiff). It resists bending (`stiffness`), so it settles into
  wide, even curves.

## Working on the rope

### In play

- **Click a segment to make it the handle:** its centre is what you move. A click picks the handle and nothing else, so
  moving on from one segment to the next while the same stretch is in play is one click each. Clicking a segment
  that isn't in play puts it in play on its own.
- **Ctrl-click (⌘-click on a Mac) puts segments in play** or takes them out, one at a time; with shift as well, it
  puts in every segment between that one and the last one chosen. There's also a toggle (a button, and a key) for
  choosing in play, in which a plain click does what a ctrl-click does, for working one-handed or on a trackpad. The
  segments in play are a run along the rope; choosing one that leaves a gap fills the gap.
- **Only rope in play moves.** Everything else stays where it is, and is in the way: rope in play is kept off it.
- **The ends are locked.** The far end of each outermost segment in play holds its place and the direction the rope
  runs there, so the rope in play always joins the fixed rope smoothly.

### Moving

- **Drag the handle** with arrows along X, Y and Z in the 3D view, or nudge it from the panel (1 mm, or 5 mm with
  shift), or type an offset. Keys nudge it too, by the same amounts: W and S away from the eye and back, A and D to
  its left and right (each along whichever of X and Z is nearest that way in the view), R and F up and down.
- **The rope in play follows one smooth curve** from one locked end, through the handle, to the other, matching
  position and direction at each locked end (a cubic Hermite spline through the three, or the same idea in more
  pieces). Only the handle's segment changes length: the other segments in play keep theirs, as rope worked by hand
  feeds slack into one place and leaves the rest of the dressed knot as it was.
- **It goes round the fixed rope, not through it.** A drag moves the handle a little each frame, and the rope in play
  settles against the fixed rope and props after each step. A move that would cut through rope stops against it.
- **Only the rope in play is worked out** while you drag: the fixed rope's places go into a grid once, when the rope in
  play changes, so a step only checks what's near.

### Tightening

- **Tighten in play.** The same locked ends; every segment in play shortens by the same proportion, a little each
  step, while it settles, until it's jammed (it stops getting shorter) or you stop it. You see it draw up.
- **Tighten the knot.** The whole knot, as a separate action. The rope's ends and the top of the loop over the bar
  (the held segments, chosen in the panel and saved in the file) stay put; the knot's segments (also chosen and saved)
  shorten together; the rest slides freely. Free ends must be held, or the knot draws them in.
- **Smooth.** The rope in play settles as a stiffer rope for a while, to ease out a sharp bend, with nothing shortened.

### Segment boundaries

- **Redistribute** lays every boundary out again evenly along the rope as it is now (after a tightening, the segments
  that shortened are short). The numbers stay in order; each boundary moves to its even place.
- **Slide a boundary** along the rope, by dragging its marker or from the panel, so a segment covers just the stretch
  you want to move.

### Undo

Every edit (a whole drag, a whole tightening) is one step to undo and redo.

## The page

At `/knot-editor-3d`, like the 2D editor: on the live site but not linked or indexed, a desktop tool (covered by a
note on a narrow screen), its own layout in the `(editor)` route group.

- **The 3D view** fills the middle: the parts viewer's `SceneGL` (turn, zoom, pan, look from front, side, top), with
  X, Y and Z arrows in a corner. The rope is drawn in segments coloured by turns, each with its number written small
  along it; the segments in play are brighter, the rest dimmed; the locked ends are marked; the handle has its arrows.
- **Front, side and top views** beside it, drawn flat as the parts viewer draws them, to judge position.
- **The panel** shows what's chosen: the segments in play and their lengths, the handle's offset, nudge buttons,
  Tighten, Smooth, Stop, and the rope's settings (diameter, least bend, stiffness, held and knot segments).
- **A menu bar** for File (New from a knot drawing, Open, Save, Save As), Edit (Undo, Redo, Redistribute) and View.

## Files

Saved as the 2D editor saves: opened and saved on your computer with the browser's file access (Chrome and Edge), the
editor writing back to the file it opened, a dot in the title for unsaved changes, nothing written by the server. The
files live in the repo and are committed, so a change shows in its diff.

```json
{
  "format": "avut-knot-3d",
  "version": 1,
  "name": "Figure 8",
  "from": "figure-8-on-a-bight",
  "diameter": 0.011,
  "minBend": 0.011,
  "stiffness": 0.05,
  "props": [{ "id": 1, "kind": "bar", "at": [0, 0.17, 0], "along": [0, 0, 1], "r": 0.005 }],
  "rope": {
    "points": [[0.00688, -0.22, 0]],
    "segments": [8, 8, 7]
  },
  "held": [1, 27, 28, 54],
  "knot": [7, 8, 9]
}
```

- `from` names the knot drawing it was started from (a slug in `src/knots/`), for reference only.
- `rope.points` is the centreline in metres, rounded to 0.01 mm; `rope.segments` is how many points each segment
  has, in order, so segment numbers come from position in the list.
- `held` and `knot` are segment numbers, for Tighten the Knot.
- **Versions** as the 2D editor's (`src/knot-editor/versions.ts`): every file names its format and version, a
  change to the format bumps the version and comes with an upgrade, older files open through the upgrades, a newer
  file is refused, and a sample of each version is kept and opened by a test.
- **Read when imported.** Pages import the files and read them with the same checks, failing the build where one
  doesn't read.
- **Where they go:** `src/rigging/knots/<name>.json` for the flying fox's.

## Using the knots

The file holds one tightened knot. Each use draws it in its place, turned to the rope's pull, from the core (the
`knot` segments) and routes its own strands in and out:

- **On a bight round a carabiner:** the core as saved, the loop's two strands up to the carabiner's bar and round it,
  the standing part and tail out of the bottom.
- **Rethreaded, and the joining rope's figure 8:** the same core, with a strand's end coming back out of the core
  instead of the loop (and for the joining rope, in another colour).

How a use routes its strands (smooth curves from the core's ends, with the same rules against passing through rope)
is to be worked out when the first one's drawn; it may need the core to say where each strand comes in and leaves.

## How it's built

- `src/knot-editor-3d/`: the page, the state (a reducer holding the document, the selection and the undo history, as
  the 2D editor's), the file format, its versions and checks.
- `src/flying-fox/knot-tighten.ts` and `knot-edit.ts` move to a shared place (`src/lib/rope-3d/` or the editor's
  folder) and become the editor's engine: settling with points held, tightening chosen segments, the smooth curve
  through locked ends and a handle, redistributing and sliding boundaries. Each step works only on the rope in play,
  so it can run every frame.
- The engine has tests: rope keeps its length when only settling, can't pass through itself or a bar, a move leaves
  fixed rope exactly where it was, a tightening stops when jammed, and segment numbers survive every edit.
- `knot-3d.ts` keeps lifting a drawing into 3D and drawing numbered rope, for New from a knot drawing and for the
  view.

## Order of work

1. The engine: move the current code into its shared place, add the smooth curve through locked ends and a handle,
   firm up the least bend, and make each operation work on the rope in play alone; tests.
2. The file format, versions and checks, with the trial figure 8 saved as the first file.
3. The page: the 3D and flat views, numbered segments, choosing segments in play, New, Open and Save.
4. Moving: the handle, dragging and nudging, settling every frame, undo.
5. Tightening in play and of the knot, and smoothing, shown as they run, with Stop.
6. Segment boundaries: redistribute and slide.
7. Fix the figure 8's last twist with it, and draw it on the flying fox's trolley.

## Later

- **An assembly editor** for the parts viewer: adjust the position and rotation of connected items (a carabiner in a
  trolley's hole, a knot on a carabiner) and save the adjustments, by item name, to files the same way, for the code
  that builds the parts to read. Connected items follow what they're joined to, and a connection limits how far its
  item can move (a carabiner through two plates can only slide and swing in its hole). It can share this editor's
  3D view, selection and handles. See "The assembly editor" below.

## The assembly editor (later)

For fiddling by hand with the small parts and how they're joined, not the ropes and hawsers, which stay worked out in
code. The first case is the rigged trolley, whose joins are now numbers in `rigTrolley` and `trolley` in
`src/flying-fox/fox.ts`: how far each carabiner hangs in its hole, the gates' directions, the grigri's height over the
tie-in, the safety clip's offset.

- **Parts name their attachment points.** A builder returns named frames (a point and its directions, as hardware's
  `Frame`) instead of loose points: the trolley's `main-hole` and `tow-hole`, a carabiner's `top-bar` and
  `bottom-bar`, the grigri's `hole`.
- **Each join is named** (`trolley/rider-clip`: the rider's carabiner's top bar in the trolley's main hole). It
  places the child's point in the parent's frame, and says how the child may move there: swing about the hole's axis,
  slide along it.
- **Files hold only adjustments** to the code's own layout: a small offset and turn for each join, by name, in a
  versioned file (`assemblies/trolley.json`, say). A join the file leaves out isn't adjusted; a name the code doesn't
  know fails the build, as `knot3dFile` does. The code keeps the structure.
- **What's worked out follows the adjusted parts.** Ropes and knots start from the adjusted points (the figure 8 and
  the dropper from the rider clip's bottom bar), and anything derived from a part's placement is worked out from where
  it ends up, not where the code first put it: the return line's layout depends on how its carabiner's turned.
- **A join's free axis is shown, not edited.** The editor draws it and can swing the part about it to check it (a
  slider standing in for the run's swing); the axis itself stays in code, and the run reads it from there.
- **The editor** is the parts viewer with a panel for the picked item's join: number fields or a handle that moves only
  as the join allows, the swing preview, and Save through the browser's file access, as this editor saves.
- **A first slice:** the rigged trolley's joins (the rider's clip, the back-up clip, the grigri's carabiner, the safety
  clip, the return line's knot on its carabiner) in `/parts`, to try the file before anything else uses it.

Bear it in mind when tidying the scene code: builders that return named frames, and placements kept apart from the
pieces drawn, make this easier later.

- More props than the bar, and knots of two ropes (the joining 8 in two colours).
- Keeping the doubled strands paired: each point and its partner on the other leg held touching and not rolling round
  each other, as the 2D editor's linked pins hold strands side by side. That might stop the twists forming at all.

## Open questions

- **The least bend and stiffness:** what looks like real 11 mm kernmantle rope? Start at one diameter and tune
  against the photos in `~/AVUT/parts/figure-8_*.jpg`.
- **Should the editor show the photos** beside the 3D view, from matching angles, to compare against?
- **Route and naming:** `/knot-editor-3d`, or a 3D mode in the existing editor?

## Built

- **Where things are:** the engine is `src/lib/rope-3d/` (`rope.ts`, `sim.ts`, `curve.ts`, `operations.ts`), replacing
  `knot-tighten.ts` and `knot-edit.ts`; the editor is `src/knot-editor-3d/`; the trial figure 8 is
  `src/rigging/knots/figure-8.json`, which the parts viewer's trial part now reads. The flat views are shared
  with the parts viewer (`src/parts/flat-view.tsx`), and `SceneGL` takes children, so the editor draws the live rope,
  its handle and the locked ends inside the parts viewer's 3D view.
- **The handle** is the middle of its segment's points (`segmentMiddle`), not its middle by length: the handle's
  segment has as many points each side of it, spaced differently once one side grows more than the other, and the
  middle by points is the point the move steers.
- **A move** sends the handle at most a sixth of a diameter a step towards the goal, and never more than a diameter and
  a half ahead of where it is, so it stops against rope in its way. A move's done once neither the sent point nor the
  handle has moved a tenth of a millimetre a step for 15 steps. The rope's stiffness is off while it moves: the
  wanted shape gives it its shape.
- **Only the handle's segment changes length.** The other segments in play keep their pieces' lengths exactly, and
  each step move only by as much as their wanted places move (measured from the locked ends), not drawn onto them:
  where rope's in the way, they stay where it pushed them rather than stretching to reach. Drawn onto their wanted
  places, a move into a tight part of the figure 8 stretched them by a tenth. The handle's segment has no length of
  its own in the simulation: its points go halfway to evenly spaced wanted places each step (at most a quarter of a
  diameter), and it's laid out again by its length as it grows or shrinks, so its pieces stay short enough not to
  straddle a bar or a strand. A move that would leave it less than half a point's spacing either side of the handle
  goes no further. With its length free, a handle pulled past a bar can go round it as a bight beside it, as real
  rope can.
- **The rope in play keeps its shape and moves as the curve does.** Its wanted shape is its shape when the handle
  was chosen, plus how far the curve through the handle has moved from the curve through where the handle was
  then. Laying it straight onto the curve made a stretch snap to the curve's shape at the first nudge, losing the
  bends it had. The two agree at the locked ends and the handle.
- **Existing overlaps are kept, not fixed.** The trial figure 8 has strands pressed up to 2.5 mm into each other (it
  was tightened before these rules). Each simulation lets pairs already closer than a diameter stay as close as they
  are, but no closer; pushed apart at once, they kinked the rope.
- **The rope's end** in play is locked like any other end: a stretch running to the rope's end holds that end where it
  is.
- **Least bend** is saved per file in metres. The trial figure 8 was tightened at half a diameter, so its file says
  5.5 mm; one diameter (the start suggested above) would loosen it wherever it's edited. That's still open.
- **Stiffness** now straightens once a step, not on every pass over the constraints, so a rope settling keeps its
  length.
- **Held and knot segments** for the trial figure 8: held 1, 27–28 (the loop's top over the bar) and 54; knot 7–23 and
  34–50. Both are set in the panel.
- **Not built:** dragging a segment boundary's marker (boundaries slide from the panel), the photos beside the view,
  and knots of two ropes (New from a knot drawing takes a drawing's first rope and its bars only).

## Rework: pins and staged tightening

Planned 2026-11-27, from tying the munter hitch and two half hitches in the editor and in code. What went wrong:

- **Smoothing made the rope lumpy, and moving a segment made a mess.** The rope is a run of points the simulation
  moves, so every edit reshapes it point by point, and nothing keeps it a smooth curve.
- **The carabiner is a straight bar** (the bar across its bottom end). Tightening the munter drew the rope off its end.
- **Tightening runs all at once**, too fast to watch, and the whole munter drawn up together passes rope through rope
  or jams so tight the half hitches disappear. Tightened in code, it only worked in stages: the munter first, a
  little, holding the bight; then the hitches; the standing end held straight throughout.
- **"Tightening the knot" can't be worked out from the page.** It builds its held and knot lists one run in play at a
  time, doesn't show which segments are in them, and its button is somewhere else.
- **Only registered knots can be started from.** A drawing saved in the 2D editor has to be added to `KNOTS` first.
- **Its segments aren't the drawing's.** They're cut every 20 mm, so "hold the bight" has to be found again by number.

### The rope: pins and segments

- **As the 2D editor's:** a rope is a run of pins, and a segment is one cubic Bézier between two pins. A pin has a
  position in 3D and may have a direction; where it has none, its direction comes from its neighbours, as the 2D
  editor's Hobby directions do. A segment has a tension at each end (1 by default), and can be locked to a length.
  The rope is smooth by construction, so there's no Smooth.
- **Its diameter, least bend and stiffness** are the file's, as now. The simulation (tightening, Settle) works on
  points sampled from the curves about a quarter of a diameter apart, and the result is fitted back to pins (below).
- **From a drawing,** every pin and segment carries over with its number, so segment 19 in the 3D editor is segment
  19 in the drawing. Heights come from `liftKnot`. Where one Bézier between a segment's pins can't give the heights
  the lift gives it (a segment crossing over one strand and under another), pins are added at its crossings, and the
  pieces keep the drawn number with a letter (19a, 19b). Segments are chosen, painted and named by these numbers.
- **Doubled strands:** the 2D editor's linked pins (a pin held beside another, a gap apart, on one side) carry over
  later, to keep a figure 8's doubled strands paired instead of twisting round each other.

### Editing

- **Click a pin** to pick it. It has X, Y and Z arrows to drag, and nudges from the panel and keys as now (1 mm, 5 mm
  with shift). The two segments either side follow; locked segments keep their length, as in the 2D editor.
- **A pin's direction** is set by dragging its handle, or cleared to come from its neighbours. **A segment's
  tensions** are set in the panel.
- **Add a pin** in a segment (the pieces keep its number with a letter), or **remove one** (its two segments join).
- **Edits don't push rope out of the way.** A drag moves the curve where you put it, and the page warns about what's
  wrong instead (as the 2D editor does):
  - rope pressed into rope, or into the carabiner, more than a tolerance, marked where it is;
  - a bend tighter than the least bend;
  - a drag that took rope through rope or through the carabiner (watched frame to frame, as tightening is);
  - while the knot still lies near the drawing's plane, crossings that aren't the drawing's.
- **Settle** runs the simulation a short while with nothing shortened, to push overlaps apart, and fits the result
  back to pins.

### The carabiner

- **A carabiner prop** is the closed loop of its rod's middle line, as `middleLoop` in `src/knots/carabiner.tsx`
  draws it, in the drawing's plane, with the rod's radius. The rope can't slide off it as off a bar. Straight bars
  stay for knots tied round a bar.
- The rope's times through the carabiner, counted each way, are watched in every edit: with the ends held they can
  only change by going through the rod.

### New from a drawing file

File gains "New from a drawing file", which opens any file the 2D editor saves (its first rope, its bars and
carabiners), as well as the list of registered knots.

### Tightening in stages

- **Tighten mode** replaces "Tightening the knot" and tightening in play. In it, you paint segments in the 3D view with
  brushes, each its own colour, with a key in the panel:
  - **Shorten:** draws up, a little each step.
  - **Hold:** stays where it is.
  - **Hold straight:** stays on the line it lies along now, its far end held, and can slide along that line into the
    knot, as a loaded standing end does.
  - **Slides** (the eraser): moves freely.
- **The rope's two end segments are held** to start with, so the knot doesn't draw them in.
- **Run it:** Step (a few simulation steps), Run, and Stop, with "until it's this much shorter" (a percentage of the
  painted rope's length when the run started) and a live readout of how much shorter it is. It also stops when the
  painted rope stops getting shorter (jammed).
- **It's watched as it runs,** and stops the step before rope passes through rope or through the carabiner, saying
  where. Crossings seen from the drawing's side aren't checked while it tightens: a tightened knot's strands come to
  lie over each other without anything passing through.
- **Stages:** each run is a stage, listed in the panel with its painting and how far it went (the munter to 15%, then
  the hitches to 30%), and is one step to undo. The list is saved with the knot, so a good sequence can be run again
  from the untightened knot.
- **Afterwards the rope is fitted back to pins.** A pin is a point of the rope itself, so it goes where its point of
  rope ended up; each segment's Bézier is fitted to the shape its rope settled into (ends at its pins, directions from
  the settled rope, tensions by least squares). The panel says how far the fit strays from the settled rope, and marks
  segments that stray more than a quarter of a diameter, where adding a pin would help.

### Files

A new version of the file, with an upgrade from the old: the old version's points become pins at its segment
boundaries, each segment fitted as above.

```json
{
  "format": "avut-knot-3d",
  "version": 2,
  "name": "Munter hitch and two half hitches",
  "from": "munter-and-two-half-hitches",
  "diameter": 0.011,
  "minBend": 0.011,
  "stiffness": 0.05,
  "props": [{ "id": 1, "kind": "carabiner", "loop": [[0.01, -0.04, 0]], "r": 0.0055 }],
  "rope": {
    "pins": [
      { "id": 1, "at": [0, -0.2, 0] },
      { "id": 2, "at": [0.01, -0.06, 0.004], "along": [0, 1, 0] }
    ],
    "segments": [{ "id": 19, "name": "19", "tension": [1, 1] }]
  },
  "stages": [
    { "shorten": ["20", "21", "22"], "hold": ["77", "67"], "straight": ["19"], "until": 0.15 }
  ]
}
```

`from` names the drawing, by its file name when it isn't a registered knot. `held` and `knot` go, replaced by
`stages`.

### Order of work

1. Pins and segments in 3D: the curves (directions where a pin has none, tensions, locked lengths), sampling them for
   the simulation, and fitting a settled rope back to pins; tests (a fitted curve matches what it's fitted to, segment
   numbers survive).
2. The file's new version and the upgrade from the old; the trial figure 8 and the munter hitch opened through it.
3. The carabiner prop, and New from a drawing file, with the drawing's pins and numbers and pins added at crossings.
4. Editing: picking and dragging pins, directions, tensions, adding and removing pins, the warnings, Settle.
5. Tighten mode: the brushes, Step, Run and Stop, the watch, stages and their list.
6. Tie the munter and two half hitches with it, and save it to `src/rigging/knots/`.

### Still open

- **Directions in 3D** where a pin has none: Hobby's method is for curves in a plane. Something like it in 3D (the
  direction from the neighbours, with Hobby's handle lengths from the angles turned) needs trying on the drawings.
- **How long a run of steps** Step is, and how fast Run goes, to be watchable on the munter.

### Built (2026-11-27)

- **Where things are:** the rope of pins and segments is `src/lib/rope-3d/pinned.ts` (3D Hobby directions, sampling,
  fitting back, splitting a segment, removing a pin), a stage is `stage.ts` (`StageRun`), the watch for passing
  through is `watch.ts`, and the warnings `checks.ts`. The old point-by-point engine (`operations.ts`, `curve.ts`:
  moves through the simulation, Smooth, sliding boundaries) is gone, and so is `src/rigging/knot-tighten.ts`, the
  scripted staged tightening, with its trial munter file.
- **Directions in 3D:** each pin's plane is the one its two chords lie in, the planes' normals kept facing the same way
  along the run, and Hobby's equations solved on the angles in them. A run lying in one plane gives exactly the 2D
  editor's directions (tested), so a drawing comes in as drawn.
- **From a drawing:** a pin at each crossing and pass more than half a diameter from its segment's ends; every drawing
  in `src/knots/files` keeps its crossings (tested). The crossing check counted a crossing at a point where two
  pieces meet as no crossing; it now counts it once.
- **Fitting back:** a pin's direction is the way the rope runs across its point; a held segment isn't fitted again but
  kept as it was, its pins holding the ways they ran, so held rope comes through a stage exactly. Elsewhere a segment
  that strays more than a twentieth of a diameter gets a pin at its middle, down to runs of three points.
- **Old files** (version 1) are fitted at a tenth of a millimetre: the committed knots come out within 0.13–0.45 mm
  of their old points (the rest is the old points' own corners), with 44 to 134 pins. Pages read a file's rope with
  `knotRope`, sampled a quarter of a diameter apart.
- **Stages** name their segments by id, not name, in the file. A stage that's kept is listed; the painting itself
  lives in the editor, not the file, until a stage is kept. Pieces a kept stage split a segment into are painted as it
  was.
- **Settle** runs 150 steps with only the end segments held. **Step** runs 25.
- **Not built yet:** running the saved stages again from the untightened knot; dragging a pin's direction (it's held
  or freed, and turned 5° at a time about X, Y or Z, from the panel); locked segment lengths; linked pins.
