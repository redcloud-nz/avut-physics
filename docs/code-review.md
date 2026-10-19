# Code review of the whole project

Reviewed 2026-10-19 by five reviewing agents, each taking one part of the code: the ladder-hinge model and `src/lib`;
the other solvers; the visualisation components, `src/components` and the visualisation pages; A Visual Introduction
to Rescue Physics (`src/visual`, `src/app/visual`); and the articles with the build and tooling. Reviewers read the
code and, where useful, ran scripts against the solvers. The most serious findings were then checked again against the
code; those say **Checked** below. Nothing was looked at in a browser, so layout and touch findings are marked
unconfirmed.

At the time of the review the type check, lint, `npm test` (190 passed, 2 expected failures) and
`scripts/figures.mjs --check` all passed.

**70 findings:** 5 bugs, 6 test gaps, 11 risks, 22 quality, 26 nits.

Severity: **bug** is wrong on the site now. **Test gap** is a check that would let a wrong answer through. **Risk** can
go wrong but hasn't been seen to, or is held off only by slider ranges. **Quality** is duplication, structure or
clarity. **Nit** is small.

## Start here

- **bug**, visual/redirect: says the load side always pulls harder round a karabiner, contradicting Pulley friction
- **bug**, body-belay: the drawing mixes the old solve with the new frame while sliders move
- **bug**, four-point-lower: a large slider jump freezes the page for seconds
- **bug**, visual card: arrow keys on option buttons turn the page; Alt+← goes back twice
- **bug**, visual share: Copy link throws where the clipboard isn't available
- **test gap**, ladder-hinge checks: the held check never tests that contacts push

## Physics and page text

- [ ] **bug**: Redirect says the load side pulls harder round a karabiner. `src/visual/pages/redirect/page.tsx:11-13`.
  - **Problem:** "Round a karabiner, friction makes the load side pull harder than the team side while the rope runs."
    That's only true when lowering. When hauling the team side pulls harder, which is what
    `src/visual/pages/friction/page.tsx:28-30` says, so the two pages contradict each other.
  - **Fix:** "the side the rope runs towards pulls harder", or say it's while lowering.
  - **Checked.**
- [ ] **quality**: Compound says "about 4 kN once friction takes its share". `src/visual/pages/compound/page.tsx:11`.
  - **Problem:** With pulleys at e = 0.9 the series' own model gives (1+e)(1+e+e²) ≈ 5.15:1, so three people pulling
    0.9 kN put about 4.6 kN on the load.
  - **Fix:** "about 4.5 kN".
- [ ] **nit**: Splitting arrows' figure starts at x = 2.4, y = 1.8, but its drawer works through x = 1.8, y = 2.4.
      `src/visual/pages/splitting-arrows/figure.tsx:17`.
- [ ] **nit**: "Master point, right of the middle" reads oddly at negative values.
      `src/visual/pages/pulling-off-centre/figure.tsx:95`.
- [ ] **nit**: "a few percent" should be "per cent" in NZ English. `src/visual/pages/rope-stretch/page.tsx:52`.
- [ ] **nit**: The standing body belays article says the safety factor "stays between 1.41 and 1.59 from 40 kg to
      150 kg", but only the two ends are worked out. `src/app/standing-body-belays/page.tsx` (Training section).
  - **Fix:** Work out the range in `standing-body-belays.compute.ts`, or reword. Unconfirmed whether it leaves the range.
- [ ] **nit**: `heaviestAt` starts at 39 kg and steps up 10 kg at a time, assuming the safety factor falls steadily with
      weight. If 40 kg already fails the article would say "up to about 39 kg".
      `src/articles/standing-body-belays.compute.ts:96-102`. Current values (60, 132, 49 kg) are fine.

## Visualisations

- [ ] **bug**: The body-belay drawing mixes old and new settings. `src/visualisations/body-belay.tsx:113-136, 212-253,
  459-462`.
  - **Problem:** `sol` comes from the deferred `input`, but `PPM`, `H`, `origin`, the wall, the belayer's feet and the
    arrow scale `k = 110/barWeight` come from the current state. `solveBelay` takes about 90 ms, so for the whole of a
    drag the stretcher and ropes from the old solve are drawn against the new wall and belayer: the rope's end leaves
    the figure, and arrows are scaled by the new weight. The notice at :462 compares the old `gripNeeded` with the new
    `grip`.
  - **Fix:** Build the drawing and that notice from `input`.
  - **Checked.**
