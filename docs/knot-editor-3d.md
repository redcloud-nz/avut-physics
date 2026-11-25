# 3D knot editor: design

**Status (2026-11-25):** built, at `/knot-editor-3d`, on branch `knot-editor-3d`. The figure 8's twist is fixed
(`src/flying-fox/knots/figure-8.json`), and it's drawn on the flying fox's trolleys, tying the dropper into the rider's
carabiner. Its other uses (the rethreaded 8s, the joining rope's) still stand in as turns round a bar. What changed from the design below as it was built is under Built.

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
- **Where they go:** `src/flying-fox/knots/<name>.json` for the flying fox's.

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
  `src/flying-fox/knots/figure-8.json`, which the parts viewer's trial part now reads. The flat views are shared
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
