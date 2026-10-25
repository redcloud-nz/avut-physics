# Knot editor: a new editor for knots and their tying steps, saved to files on your computer

**Date:** 2026-10-25
**Branch:** `feat/knots` (worktree `.claude/worktrees/knots`)
**Written against:** feat/knots @ 17f014b
**Spec:** `docs/knot-editor.md` (the design), with `docs/rope-editor.md` (what's wrong with the old editor)
**Scope:** all five review groups are to be built now. Porting the existing knots, the knot pages reading the new
files, and props beyond the bar come after, once the editor has proved itself.

## Decisions

### What it is

- **It's a new thing, beside the old one.** New code goes in `src/knot-editor/`, with its curve maths in `src/lib/`.
  It doesn't import `pinned-rope.ts`, `rope-editor.tsx`, `rope-edits.ts` or `editable.ts`, and nothing in
  `src/knots/` changes except where a task says so. The old editor at `/knots/edit`, its save route and the knots'
  JSON files stay as they are. The pieces shared: `RopePath` and `crossings()` from `rope-path.ts` (the tests'
  check), `Bar` and `BarDrawing` from `bar.tsx`, and `RopeDrawing`'s pieces (see Drawing).
- **Dev only.** `/knot-editor` calls `notFound()` outside development, as `/knots/edit` does, and has
  `robots: { index: false }`. It's a desktop tool: the rule that every page works at phone width doesn't apply to
  it, and this plan says so rather than building a phone layout.
- **Units and directions** as in the existing knots: rope diameters, y down as in SVG, angles in degrees for the file
  and the panel.

### Strands: ropes and arrows

- **A picture's ropes and arrows are both strands,** in one `strands` list, each with a `kind`: `"rope"` or
  `"arrow"`. Both are built the same way (pins, segments, curves, tensions, locked lengths) and edited with the same
  tools. Where any two strands cross, a crossing entry says which is on top, so an arrow can go over one strand and
  under the next. This replaces the old arrows' `front` and `frontTo`.
- **An arrow** is drawn as a thin shaft with a head at its last pin, and gets no bend warning and no tape.
- **A rope has a `colour`,** always written in the file: one of a fixed set of names (`orange`, `green`, and a few
  more). It's never worked out from the rope's place in the list, so adding, deleting or reordering ropes never
  changes another rope's colour. When the editor adds a rope (New, Insert > Rope), it picks the first colour not
  already used in the picture and writes it in, so the first is orange and the second green, as on the knot pages.
  A rope may also have a `name` for the panel.

### Curves

- **Curves are drawn, not solved.** Each segment between two pins is one cubic Bézier. Pins may hold an angle; runs of
  pins without one get their directions from Hobby's method (one tridiagonal solve per run, with curl 1 at a free
  end of the strand). Each segment has a tension at each end, default 1, kept within 0.75 (MetaPost's least, below
  which curves loop) and 4. There's no physics in the curves; the 1.75 bend warning is the only check that they look
  like rope. This replaces the old editor's Newton solve, which caused all three problems in `docs/rope-editor.md`.
- **Tensions don't enter the direction solve.** Hobby's directions are solved as if every tension were 1, so the
  directions at the pins depend only on where the pins are and which angles they hold. A segment's tensions shape
  only its own control points. So changing one segment's tension or locked length changes that segment alone, the
  length search for a locked segment involves only that segment, and the cache in Task 3 only has to follow pins.
- **Lengths follow the curve unless locked.** A segment's `tension` pair is always the shape you gave it. A locked
  segment also stores its `length`: the editor scales both of its tensions by one factor, keeping their ratio, until
  the curve has that length (bisection on the factor; the length grows as the tensions fall, and stays flat for a
  straight segment). The scaled tensions are what's drawn and shown, read-only, in the panel; the handles don't drag
  while locked. The reach is from the curve with the tensions scaled up to 4 to the one with them down to 0.75. Outside
  it the segment is drawn at the nearer end of its reach, shown red, and the panel says too short or too long, and by
  how much against that reach.
  - **Lock** keeps the tensions as they are, as the ratio, and the current length, so nothing moves.
  - **Unlock** writes the scaled tensions into `tension`, so nothing moves.
  - **Shifting** at a pin changes the lengths of the two locked segments either side by +Δ and −Δ, and is only
    offered when both are locked.
  - **Adding a pin** on a segment at t gives the new pin the curve's direction there as its held angle, so the Hobby
    run around it doesn't move. The two halves take their tensions from the curve split at t (de Casteljau), clamped
    to 0.75–4, so the shape stays put unless a clamp bites. A locked segment's halves are both locked, at the
    curve's lengths up to and after the new pin. The angle can be cleared afterwards like any other.
  - **Deleting a pin** between two locked segments locks the joined one at the sum of their lengths; if either was
    unlocked, the joined one is unlocked.

### Crossings