- [ ] **bug**: A large slider jump freezes the four-point lower. `src/visualisations/four-point-lower.tsx:179-227`.
  - **Problem:** `pay()` runs `follow()` synchronously in the slider's `onChange`. Timed at about 0.9 s per metre with
    all four ropes coupled, about 0.4 s for one rope, and `mostOut` is 4–5 m. Clicking along the track, or pressing
    End or PageUp, blocks the page for seconds. Ordinary dragging is fine.
  - **Fix:** Cap the move per event, or run it in chunks or a worker.
- [ ] **risk**: The amber notice covers the drawing on phones. `ladder-hinge.tsx:657`, `two-point-lower.tsx:288`,
      `body-belay.tsx:494`, `four-point-lower.tsx:460`, `multi-point-anchor.tsx:298`, `ute-load.tsx:401`.
  - **Problem:** It is `absolute inset-x-4 top-6` over the SVG. At about 400 px long reasons wrap to 4–5 lines and
    cover the top third, including the ladder's tip and anchor in the ladder-hinge cases that matter, and the
    `lg:hidden` Settings button (`controls.tsx:183`). Unconfirmed in a browser.
  - **Fix:** One shared notice component, placed above or below the drawing on narrow screens.
- [ ] **risk**: Multi-point anchor shows solver results from the server render. `src/visualisations/multi-point-anchor.tsx:125-146,
  152-185`.
  - **Problem:** `frame`, and so `PPM`, `H`, the viewBox and every coordinate, comes from `solveAnchor` during SSR. The
    other pages wait for the browser because solver digits can differ between server and browser, and React 19
    doesn't patch mismatched attributes on hydration. The effect is tiny in practice.
  - **Fix:** Gate it like the others. Ladder-hinge, two-point and body-belay also run their solvers during SSR and
    throw the result away; gate those with `inBrowser` as four-point does (:173).
- [ ] **quality**: On phones the controls are in a sheet covering three-quarters of the width over a blurred overlay,
      so you can't see the diagram respond while moving a slider. Only the rope-length and load-direction sliders sit
      outside it.
- [ ] **nit**: "Hardest rope pull so far" is the maximum of a trace kept to the last 1500 steps, so after about 30 m of
      rope movement an early peak drops off and the readout goes down. `src/visualisations/four-point-lower.tsx:41,
  226, 383`.
- [ ] **nit**: Inconsistent capitals: "Ladder Angle", "Team Underruns below". `src/visualisations/ladder-hinge.tsx:683, 772`.
- [ ] **nit**: The Footing select repeats "Dry"/"Wet" in each option and its group label.
      `src/visualisations/body-belay.tsx:560-563`.
- [ ] **nit**: The layout scrolls inside `.page-scroll` rather than the window, so going back may not restore the
      scroll position. Unconfirmed.

## Visual introduction

- [ ] **bug**: Arrow keys turn the page when they shouldn't. `src/visual/card.tsx:52-58`.
  - **Problem:** The handler skips only `HTMLInputElement`. On Counting, `Choice` is buttons with `role="radio"`, so
    → on "3:1" goes to the next page. It also ignores `altKey`, `metaKey`, `ctrlKey` and `defaultPrevented`, so
    Alt+← (Back on Windows and Linux) goes back twice: the browser goes back and `router.push(prev)` runs too.
  - **Fix:** Skip any focused control (`input`, `button`, `select`, `[role=radio]`, contenteditable), and skip events
    with a modifier key or `defaultPrevented`.
  - **Checked.**
- [ ] **bug**: Copy link can throw. `src/visual/share.tsx:62-67`.
  - **Problem:** `navigator.clipboard.writeText` has no `.catch`, and nothing checks `navigator.clipboard` exists. Over
    plain http (testing on a LAN address) it's undefined and the click throws; in-app browsers (Facebook, Instagram)
    can refuse the write. Either way the user hears nothing. "Copied" isn't in an `aria-live` region either.
  - **Fix:** Guard and catch, and say "Couldn't copy" when it fails.
