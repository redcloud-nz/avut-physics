# Parts, assemblies and interactions

A design for reworking the parts viewer (`/parts`, `src/parts/`) and the way scenes build from parts, so that scenes
stop drifting from how gear really fits together. Talked through in November 2026.

Built so far: the first two interactions, checked on the abseil tower (`src/rigging/interactions.ts`, its tests in
`src/abseil-tower/interactions.test.ts`): a carabiner on a sling and a figure 8's loop on a carabiner. The carabiner and
the basketed sling give their features (`carabinerWith`, `basketedSlingWith`), and `layoutRig` lists the tower's
connections. The rest is still to do.

## Why

The parts catalogue (`src/parts/catalogue.ts`) is one flat list, `PARTS`, holding three different kinds of thing:

- single pieces of gear: `carabiner`, `bow-shackle`, `round-sling`;
- fixed groups of them: `fox-chain-weight`, `fox-tower`;
- one frozen instance of how two things meet, cut out of a scene: `tower-f8ob-sling` (a figure 8 on a bight on its
  sling's carabiner), `tower-munter`.

The third kind is the problem. A carabiner can be clipped to a sling, have a rope bearing on its wide end and sit in a
pulley's becket at the same time. Each of those is a relation between two parts, not a group, and cutting one out of a
scene shows only how it happens to be drawn there. Nothing says how it should be, so nothing notices when a scene edit
moves the rope off the carabiner or the carabiner through the beam.

Some entries are one part repeated to show a movement or option: `fox-chain-weight`, `-mid` and `-full` are the chain
weight at three heights; `carabiner` and `carabiner-oval` are one carabiner in two shapes.

## The three kinds

1. **Parts**: a single piece of gear (a carabiner, a shackle, a sling, a grigri).
2. **Assemblies**: parts fixed relative to each other (the chain weight on its shackle, the flying fox's tower). An
   assembly is the same type as a part: it has options, movements, features and views like any part, and the viewer
   treats the two alike.
3. **Interactions**: a specification of how a feature of one part meets a feature of another (a rope over a bend, a pin
   through an eye, a carabiner clipped through a sling). An interaction isn't something drawn on its own: a scene tags
   the connection between two parts with one, and a checker verifies the scene meets it.

Parts and assemblies go into scenes. Interactions describe the connections between them.

## Parts and assemblies

A part is a function of its settings, rather than a fixed list of pieces.

```
Part (or assembly)
  options         discrete, chosen once per use: toggles in the viewer
  movements       continuous, can change in use: sliders in the viewer
  features(state) named geometry that interactions refer to
  pieces(state)   the 3D pieces
  views[]         its 2D views (below)
```

- **Options**: the carabiner's shape (D or oval), whether it locks, a sling's length, a shackle's bow or D.
- **Movements**: the gate opening, the grigri's handle turning, the chain weight lifting. Internal movements of the part
  only; how the part moves against others belongs to an interaction.
- **Features**: what interactions point at. A carabiner has its wide bend, narrow bend, spine and gate; a shackle its
  bow, pin and ears; a pulley its sheave's groove and the side plates' hole; a knot its loop's inside and its tails.
  Features follow the settings: when the gate opens, the gate feature moves with it.

Knots are assemblies with features of their own, so "the figure 8's loop round the carabiner's wide bend" is an
ordinary interaction between two features.

## Interactions

```
Interaction
  kind             rope over a bend, pin through an eye, clipped through, ...
  features         one on each part
  allowed movement what can still turn or slide (a carabiner swings on its sling; rope runs round a sheave)
  tolerances       how close is close enough
```

Each kind is checked mechanically, for example:

- **Rope over a bend**: along the contact, the rope's centreline stays the rope's radius plus the bar's from the bend's
  centreline, and doesn't pass inside it.
- **Pin through an eye**: the pin's axis passes through the eye, with clearance and no overlap.
- **Clipped through**: the sling's loop passes inside the carabiner's closed outline, and the gate isn't loaded.
  An open gate fails it, which is right.

Some checks teach something real as well as catching drawing mistakes: cross-loading a carabiner, or loading its gate.

The specs are plain data, readable by people and agents, so they can guide placement now (whoever writes a scene reads
them) even though only checking is built at first.

### Arrangements

Where a part goes on a carabiner depends on the arrangement the carabiner is in, not only on the two parts, so each
connection names its arrangement as well as its kind. On the CT D, the top of the traced shape is its wide end and the
bottom its narrow end.

- **Anchor** (sling, carabiner, figure 8 on a bight): the sling on the narrow end, the knot on the wide end, the two
  pulling opposite ways along the carabiner.
- **Rope's end** (figure 8 on a bight, carabiner): the knot on the narrow end, nothing on the other.

## Checking: first, and as tests

Checking comes first; placing a part from its interactions (as CAD mates do) can come later, and the specs should be
written so that it can.

The aim is to stop drift, which happens when an edit changes a scene and nothing notices. So the main guard is a test:
each scene exports its tagged connections, and one Vitest file runs the checker over every scene as part of `npm
test`. The viewer can show the same results (a connection drawn red when it fails), which helps see why a check fails,
but it isn't the guard.

## 2D views

A part or assembly has one or more named 2D views, each with:

- **how it's seen**: the direction (azimuth and elevation, as `PartFlat` has now);
- **a note** on when to use it. The flying fox's tower has a fixed side view and a fixed top view. A carabiner has a
  view with its gate on the left and one with it on the right;
- **which options it suits**;
- **how it's drawn**: projected or drawn (below);
- **how it may squash**, if at all (below).

Gate left and gate right may not need to be an option. If the carabiner is the same apart from which side it's seen
from, the views differ rather than the part.

### Projected or drawn

Most views can be projected from the 3D pieces, with the posing and flat-view treatment they have now. Projection keeps
the 2D and 3D from drifting apart.

Some can't usefully be projected: it gives layers of pieces far more complex than the drawing needs. The slings round
the abseil tower's overhead beam draw in 2D as two parallelograms, with the carabiner drawn under the end. So a view may
be drawn instead: its own 2D shapes, plus the 2D positions of the features its interactions use (where the sling's end
is, where the carabiner hangs), so connections can still be checked in the drawing.

An assembly's drawn view can stand in for its parts' own views, as the beam's slings do.

### Squashing

Some views may squash in one direction. A sling's view can stretch along its length to show how long it is, or
foreshorten to suggest it runs out of the page. A view that allows this says:

- **the direction** it squashes in;
- **what stretches**: the sling's straight middle, while its round ends keep their shape (as a 9-slice image scales),
  so a squashed sling still meets its carabiner properly;
- **what a squash means**: its length in the drawing, or its tilt out of the page;
- **its limits**.

### Overlay

Interactions decide how parts overlay each other in the flat views. Where two parts meet, the interaction knows which
passes in front for a given view: a rope round a carabiner's bend is in front of the bar on the near side and behind it
on the far side; a carabiner clipped through a sling's end is in front of one side of the sling and behind the other.
So the overlay is set where parts meet, not by ordering whole parts, and a drawn view (the beam's slings with the
carabiner under the end) takes its order from the same interaction.

### Checking the 2D views

The visual fudges in the flat views can't be checked, but a fudge that changes the geometry can, where something else
makes up for it. A carabiner laid face on is longer across the page than it is at its true angle, so the sling or the
rope's loop on it is drawn a little shorter to make up. What can be checked is that, in each view's projected drawing,
every connection still meets: the loop touches the bar, and the rope goes on from where it should. It's the same
contact check, in 2D.

## In the viewer

- Parts and assemblies: options as toggles, movements as sliders, and a choice of their 2D views, each with its note.
- Interactions: a page per kind, showing two stand-in parts in that relation, with a slider through the movement it
  allows and the checker's result drawn on.

## Open questions

- Which connections in the tower and the flying fox go wrong most often? They'd make the first set of interaction kinds.
- How a drawn view's features are kept in step with the 3D part's, so the drawing can't drift either.
- How an interaction's overlay sits alongside the flat views' sorting now (by groups and shell): whether it replaces
  that sorting where parts meet, or only orders parts the sorting leaves tied.
- Where the parts and their features live: alongside the builders in `src/rigging/`, or in `src/parts/` wrapping them.