- **Crossings are tied to segments, not distances along the strand.** An entry says which segment is over which, by
  `[strand, segment]`. Over and under are always chosen by hand, as with the existing knots.
  - **The pair.** A crossing belongs to the pair of segments, taken in order: the lower `[strand, segment]` first,
    whichever is on top. Where the pair crosses more than once, `n` (from 1) counts the crossings along that first
    segment, so two entries for one pair can never both be `n: 1`. Two neighbouring segments of a strand meet at
    their shared pin; that meeting isn't a crossing.
  - **Matching.** Each crossing the geometry finds is matched to the entry for its pair and `n`. One with no entry
    is "unset" and drawn with a marker. An entry with no crossing is "lost" and listed, never dropped. When the
    number of crossings between a pair differs from the number of its entries, every entry for that pair is shown as
    "to check", still drawn as it says, instead of being matched again by `n`, since `n` no longer reliably names
    the same crossing.
  - **Adding a pin** splits a segment at t. Entries on it go to the half their crossing lies in, found from the
    geometry, and are counted again along the new pair's first segment. Entries naming later segments of that
    strand move up by one.
  - **Deleting a pin** joins two segments. Their entries move to the joined one and are counted again along each
    pair's first segment. Entries naming later segments of that strand move down by one. An entry between the two
    joined segments themselves, which would now name one segment crossing itself, becomes "to check".
  - **Deleting a strand** removes its entries and moves later strands' numbers down by one.
  - **Numbering.** References are counted from 0 in the file and from 1 on screen ("Segment 4", "Pin 5"), as pins
    are in the old editor.

### Props

- **A picture's props are a list, each of a kind,** with that kind's own fields. Each kind is kept in one file in
  `src/knot-editor/props/` (for the bar, `props/bar.tsx`): its type and checks, where strands pass across it, its
  drawing, and its fields in the panel. A registry (`props/index.ts`) lists the kinds, so adding one touches no
  other code. Tasks 2, 3, 9 and 13 each add their part to it.
- **Layering.** A prop is drawn behind every strand unless strands pass both in front of it and behind it. Such a prop
  is drawn over the strands' whole length but under their over stretches.
- **Every pass is recorded, with its side,** as crossings are, so `n` keeps its meaning. A prop with passes lists
  them in `passes`, each `[strand, segment, n, "front" | "behind"]`, with `n` counting that segment's passes across
  it. A pass with no entry is "unset": drawn behind, with a marker. When a segment's number of passes differs from
  its entries, all its entries for that prop are "to check"; an entry with no pass is "lost". Passes are renumbered
  on adding and deleting pins and strands as crossings are.