- [ ] **risk**: Four figures can only be used by dragging: Arrows, Adding arrows, Equilibrium, Splitting arrows.
      `src/visual/common/grid.tsx:73-91`.
  - **Problem:** The SVG is `role="img"` with a fixed label and no keyboard or slider alternative.
  - **Fix:** Let the arrow tips take focus and move with the arrow keys, or add sliders under the figure.
- [ ] **risk**: `touch-none` on the grid may stop the page scrolling on short phones, where the card grows and
      scrolls and the grid fills most of it. `src/visual/common/grid.tsx:76`. Unconfirmed in a browser.
- [ ] **risk**: The-end's "visualisations" link doesn't close its details drawer before leaving, so pressing Back from
      `/` may bring the page back with the drawer open (`card.tsx:178-180` explains Next keeps the page).
      `src/visual/pages/the-end/page.tsx:16`. Unconfirmed in a browser.
- [ ] **quality**: An unknown slug gets page 1's share image with a 200 instead of a 404, and every image's `alt` is
      just the series name. `src/app/visual/[slug]/opengraph-image.tsx:14-17`.
  - **Fix:** `notFound()` for unknown slugs; give each page its own `alt`.
- [ ] **quality**: Every page has the same meta description, and with the root title template the tab title is very
      long ("Velocity is speed and direction, A Visual Introduction to Rescue Physics | Physics Visualisations").
      `src/app/visual/[slug]/page.tsx:17-18`.
- [ ] **quality**: `common/haul.tsx` and `common/grid.tsx` use hooks without `"use client"`. They work only because
      client figures are their only importers.
- [ ] **nit**: In Counting, `Math.min(pulled, max)` is redundant because changing system resets `pulled`, and the
      readouts aren't `aria-live`. `src/visual/pages/counting/figure.tsx:44`.

## Accessibility

- [ ] **quality**: `Choice` is marked as a radio group, but each option is its own Tab stop and the arrow keys don't
      move between options. `src/components/diagram/controls.tsx:65-90`.
- [ ] **quality**: The main diagram SVGs have no `role="img"` or `aria-label`; only the trace graph has one.
- [ ] **quality**: `M` and `Eq` put raw TeX in `aria-label`, so screen readers read "\lambda".
      `src/components/tex.tsx:58, 69`.
- [ ] **quality**: Ute-load's gauges show OK, near and over by colour alone; nothing says "over".
      `src/visualisations/ute-load.tsx:368-389`.
- [ ] **nit**: On the home page visualisation cards are `h2` with no section heading, while article cards are `h3`
      under an "Articles" `h2`. `src/app/page.tsx:22, 42-60`.
- [ ] **nit**: The Settings sheet has no `SheetDescription`, so Radix warns in dev.
- [ ] **nit**: Readout labels with leading spaces (`"  Rx, Ry"`, `"  N, F"`, `"  lifted off front axle"`) are meant to
      be indented, but HTML collapses the spaces. The label span needs `whitespace-pre`, or real indentation.

## Ladder-hinge model

- [ ] **test gap**: The held check never tests that contacts push. `src/visualisations/ladder-hinge-solver.checks.ts:326-354`.
  - **Problem:** `heldViolations` checks each contact only for sideways force and position. A ground or ladder contact
    pulling into its surface passes if the balances close. The polish loop drops negative multipliers, but the
    penalty fallback (`ladder-hinge-held.ts:265-269`) has nothing checking its sign. `violations()` has this check
    (line 206).
  - **Fix:** Add `c.force.dot(normal) < -forceTol` as in `violations()`.
  - **Checked.**
- [ ] **test gap**: With no hinge force, `heldViolations` checks only `ladderTurn > torqueTol`, never that the ladder is
      actually down (φ ≈ 0). `ladder-hinge-solver.checks.ts:387`. `violations()` checks it (line 253).
- [ ] **test gap**: Both check functions return `[]` for `kind: "none"`, so a wrong "no answer" can't fail a test.
      120 of 300 random held setups and about 1% of free ones end that way. `ladder-hinge-solver.checks.ts:129, 274`.
  - **Fix:** For a sample of `none` setups, check something independent, e.g. that a nearby setup also has no answer,
    or keep a list of setups known to have answers.
