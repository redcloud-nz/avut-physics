# Towards a pulley system builder

**Date:** 2026-11-10

Exploring a visualiser where people build their own pulley systems, starting from what the visual introduction and
Part 2 of the Gentle Introduction already have. The prototype is at `/pulley-lab` (not on the home page): a list of
systems, a haul slider and a pulley efficiency slider.

## What we have

`src/articles/pulley-systems.ts` describes a system as bodies (anchor, load, pulleys, grabs, the haul end) and ropes
(the bodies each runs between, in order). Everything lies on one line. The solver is already general:

- `hauled` finds how everything moves from one equation per rope (its length stays the same).
- `pullsOf` finds the tensions: friction from which way the rope runs through each pulley, then each free body's
  balance. Nothing in it is specific to a system.

Trying it on harder systems showed it needs **no changes** for:

- **Double pulleys**: a pulley named more than once in a rope's path is a block with a sheave for each time.
  `FIVE_TO_ONE_DOUBLES` is the 5:1 as it's actually rigged, on two doubles, and tests show it matches the four-single
  version with friction.
- **Beckets**: a pulley at either end of a path has the rope tied to its becket.
- **Compound systems** of any depth: `NINE_TO_ONE`, a 3:1 on a 3:1 (tests: 9:1, and (1 + e + e²)² with friction).
- **Complex systems**: `COMPLEX_FIVE_TO_ONE`, where a second rope holds the main line's free pulley. Tensions 1T and
  2T add to 5T rather than multiply, and counting parts on the load gets it wrong (3).

So the physics isn't the obstacle. Two things are: **layout** and **authoring**.

## What's in the way

Every system is laid out by hand. Each rope part has a `lane` (its height in the flat drawing), each pulley and grab an
`x`, and each grab a `y` that must equal the lane of the rope it rides on. Get one wrong and the drawing is wrong
while the maths is right. A builder can't ask people for lanes.

The drawing also assumes a lot: one wheel per pulley (fixed in the prototype), slings drawn from a pulley's centre
(so travelling pulleys' slings slant across to their grab), labels sitting on the rope where the half-metre marks
are.

## The route

### 1. Derive the layout

Make lanes, grab heights and most positions computed rather than written:

- **Lanes**: each rope's parts in order, one after another, 28 apart. That's already how every hand-written system is
  numbered, except where a part's order was changed to keep the haul end outside the anchor or a tie from crossing a
  rope (the complex 5:1). A small search over rope orders and directions, scoring crossings, should cover those.
- **Grabs** name what they ride on, `rides: "0.0"` (rope 0, part 0), instead of a `y`.
- **Positions**: anchor pulleys at 0.9 m, pulleys on the load just short of it, grabs a set distance down the part
  they ride on, free pulleys halfway along their ropes. Then the haul slider's limit comes from the layout: the
  distance hauled when two bodies on neighbouring lanes first meet (the reset point), rather than a hand-set `max`.

Once systems are written as topology only, the existing ones get shorter and new ones cost a few lines.

### 2. Build by operations, not free drawing

Rather than placing pulleys and threading rope freely, let people apply operations to what's on screen:

- start with the load and anchor: a 1:1, a 2:1, a 3:1 Z-rig, or an N:1 on doubles;
- tap a rope part: **add a redirect** at the anchor, **put a 2:1 / 3:1 on it** (a grab, and a new system pulling on
  it: compound), **hold this pulley with a 2:1** (complex);
- tap a pulley: **swap for a double**, **set its efficiency** (a carabiner, a plain pulley, a ball-bearing one);
- undo.

Every operation keeps the system valid, so there's never "this doesn't move" to explain. The state is a short list of
operations, which fits in a URL for sharing a system. The T method steps (`TSteps`) can be generated from the same
structure: start at the haul end, carry each tension across pulleys, sum at each sling.

Tapping is the only way in, for mouse and touch alike; dragging parts onto the drawing can wait. What can be tapped
(rope parts, pulleys) and the operations each offers are buttons, so the builder works from a keyboard and with a
screen reader too.

Tests: every preset can be built from the operations, and every operation offered on every preset gives a system the
solver can solve. The second is what keeps "every operation keeps the system valid" true as operations are added.

Readouts beside the drawing, for what a team checks on a real system:

- the mechanical advantage, ideal and with friction, side by side;
- the load on each rope grab (a grab is a fixed clamp on its rope: it never slips);
- the anchor's load;
- how far the load moves for each metre of rope the team pulls in.

### 3. Free threading, later, maybe

Placing blocks and clicking sheaves in order to thread a rope is closer to rigging, but it needs validation the
operations don't: the solver already throws when the rope equations don't have one answer, and those would need
turning into plain reasons ("this rope has nothing moving on it", "two pulleys fight each other").

## Better drawings

Done in the prototype:

- **Double pulleys** drawn as one block, its sheaves in a side plate with one sling.
- **Beckets** drawn as a ring with a short tie to the block, and a tie from a grab to a rope tied to it.

Worth doing next, roughly in order of how much they'd help:

1. **Slings in line**: lay out a travelling pulley's lanes beside its grab's lane so its sling runs straight, not
   slanted across the rope (the 6:1 and 9:1 both show this).
2. **Labels off the rope**: a background halo behind tension labels, or put them beside the rope, so they don't
   collide with the half-metre marks.
3. **A colour per rope**, so in a compound or complex system you can see which rope is which.
4. **Progress capture**: a ratchet on the anchor pulley (a PCD or prusik-minding pulley), shown holding when the team
   lets go. It changes what the anchor holds at rest, which is a point worth making.
5. **Efficiency per pulley**, not one for all. `pullsOf` takes a single efficiency now; per body is a small change, and
   lets a carabiner redirect sit beside ball-bearing pulleys.
6. **Rope leaving the sheave on its tangent** rather than lanes meeting at the wheel, for drawings closer to real
   rigging.

## Out of scope

Everything stays on one line. Real systems have angles (a redirect off to the side, a haul line not parallel), where
the advantage depends on them. That's a different model, closer to the multi-point anchor's, and better as its own
visualisation than folded into this one.

## Questions

- Where does the builder live: a visualisation of its own, or a page in the visual introduction (which would need it to
  work in the series' phone frame)?
- Upright (as the visual introduction draws) or flat (as Part 2 does)? The prototype uses upright.
- Swap the 5:1 page in the visual introduction to double pulleys? It's how it's rigged, but drawing it as four singles
  makes the counting easier to follow.