- **A pass in front is an over stretch.** `strandPaths` marks each front pass over, along the part of the curve the
  registry gives (for the side-on bar, where the curve is within the bar's radius plus a margin of its middle line),
  so the prop drawn between the layers is covered there. These stretches follow the same clipping and merging rules
  as crossings' stretches.
- **This plan builds one kind, the bar:** end on (`x`, `y`, `r`, drawn behind, no passes) or side on (with a `length`,
  and `passes`). The kinds talked about for later: a carabiner and a ring (passes in front and behind, like the
  side-on bar), and hands, a tree and an anchor (a drawing placed with a position, rotation, size and flip, in front of
  or behind the strands). They're out of scope here, but the registry and the layering must allow for them.

### The file

- **The file holds what can't be worked out.** One knot per file: `name`, optional `description` and `about`, the
  finished `knot` picture and optional `steps`, each with a `number`, `instructions` and a `picture`. Step numbers
  are typed, not counted, and may repeat (a step shown in two pictures). A picture holds `strands`, `crossings` and
  `props`. A pin's `angle`, a segment's `length` and `tension`, and a rope's `name` are written only when set. The
  full format is in `docs/knot-editor.md`.
- **The file is versioned.** It starts `"format": "avut-knot", "version": 1`.
  - Any change to what a file means or how it's laid out (a field added, renamed, moved or read differently) bumps
    `version` by one and adds an upgrade, from the version before to the new one, in `src/knot-editor/versions.ts`.
  - Old versions' shapes aren't kept as types: an upgrade is `(file: JsonObject) => JsonObject`, and the file's
    checks run only after the last upgrade.
  - Opening a file runs it through every upgrade from its version to the current one, then checks it. The editor
    says when a file was upgraded, and marks it unsaved, since saving writes the current version.
  - A file with a newer version than the editor knows, or another `format`, is refused, saying so.
  - Each version keeps a sample file, `src/knot-editor/samples/v<n>.json`, never edited once its version is out. A
    test opens every sample: the current version's must come back byte for byte through write, and older ones must
    open, report what they were upgraded from, and pass the checks.
  - Version 1 has no upgrades; the mechanism and its test come with it, so the first change has a place to go.
- **The file's layout is Prettier's.** The pre-commit hook runs Prettier on every staged file, JSON included. So
  `writeKnotFile` formats its JSON with Prettier itself (`prettier/standalone` with its babel and estree plugins),
  and a test checks the result is unchanged by the repo's Prettier. Otherwise a committed knot file would change on
  every commit and no longer match what the editor saves.
- **Files are on your computer, read and written in the browser.** The File System Access API
  (`showOpenFilePicker`, `showSaveFilePicker`, `createWritable`), which only Chrome and Edge have. That's acceptable
  while the editor is dev only; other browsers get a message saying so. There are no server routes. Save writes back
  to the handle that was opened or last saved to.

### Drawing

- **A picture draws in layers, as the knot pages do:** props behind; every strand whole; props with passes; every
  strand's over stretches (crossings and front passes); then each rope's taped end. Ropes are drawn with
  `RopeDrawing`'s pieces, so a knot draws the same in the editor as it will on its page once ported:
  `rope-drawing.tsx` exports its `Stretch`, and its taped end becomes an exported `Tape({ path, colors })`
  component that `RopeDrawing` itself uses. `RopeDrawing` and the existing knots draw exactly as now. Arrows have
  their own drawing for the strand and over layers. Choosing which ends are taped is out of scope.
- **Rope colours are tokens.** The editor's rope colours (body, weave, highlight) are tokens in `globals.css`, the
  orange and green holding today's `ROPE_COLORS` and `SECOND_ROPE_COLORS` values. The arrow's colour is a token too.
  The old knots' hex colours are left alone.
- **Over stretches.** Each strand's curves become a `RopePath`: one `C` segment per Bézier, split (de Casteljau) where
  an over stretch starts and ends.
  - **Length.** Each crossing's over stretch reaches past it, along the strand on top, by the old editor's
    angle-dependent amount: `min(4, 0.75 + 0.6 / max(sin θ, 0.15))` diameters, θ being the angle between the
    strands, so shallow crossings get longer stretches. A front pass's stretch is as long as the prop needs (see
    Props).
  - **Clipping.** A stretch stops short of any crossing where its own strand goes under, and of any pass where it
    goes behind.
  - **Merging.** Two of a strand's stretches that overlap are merged, but never across a crossing where it goes
    under.
  - **Too close.** Where two crossings are too close for both stretches to fit, the crossings get a warning, like a
    tight bend.

### The page

- **The editor has its own look, through a nested layout, not a second root layout.** The root layout keeps
  `<html>`, `<body>`, fonts and metadata. The site's scroll box, `SiteFooter` and `ScrollMemory` move to
  `src/app/(site)/layout.tsx`, with every existing route moved into `(site)` (addresses unchanged). The editor's
  `(editor)/layout.tsx` fills the window with no scroll box or footer. With one root layout there's no full page
  load between the two and no need for `global-not-found`. An address that matches no page renders only the root
  layout, so a new `src/app/not-found.tsx` draws the site's chrome itself, from a `SiteChrome` component that
  `(site)/layout.tsx` uses too.
- **Nothing recomputes that a change didn't touch, and dragging never waits.** Each change makes a new document that
  shares every pin, segment, strand and prop object it didn't change. Segment geometry (control points, samples,
  length, bends, bounding box) is cached by its inputs, and crossings are only looked for between segments whose
  boxes overlap. A drag reads the pointer from its events and applies at most one change per animation frame. The
  pointer's position isn't held in the editor's state; only the status bar's readout updates on a plain move. The
  target for a 100-pin rope's geometry is 2 ms, measured by hand; the test only guards against it getting badly slow.