- [ ] **test gap**: `forceTol = 1e-3 * (beamWeight + barWeight)` is used for the stretcher's own balance too. With a
      1 kg stretcher on a 100 kg ladder about 10% of the stretcher's weight can go unbalanced and pass.
      `ladder-hinge-solver.checks.ts:133, 279`.
  - **Fix:** Scale the stretcher's checks by its own weight.
- [ ] **test gap**: The sweep snapshot records only arrangement labels, so a refactor that changes tensions or angles
      without changing the label stays byte-identical. `ladder-hinge-solver.sweep.test.ts:17`.
  - **Fix:** Add rounded φ, |t1| and |t2| to each line, and record the snapshot again once.
- [ ] **quality**: Reasons given to `slack(...)` never reach the page. `src/visualisations/ladder-hinge-solver.ts:104-107,
  640-666`.
  - **Problem:** `solve()` returns a `TautResult`'s reason only when `!slack`. `WALL_CABLE_SLACK` and the strings at
    lines 483, 490, 524, 536, 554 and 605 fall through to `solveHinged` or the generic message at 661-666.
  - **Fix:** Pass the slack reason through when `solveHinged` has nothing better, or delete the unused strings.
  - **Checked.**
- [ ] **risk**: Dividing by zero when the attachment can't reach. `ladder-hinge-solver.ts:967`.
  - **Problem:** `T2 = support×n / (u2×n)` and `u2×n = reach/beamCable`. If `beamCable ≤ touchGap`, `reach = 0` and
    this gives ±Infinity or NaN; `solveHinged` (line 989) clamps `reach` to 0 silently. Held off only by the slider
    minimum (0.1 m against a 0.09 m gap).
  - **Fix:** Return a `none` reason when `reach` is 0.
- [ ] **risk**: `checkHanging` relies on `solveLinear` returning null for collinear cables, but its pivot threshold is
      an absolute 1e-12, so nearly collinear cables give huge finite tensions shown as `raised`. The held solver
      guards with `> 100 * W` (`ladder-hinge-held.ts:293`); the free one doesn't. The largest seen in the sweep was
      63×W, which is plausible. `ladder-hinge-solver.ts:502-521`. Unconfirmed.
- [ ] **risk**: `lowestBar` takes the highest limit as the bar's lowest angle. When the wall face is the limit there
      can be a second allowed range, hanging steeply between ladder and wall, with lower energy, which is never
      considered. Defensible if the bar always comes from above, but the notes don't say so.
      `ladder-hinge-solver.ts:719-741`. Unconfirmed; a modelling choice.
- [ ] **quality**: `restOnBeam` is about 280 lines of nested closures with three repair passes (lines 878-957: the lift
      root, `nearLimit`, `atFullLength`), each with its own tolerances. Both known failures are in this path.
      `ladder-hinge-solver.ts:698-977`.
- [ ] **quality**: Repeated numerical code that belongs in `src/lib`: golden-section search three times
      (`ladder-hinge-solver.ts:395-401, 750-756, 786-792`), bisection about five times, a local grid-minimum loop
      (:344-361) that is `gridMinima` without wrap-around, and `vec2(-s.anchorBack, s.wallHeight + s.anchorUp)` about
      8 times. Keep the floating-point operations in the same order when moving them, so the sweep doesn't move.
- [ ] **quality**: `behindFaceFor` and `ropePathFor` live in `ladder-hinge-held.ts` but are imported by the two-point,
      four-point and body-belay solvers, so those depend on the ladder model. Move them to `src/lib`. `wallCablePath`
      (solver) and `ropePathFor` (held) are two versions of the same path.
- [ ] **nit**: `tautIfFlipped` tests only `geometry(...) !== null`, so an arrangement `energy()` rejected for another
      reason (`cutsCorner`, rotation margin) is also called "rope too long". Harmless only because of the slack
      reasons finding above. `ladder-hinge-solver.ts:414-427`.
- [ ] **nit**: The last fallback message is chosen only by `wallCable <= toEdge`, so it can say the rope is too short
      when `restOnBeam` failed for another reason (bar past upright at :743, pin behind the face at :724).
      `ladder-hinge-solver.ts:660-666`.
- [ ] **nit**: `wallCablePath` is exported but only used in its file, and its `yAtFace` would be 0/0 if `anchorBack`
      were 0 (the sliders prevent it). `ladder-hinge-solver.ts:679`.

## Other solvers

- [ ] **risk**: The body belayers' lean search can return an unsettled answer. `src/visualisations/body-belay-solver.ts:195-214`.
  - **Problem:** After 12 tries it returns `best.result` without checking `|best.more| ≤ LEAN_TOLERANCE`. Also `at()`
    changes the shared `facing` each call (line 179), so `lo` and `hi` can come from slightly different functions.
    0 of 900 random setups hit it.
  - **Fix:** Return `none` with a reason when the lean hasn't settled.
  - **Checked.**
- [ ] **test gap**: `ropePathFor` has no test of its own, but it's the reference in
      `two-point-lower-solver.test.ts:106` as well as part of the solvers, so a bug in it passes both.
- [ ] **quality**: Every way `settle` can fail gives "The ropes may run too flat… Try higher belays", including a
      stalled search or a missed balance, so the page can blame the belays for a numerical failure.
      `src/visualisations/four-point-lower-solver.ts:472-476`.
- [ ] **quality**: The incline's maths is inside the component, with no solver, tests or "How this is calculated"
      section, and `kinetic = Math.min(muK, muS)` quietly overrides a μk set above μs. The maths itself is right.
      `src/visualisations/incline.tsx:31-41`.
- [ ] **nit**: The team-reach check uses straight-line distance, but the pull uses the line's path length, which can
      run over the wall's edge. They can't disagree while `teamDistance ≥ 4`. `two-point-lower-solver.ts:130` against
      167, 183, 289.
- [ ] **nit**: The multipliers are seeded with damping `1e-9 * W` in the four-point solver (:684) but `1e-9` in the
      two-point one (:353).
- [ ] **nit**: `Math.min(Math.max(progress, 0), STAGES.length)` repeats `clamp` (`four-point-lower-solver.ts:136`), and
      the force and torque per unit multiplier (`generalised`) is written in both the two-point and four-point
      solvers.
- [ ] **nit**: `r.scale(1 / d)` and the `/ d` curvature terms give NaN if the master point lands on an anchor; only the
      start is guarded (:118). Not reached in 20,000 random setups. `multi-point-anchor-solver.ts:148-150`.
- [ ] **nit**: The ute solver doesn't check `unladenFrontShare` is in [0, 1] or that masses are non-negative, and the
      "rear wheels lift" branch has no test. `ute-load-solver.ts:115-136`.
- [ ] **nit**: The Amarok has the least front-axle headroom (1346 of 1490 kg at the assumed 0.58 share), so the rescue
      fit-out's front-axle verdict depends heavily on that estimated share. Worth noting on the page.
      `src/visualisations/ute-load-vehicles.ts`.

## Components and shared code

- [ ] **quality**: Repeated pieces in the visualisations:
  - The `useSyncExternalStore` "in the browser" check is copied five times; make it a `useInBrowser()` hook.
  - Ladder-hinge, two-point and body-belay repeat `scene`/`ground`, `cableLine`, `tensionArrow`, `force`/`tag`,
    `sumForces`, `NONE` and `MAX_ARROW`.
  - The notes cards repeat their section wrapper, and `Part` lives in `ladder-hinge-notes.tsx` though every notes file
    imports it; move it to `src/components`.
  - `NEAR` (`ute-load-notes.tsx:14`) is a threshold the component uses for its colours, defined in the notes.
- [ ] **quality**: Notes write numbers the code defines: `ladder-hinge-notes.tsx` has 0.5 (`FOOT_FRICTION`), 60°
      (`MAX_TEAM_ANGLE`) and 7.5° (`UNDERRUN_OVER`); `four-point-lower-notes.tsx` has 5% (`SNUG`) and 10 cm
      (`START_GAP`). They match now; import them so they can't drift.