- **Undo holds whole documents.** A history of documents (they share structure, so it's cheap), each entry with the
  picture that was being edited and the selection at the time, so undo and redo show the picture they change and
  put the selection back as it was. A drag, from pointer down to up, is one entry; so is a typed value. Adding or
  deleting a pin or strand carries the selection across the renumbering, so a selected pin stays selected under its
  new number and a deleted one drops out.

## Tasks

### Review group 1: the curves and the file (no UI)

- [x] **1. Bézier and Hobby maths** — Add cubic Bézier and Hobby's curve maths to `src/lib`
  - **Files:** `src/lib/bezier.ts`, `src/lib/hobby.ts`, `src/lib/bezier.test.ts`, `src/lib/hobby.test.ts`
  - **Do:**
    - `bezier.ts`, on `Vector2` (`src/lib/vector2.ts`): a `Cubic` type (four points); its point and first and second
      derivatives at t; split at t (de Casteljau); length (Gauss–Legendre, and the length up to t); t at a length
      along it; curvature at t and the tightest radius along it (sampled, then refined with `goldenSection` from
      `numeric.ts`); bounding box; sampled points; and where two cubics cross (sampled polylines with
      `segmentIntersection` from `geometry.ts`, each hit refined to t and u).
    - `hobby.ts`: control points for a segment from its two end directions and two tensions (Hobby's ρ and σ), and
      the reverse (the tensions giving a segment's control points, for splitting); and the directions through a run
      of points given the directions at either end of the run, or curl at a free end (the tridiagonal system with
      every tension 1, as in Decisions, solved directly, not with `solveLinear`'s dense solve).
    - Write each in the file's existing style (`vector2.ts`'s chained methods, doc comments on each export).
  - **Done when:** tests check a split's halves meet and match the whole; length against a straight line, a
    quarter-circle approximation and a high-resolution polyline (to 1e-6); radius against a known circle
    approximation; Hobby's directions through points on a circle come out tangent to it (to a degree), and through
    points on a line come out along it; tensions to control points and back give the same tensions; two cubics
    crossing once, twice and not at all. Type check, lint and `npm test` pass.

- [x] **2. The knot file and its versions** — Add the knot editor's versioned file format, with checks, upgrades and
      a writer that leaves out defaults
  - **Files:** `src/knot-editor/format.ts`, `src/knot-editor/versions.ts`, `src/knot-editor/props/index.ts`,
    `src/knot-editor/props/bar.tsx`, `src/knot-editor/samples/v1.json`, `src/knot-editor/format.test.ts`
  - **Do:**
    - Types: `KnotFile`, `Step`, `Picture`, `Strand` (a union on `kind`: `rope` with `colour` and optional `name`,
      and `arrow`), `Pin`, `StrandSegment`, `CrossingEntry`, `PassEntry` and `Prop`, as in Decisions and
      `docs/knot-editor.md`. A strand with n pins has n − 1 segments, and at least 2 pins.
    - `props/index.ts`: the registry of prop kinds, each with its type's checks for now. `props/bar.tsx`: the bar,
      its fields from `Bar` (`src/knots/bar.tsx`) plus `passes` when side on.
    - `versions.ts`: `CURRENT_VERSION = 1`, `type Upgrade = (file: JsonObject) => JsonObject` and `UPGRADES`, the
      list of upgrades (empty for now). Its doc comment says how to change the format, as in Decisions.
    - `parseKnotFile(text, { current, upgrades } = { current: CURRENT_VERSION, upgrades: UPGRADES })`: a result union
      on `kind`: `{ kind: "ok", file, upgradedFrom? }` or `{ kind: "error", reason }`, the reason saying where (for
      example "steps[2].picture.strands[0]: 4 pins but 2 segments"). Reads the header, runs the upgrades, then checks
      types, segment counts, crossing and pass references, colour names, prop kinds (through the registry) and step
      numbers (whole numbers from 1).
    - `writeKnotFile(file)`: JSON formatted by `prettier/standalone` (see Decisions), keys in a fixed order, leaving
      out unset angles, unlocked lengths, tensions of 1 at both ends, unset names, empty `steps`, `props` and
      `passes`. Numbers rounded to 1e-4, as `rounded()` in `rope-drawing.tsx` does for drawing.
    - `samples/v1.json`: a small knot with two ropes, an arrow, a side-on bar with passes in front and behind,
      crossings between all three strands, locked and unlocked segments, and two steps sharing a number. Written by
      `writeKnotFile`. Here it's checked for format only; Task 4 checks its crossings and passes match its curves.
  - **Done when:** tests check:
    - a full file round-trips exactly through write and parse;
    - defaults are left out;
    - Prettier's `format` (with the repo's config) leaves the writer's output unchanged;
    - each kind of bad file is refused with a reason naming where;
    - a file with a newer `version`, or another `format`, is refused saying so;
    - `UPGRADES.length === CURRENT_VERSION - 1`;
    - every sample opens; the current version's comes back byte for byte through write, and older ones (none yet)
      report `upgradedFrom` and pass the checks;
    - with a v1 → v2 upgrade passed in by the test, `samples/v1.json` opens through it and reports `upgradedFrom: 1`.

    Type check, lint and `npm test` pass.

- [x] **3. Curves and lengths** — Work out a picture's curves, locked lengths and bends, keeping what didn't change
  - **Files:** `src/knot-editor/geometry.ts`, `src/knot-editor/geometry.test.ts`
  - **Do:**
    - `pictureGeometry(picture, previous?)`: per strand, each pin's direction (held or from Hobby's run) and each
      segment's `Cubic`, length, tightest radius and box; for locked segments, the scaled tensions that meet the
      length and a status (`ok`, `too-short` by how much, `too-long` by how much, against its reach). With
      `previous` (the geometry of the picture before a change), segments whose pins, directions and own values are
      unchanged (by identity, then by value for directions) reuse their old results.
    - The bends tighter than 1.75 as ranges along each rope's segments, for the warning (not arrows).
  - **Done when:** tests check:
    - a locked segment meets its length to 1e-3;
    - too short and too long are reported with the right amounts against the reach;
    - changing a locked segment's length or a segment's tensions leaves every pin's direction unchanged;
    - a change to one pin reuses every segment outside its Hobby run;
    - a 100-pin rope's geometry takes under 50 ms (median of 20 runs, after a warm-up).

    Type check, lint and `npm test` pass.

- [x] **4. Crossings, passes and strand paths** — Find and match a picture's crossings and passes, and make each
      strand's path with its over stretches
  - **Files:** `src/knot-editor/crossing-geometry.ts`, `src/knot-editor/crossing-geometry.test.ts`,
    `src/knot-editor/props/index.ts`, `src/knot-editor/props/bar.tsx`, `src/knot-editor/samples/v1.json` (corrected if
    its entries don't match)
  - **Do:**
    - Crossings between any two strands, ropes and arrows alike (box test first), each with its pair, `n`, t along
      each, and the angle between the strands, matched to the picture's entries as in Decisions: `set` (with which
      is over), `unset`, `to-check`, and entries `lost`. A hit where neighbouring segments meet at their shared pin
      is ignored.
    - Passes across each prop with passes: the registry gives such a kind a function finding where a segment passes
      across it and the stretch of curve covering it (for the side-on bar, where the curve crosses the bar's middle
      line within its length, and the part within its radius plus a margin), added to `props/index.ts` and
      `props/bar.tsx` here. Matched to `passes` as in Decisions.
    - `strandPaths(picture, geometry, crossings)`: a `RopePath` per strand (`src/knots/rope-path.ts`) with its over
      stretches from crossings and front passes, as in Decisions, and the crossings too close for them.
  - **Done when:** tests check:
    - crossings come out `set`, `unset`, `to-check` and `lost` as expected, including a pair crossing twice that
      loses one crossing (both entries `to-check`), and an arrow crossing a rope;
    - a smooth strand with no crossings reports none (no hits at shared pins);
    - passes come out the same way, including a segment passing a bar twice that loses one pass (`to-check`, not
      silently drawn in front);
    - `crossings()` from `rope-path.ts` on `strandPaths`' output finds every crossing with exactly one strand over;
    - the same holds for two ropes crossing each other, checked as `rope-path.test.ts`'s `between()` does;
    - over stretches reach the angle-dependent length past their crossings, never pass a crossing where their strand
      is under or a pass where it's behind, and never overlap;
    - a front pass's stretch covers the bar's whole height;
    - each of `samples/v1.json`'s pictures has no unset, lost or to-check crossing or pass.

    Type check, lint and `npm test` pass.

Review group 1 ends here.

### Review group 2: the page, its menus and files (visual checkpoint: the empty editor opens and saves files)

- [x] **5. Site layout into a route group** — Move the site's pages into a `(site)` route group with their own
      layout
  - **Files:** `src/app/layout.tsx`, `src/app/(site)/layout.tsx` (new), `src/app/not-found.tsx` (new),
    `src/components/site-chrome.tsx` (new), every route folder and `page.tsx` in `src/app` moved into
    `src/app/(site)/` (`git mv`); `icon.svg`, `apple-icon.png` and `globals.css` stay where they are.
    `src/components/scroll-memory.tsx` (its comment says "see the root layout"), `AGENTS.md` (Code layout's
    `src/app/<route>/page.tsx`) and `README.md` (its `app/` tree).
  - **Do:**
    - Read `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route-groups.md` and `layout.md`
      first.
    - The root layout keeps `<html>`, fonts, metadata, viewport and `<body>` (its classes too). The `page-scroll` box,
      `SiteFooter` and `ScrollMemory` move to `SiteChrome`, which `(site)/layout.tsx` and `not-found.tsx` both use.
    - Regenerate route types (`npx next typegen`) and check nothing refers to the old paths
      (`grep -rn "src/app/" scripts src docs`). Update AGENTS.md and README.md to the new layout.
  - **Done when:**
    - `git diff --stat -M` shows renames plus the layouts, `not-found.tsx`, `SiteChrome` and the docs;
    - every page (home, each visualisation, each article, the visual introduction, `/knots` and a knot page) looks as
      before, scrolls in its box and keeps its scroll on Back;
    - a made-up address shows the 404 with the footer.

    Type check, lint, `npm test` and `scripts/figures.mjs --check` pass.

  - `visual`

- [x] **6. The editor's page and menu bar** — Add the knot editor's page, with its own layout, menu bar and panels
  - **Files:** `src/components/ui/menubar.tsx` (from `npx shadcn add menubar`, the repo's pinned version),
    `src/app/(editor)/layout.tsx`, `src/app/(editor)/knot-editor/page.tsx`, `src/knot-editor/editor.tsx`,
    `src/knot-editor/menus.tsx`, `src/app/globals.css` (only if the editor needs tokens the site doesn't have)
  - **Do:**
    - The page: dev only and not indexed (as `src/app/knots/edit/page.tsx`), rendering `KnotEditor`.
    - `(editor)/layout.tsx`: fills the window (`h-dvh`, no scroll), no footer.
    - `editor.tsx`: the menu bar, the steps list on the left, the drawing in the middle, the panel on the right and
      the status bar, empty for now. Colours from tokens only (AGENTS.md).
    - `menus.tsx`: File, Edit, Insert, View and Help with every item from `docs/knot-editor.md`, each showing its
      shortcut; items not built yet are disabled. Shortcuts are handled in one place, and the browser's own (Cmd+S,
      Cmd+O) are prevented when the editor takes them.
  - **Done when:** `/knot-editor` on the worktree's server shows the editor filling the window with no site
    footer, the menus open with the keyboard and mouse, and the page's guard returns `notFound()` outside
    development. The browser console has no errors. Type check, lint and `npm test` pass.
  - `visual`

- [x] **7. New, Open and Save** — Open and save knot files on your computer
  - **Files:** `src/knot-editor/files.ts`, `src/knot-editor/file-system-access.d.ts` (the API's types, which the
    TypeScript DOM library lacks), `src/knot-editor/editor.tsx`, `src/knot-editor/menus.tsx`
  - **Do:**
    - `files.ts`: open (one `.json` file), save to the current handle, save as; each reports a cancelled picker as
      nothing happening, and a failed read, parse (`parseKnotFile`'s reason) or write as an error the editor shows
      in a dialog.
    - A file that was upgraded on opening says so ("Opened a version 1 file; saving writes version 2") and starts
      unsaved.
    - New starts an untitled knot with one orange rope of two pins. Open and New ask before discarding unsaved
      changes, and so does leaving the page (`beforeunload`).
    - The title (menu bar and browser tab) shows the file's name and a dot while unsaved.
    - In a browser without the API, File menu items explain that Chrome or Edge is needed.
  - **Done when:** in Chrome, `samples/v1.json` opens; Save writes it back byte-for-byte when nothing changed; Save As
    writes a new file; a broken file shows its reason. The visual checkpoint covers tasks 5–7. Type check, lint and
    `npm test` pass.
  - `visual`

Review group 2 ends here, with its visual checkpoint.

### Review group 3: drawing and editing strands (visual checkpoint: drawing and dragging a rope)

- [ ] **8. Edits and undo** — Add the editor's state: the document, selection, edits and undo
  - **Files:** `src/knot-editor/state.ts`, `src/knot-editor/edits.ts`, `src/knot-editor/edits.test.ts`
  - **Do:**
    - `edits.ts`: pure functions from a picture to a new one, sharing what they don't change. Those that need curve
      lengths or where crossings and passes lie (lock, unlock, insert, delete) also take the picture's geometry
      from Tasks 3 and 4. The edits: move a pin, set or clear its angle, set a segment's tensions (refused while
      locked), lock or unlock it, set its length, shift Δ at a pin, insert a pin on a segment at t, delete a pin
      (joining its segments), add a rope (with the first unused colour written in) or an arrow, delete a strand, set
      a rope's colour or name. Each edit that renumbers pins or strands also says how old numbers map to new, for
      the selection. Lock, unlock, insert and delete follow the rules in Decisions for lengths, crossings and passes.
    - `state.ts`: a reducer over the file, the picture being edited (the knot or step n), the selection (pins and
      segments by strand and index, or a prop), the history (undo and redo stacks, each entry a file, the picture
      being edited and the selection) and whether it's saved. A drag sends a begin and an end, so it's one history
      entry however many moves it makes.
  - **Done when:** tests check:
    - each edit, and that unchanged pins, segments and strands keep their identity;
    - lock then unlock leaves the curve where it was;
    - inserting a pin leaves the curve where it was (to 1e-3, away from clamped tensions), and into a locked segment
      gives two locked halves whose lengths sum to the old one; deleting a pin joins lengths as in Decisions;
    - crossing and pass entries follow an insert and delete, including a crossing on the split segment itself (it
      goes to the right half, counted along the new pair's first segment), an entry between the two segments a
      delete joins (`to-check`), and deleting a strand;
    - adding or deleting a strand never changes another rope's colour;
    - a shift keeps the total length;
    - a selected pin stays selected under its new number after an insert or delete before it;
    - undo and redo walk back and forth through a drag as one step, switch to the picture they change, and put back
      the selection that went with it.

    Type check, lint and `npm test` pass.

- [ ] **9. Drawing a picture** — Draw a picture's strands and props in their layers
  - **Files:** `src/knot-editor/picture-drawing.tsx`, `src/knot-editor/arrow-drawing.tsx`,
    `src/knot-editor/colours.ts`, `src/knot-editor/props/bar.tsx`, `src/knot-editor/props/index.ts`,
    `src/knots/rope-drawing.tsx`, `src/app/globals.css`
  - **Do:**
    - `rope-drawing.tsx`: export `Stretch`, and move the taped end into an exported `Tape({ path, colors })` that
      `RopeDrawing` uses; no change to how `RopeDrawing` draws.
    - `colours.ts`: the rope colour names and their tokens (added to `globals.css`: orange and green with today's
      `ROPE_COLORS` and `SECOND_ROPE_COLORS` values, and three or four more), the arrow's token, and the first
      unused colour in a picture, for adding ropes.
    - `arrow-drawing.tsx`: an arrow's shaft and head for the strand layer, and its over stretches for the top layer
      (the shaft, with an outline so it reads as on top).
    - `picture-drawing.tsx`: `PictureDrawing`, which draws a picture from its geometry and `strandPaths` in the
      layers in Decisions: props behind, every strand whole, props with passes, every strand's over stretches, then
      each rope's tape. Each prop is drawn through the registry; `props/bar.tsx` draws the bar with `BarDrawing`.
      Memoised per strand and prop, so a change to one redraws only it.
  - **Done when:** `samples/v1.json`'s pictures, drawn in the editor's middle panel, look like the knot pages'
    drawings (the orange and green ropes match `RopeDrawing`'s), with the arrow over and under the ropes as its
    crossings say and the bar's passes in front and behind; the existing knot pages look exactly as before. Type
    check, lint and `npm test` pass.
  - `visual`

- [ ] **10. Selecting and dragging** — Edit the picture with the pointer
  - **Files:** `src/knot-editor/canvas.tsx`, `src/knot-editor/handles.tsx`, `src/knot-editor/editor.tsx`,
    `src/knot-editor/menus.tsx`
  - **Do:**
    - `canvas.tsx`: an SVG with pan (drag the background) and zoom (wheel, View menu, Fit), drawing the picture with
      `PictureDrawing`, keeping `pictureGeometry` between renders as `previous`.
    - `handles.tsx`: pins (numbered from 1 when View > Pin Numbers is on), each segment's hit area along its curve,
      and for a selected pin its angle ring and its two tension handles. Memoised per pin and segment, so a drag
      re-renders only what moved.
    - Click selects, shift-click adds; Edit > Select All selects every pin. Drag a pin to move it; drag the ring to
      set its angle; drag a handle along the pin's direction to set that end's tension (not on a locked segment).
      Double-click a segment, or Insert > Pin with a segment selected, to add a pin (Insert > Pin adds it at the
      segment's middle). Insert > Rope and Insert > Arrow add a short straight one in the middle of the view. Delete
      removes the selected pins, or the strand when all of its pins are selected. View > Handles shows or hides the
      angle rings and tension handles. Dragging uses pointer capture and `requestAnimationFrame` as in Decisions.
  - **Done when:** on the worktree's server, dragging a pin on a 20-pin rope keeps up with the pointer (Chrome's
    performance panel shows no frame over 16 ms from the editor while dragging); each interaction above works, on
    ropes and arrows, and undoes in one step. The console has no errors. Type check, lint and `npm test` pass.
  - `visual`

- [ ] **11. The panel, warnings and status bar** — Show and type the selected pin's or segment's values, and the
      warnings
  - **Files:** `src/knot-editor/inspector.tsx`, `src/knot-editor/status-bar.tsx`, `src/knot-editor/shortcuts.tsx`,
    `src/knot-editor/canvas.tsx`, `src/knot-editor/editor.tsx`, `src/knot-editor/menus.tsx`
  - **Do:**
    - The panel: for a pin, x, y, angle (blank for none) and, with both segments locked, shift buttons and an amount;
      for a segment, its length (shown always, typed when locked), locked, and both tensions (typed when unlocked,
      the scaled values shown read-only when locked); for a rope's segment or pin, also the rope's colour and name;
      for nothing selected, a placeholder until task 14. A typed value applies on Enter or leaving the field, as one
      history entry.
    - Help > Shortcuts: a dialog (`src/components/ui/dialog.tsx`) listing every shortcut and what a click, drag and
      double-click do on the drawing, from the same table the menus use.
    - On the drawing: bends tighter than 1.75 shaded on ropes (View > Bend Warnings); a locked segment that can't
      meet its length drawn red, with the reason in the panel.
    - The status bar: the pointer's position (its own component holding its own state, so moves don't re-render the
      editor), the zoom, counts of warnings, and saved or not.
  - **Done when:** each value can be read and typed; a pin moved too far from its locked neighbour turns the
    segment red and the panel gives the length short; a tight bend shades; a rope's colour changes from the panel;
    React's profiler shows a plain pointer move re-rendering only the status bar. The visual checkpoint covers tasks
    9–11. Type check, lint and `npm test` pass.
  - `visual`

Review group 3 ends here, with its visual checkpoint.

### Review group 4: crossings and props (visual checkpoint: a knot round a bar, with an arrow)

- [ ] **12. Crossings** — Choose which strand is on top at each crossing
  - **Files:** `src/knot-editor/crossings.tsx`, `src/knot-editor/edits.ts`, `src/knot-editor/edits.test.ts`,
    `src/knot-editor/canvas.tsx`, `src/knot-editor/inspector.tsx`, `src/knot-editor/status-bar.tsx`
  - **Do:**
    - Edits: set a crossing's top strand, swap it, delete a lost entry, confirm a `to-check` pair (its entries
      replaced by the crossings as now drawn, numbered afresh).
    - On the drawing: a marker on each unset crossing, a different one on each `to-check` crossing and on crossings
      too close for their over stretches; clicking any crossing sets or swaps it (View > Crossings shows letters,
      A, B…, as the old editor did, so we can name them).
    - The panel lists lost entries, each with a button to delete it, and `to-check` pairs with a button to confirm
      them; the status bar counts unset, to check and lost.
  - **Done when:** tests check the edits; in the browser, every crossing of a two-crossing loop can be set and
    swapped, an arrow can be put over one strand and under another, moving a pin until a crossing disappears lists
    it as lost, and a pair that goes from two crossings to one shows as to check until confirmed. Type check, lint
    and `npm test` pass.
  - `visual`

- [ ] **13. Props** — Add, move and remove props, and choose which passes go in front of them
  - **Files:** `src/knot-editor/props/index.ts`, `src/knot-editor/props/bar.tsx`, `src/knot-editor/edits.ts`,
    `src/knot-editor/edits.test.ts`, `src/knot-editor/canvas.tsx`, `src/knot-editor/inspector.tsx`,
    `src/knot-editor/menus.tsx`, `src/knot-editor/status-bar.tsx`
  - **Do:**
    - The registry gives each kind its panel fields and a way to drag it, and Insert > Prop lists the kinds from it
      (only Bar for now: end on, or side on with a length).
    - Edits: add a prop, move it, set its fields, delete it, set a pass in front or behind, delete a lost pass,
      confirm a segment's `to-check` passes.
    - Selecting a prop shows its fields in the panel; it can be dragged; Delete removes it. Clicking a pass across a
      prop sets or swaps its side; unset and to-check passes get markers and counts as crossings do.
  - **Done when:** tests check the prop edits; in the browser, a rope wrapped round a side-on bar shows passes in front
    and behind as chosen, moving the bar so a pass disappears shows the segment's passes as to check, and an end-on
    bar sits behind the rope. Type check, lint and `npm test` pass.
  - `visual`

Review group 4 ends here, with its visual checkpoint.

### Review group 5: steps and the knot's details (visual checkpoint: a whole knot with steps)

- [ ] **14. Steps and the knot's details** — Add steps with numbers and instructions, and the knot's name,
      description and about text
  - **Files:** `src/knot-editor/steps-list.tsx`, `src/knot-editor/details-dialog.tsx`, `src/knot-editor/edits.ts`,
    `src/knot-editor/edits.test.ts`, `src/knot-editor/inspector.tsx`, `src/knot-editor/editor.tsx`,
    `src/knot-editor/menus.tsx`
  - **Do:**
    - The left list: "Knot", then each step as its number and the start of its instructions. Choosing one edits its
      picture. Insert > Step adds one after the chosen one, as a copy of its picture, numbered one more; steps can be
      duplicated, deleted and moved up or down. Numbers are never renumbered by the editor.
    - The panel with nothing selected: the step's number and instructions (multi-line).
    - File > Knot details…: a dialog (`src/components/ui/dialog.tsx`) for the name, description and about text.
  - **Done when:** tests check the step edits; in the browser, a knot with three steps (two sharing a number) saves,
    opens again and comes back the same. The visual checkpoint covers task 14. Type check, lint and `npm test` pass.
  - `visual`

- [ ] **15. Docs** — Point the knots' docs at the new editor
  - **Files:** `docs/knots.md`, `docs/knot-editor.md`
  - **Do:** `knots.md`'s editor paragraph names `/knot-editor` as the editor being built, and the old one as kept
    until the knots are ported. `knot-editor.md` is brought into line with anything the build settled differently.
  - **Done when:** both read correctly against the code. Prettier passes on them.

Review group 5 ends here, with its visual checkpoint.

## Docs impact

None on the site: the editor is dev only, and no page changes. Developer docs: `AGENTS.md` and `README.md` for the
`(site)` route group (task 5), and `docs/knots.md` and `docs/knot-editor.md` (task 15).

## Out of scope

- Porting the figure-8 steps, the round turn and the other knots to the new files, and the knot pages reading them.
- Props other than the bar: a carabiner, a ring, hands, a tree, an anchor (the registry and layering allow for them).
- Choosing which ends are taped, exporting SVG.
- Animating between steps.
- Other browsers' file access (Safari, Firefox), and a phone layout.
- Any change to `pinned-rope.ts`, the old editor or how the existing knots draw.

## Parked