- [ ] **quality**: Repeated pieces in the visual introduction:
  - `kNText` in `pulling-sideways/figure.tsx:20` repeats `grid.tsx:17`.
  - `g = 10` in `weight/figure.tsx:13` repeats `common/mechanics.ts:7`.
  - `FAINT = "#64748b"` in `two-anchors/page.tsx:13` and `pulling-off-centre/page.tsx:16` is `GHOST` in `frame.tsx`.
  - `TOGETHER` is in both `adding-arrows/figure.tsx:11` and `share-image.tsx:15`.
  - The warning pink `#fda4af` is written out in 6 files.
  - The button group in `mass/figure.tsx:102-118` and `units/figure.tsx:74-90` is copied, though `Choice` exists.
  - "Drag either arrow's tip" is written out twice next to `DRAG_HINT`.
  - `pulley-forces.tsx` has its own `Tag`, while `track.tsx` imports one from the articles.

## Build, tooling and docs

- [ ] **risk**: The commit hook checks the working copy, not what's staged. `.husky/pre-commit:2`.
  - **Problem:** `scripts/figures.mjs --check` reads files from disk. Stage a solver change, run `npm run figures`, but
    don't stage the JSON: the check passes, the commit holds stale figures, and the Vercel build fails later.
  - **Fix:** Check the staged versions (`git show :path`), or fail when a `.figures.json` has unstaged changes.
  - **Checked.**
- [ ] **risk**: The figures hash follows only static `import`/`export … from`. It misses `import()`, `require()`,
      files read with `fs`, and package versions. Complete for today's imports (all 12 files checked).
      `scripts/figures.mjs:20`.
- [ ] **quality**: lint-staged runs Prettier before the figures check, so committing an unformatted solver right after
      `npm run figures` changes its hash and the commit is rejected. AGENTS.md mentions it; formatting before
      `npm run figures` (or making the script do it) would save a slow rerun.
- [ ] **quality**: The README leaves out the Ute Load visualisation (`/ute-load`, registered at
      `src/visualisations/index.ts:70`) and doesn't show `src/visual/` or `src/components/ui/` in its layout.
      `README.md:10-27`.
- [ ] **quality**: `@mathjax/mathjax-newcm-font` is imported in `src/components/tex.tsx:11,14` and named in
      `serverExternalPackages`, but isn't in `package.json`; it resolves only through `@mathjax/src`. Declare it at
      the same version.
- [ ] **quality**: `shadcn` (the whole CLI) is a runtime dependency, used only for `@import "shadcn/tailwind.css"` in
      `globals.css:3`. Make it a dev dependency. (`cn` is legitimate.)
- [ ] **nit**: `@types/node` is `^20` while local Node is 24, with no `engines` field or `.nvmrc` to pin what Vercel
      uses.
- [ ] **nit**: The five SVGs in `public/` are create-next-app leftovers, used nowhere.
- [ ] **nit**: AGENTS.md says articles never run solvers as they render, but Gentle Introduction Part 2 calls
      `pullsOf`/`hauled` (small linear solves). Say "the slow solvers".
- [ ] **nit**: `vitest.config.mts:9` excludes `.claude/worktrees`, which its `include` can't match anyway, while
      `tsconfig.json` and ESLint would pick up a worktree there.

## Done well

- The physics checks really are independent of the solvers: the ute test balances moments about the rear axle while
  the solver uses the front; the four-point test checks the path over the edge by its equal angles; the body-belay
  test works out the capstan wrap again; the ladder checks have their own rope path.
- `KNOWN_FAILURES` as `it.fails` tests keeps known solver bugs in sight.
- The multi-point anchor solver uses an exact gradient and Hessian with a damped Newton step, and came through 20,000
  random setups with no failures or NaN. Four-point's `planAt` is continuous across its stages.
- Every number in the standing body belays article matches its figures JSON, and its figures are typed from
  `ReturnType<typeof compute>`, so a change in shape fails the type check before the hash does.
- `pulley-systems.test.ts` checks against conservation of rope, work and overall balance, not the solver's working.
- Readouts keep the same rows, using "—", so panels don't jump. `RopeSlider` and `LinkButton` have good accessible
  names, and slack ropes are dashed and labelled, not shown by colour alone.
- The visual introduction's `Share` uses `useSyncExternalStore` with a server value, so it can't cause a hydration
  mismatch, and every item in `docs/visual-review.md` is ticked and the serious ones are fixed in the code.
