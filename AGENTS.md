# AVUT Physics

Interactive physics visualisations and articles on rope rescue, served at physics.avut.nz. See
`README.md` for what's on the site and how it's laid out.

## Commands

```bash
npm test                   # Vitest
npm run test:sweep         # Ladder hinge sweep against its recorded snapshot (not part of npm test)
npm run figures            # Work out articles' figures again where they're out of date
npm run lint               # ESLint
npx tsc --noEmit -p .      # Type check
npm run format             # Prettier over everything
```

Before calling a change done, run the type check, lint and `npm test`. After touching a solver or
anything in `src/lib`, run `npm run test:sweep` too.

## Dev server

Next allows one `next dev` per checkout; a second one exits with "Another next dev server is
already running" and names the port the running one is on. If one is running, use it rather than
starting another (it reloads as files change). Check pages in a browser after changing anything
the user sees: passing tests don't show that a diagram draws correctly. The article's first load
compiles for around 20 seconds.

## Git

- Commit only when asked, then show the commit message used. Commit messages are a plain
  imperative sentence (no prefixes like `feat:`), with a body explaining why when it isn't obvious.
- Never push without explicit approval.
- Prettier runs on staged files in the pre-commit hook (husky and lint-staged), so commits come out
  formatted.

## Code layout

- `src/app/<route>/page.tsx`: thin pages. Visualisations render inside `VisualisationPage`.
- `src/visualisations/<name>.tsx`: the interactive client component (sliders, SVG diagram,
  readouts).
- `src/visualisations/<name>-solver.ts`: the physics, as pure functions of a setup with no React.
  Results are a union on `kind`; `{ kind: "none", reason }` explains on the page why there's no
  answer.
- `src/visualisations/<name>-notes.tsx` (and `-maths.tsx`): the "How this is calculated" section.
- `src/visualisations/index.ts`: the registry of visualisations listed on the home page.
- `src/articles/`: article figures. Article pages themselves are in `src/app`. Articles never run
  the visualisations' solvers as they render (small sums like the pulley systems' are fine): those
  solvers are too slow, and a page taking over a minute to build fails the Vercel build. Instead
  `<name>.compute.ts` holds an article's inputs and works out its figures, `npm run figures` saves
  them in `<name>.figures.json` (with a hash of the compute module and every local file it
  imports), and `<name>-figures.ts` gives the article them typed. `scripts/figures.mjs --check`
  runs before every build, and before every commit on what's staged, and fails when a hash no
  longer matches. After changing a solver, its shared maths or an article's inputs, run
  `npm run figures` and commit the JSON with the change. The hash is of the raw source, so
  `npm run figures` runs Prettier over those files first. Compute modules and what they import
  must use static imports only: the hash can't follow `import()`, `require()` or files read with
  `fs`, and the check fails on them.
- `src/visual/`: A Visual Introduction to Rescue Physics, served at `/visual/<slug>`. Each page is a
  folder in `pages/`: `page.tsx` (server) holds its name, headline, text and any details, and
  `figure.tsx` (client) its figure. `pages/index.ts` sets the order. Pieces several pages share
  are in `common/`, and `card.tsx` and `frame.tsx` are the chrome around every page and figure.
- `src/components/diagram/`: SVG primitives (`Arrow`, `Label`, `AngleArc`, `Cable`, `Pull`), slider
  controls, `Notice` and `NONE`. Drawing only, no maths. `src/components/notes.tsx` has the notes card
  (`NotesCard`, `Part`), and `use-in-browser.ts` the hook pages wait on before running a solver, since
  solvers' last digits can differ between the server and the browser.
- Colours come from the tokens in `src/app/globals.css`, named for what they show (`ink-muted`, `pull`, `mass`,
  `warning`): token classes (`text-ink-muted`, `fill-surface`) in `className`, and `var(--pull)` in SVG attributes and
  styles (the base name: a `--color-*` variable exists only once a class uses it). No hex values or Tailwind palette
  classes (`text-slate-400`) in components; add a token instead. The exceptions are the share image
  (`src/visual/share-image.tsx`, drawn without the stylesheet), `viewport.themeColor`, `src/components/ui` (shadcn's
  own overlays) and the articles' `print:` classes.
- `src/lib/`: all the shared maths. Use it rather than writing local helpers:
  - `vector2.ts`, `vector3.ts`: immutable `Vector2`/`Vector3` classes. Chain methods (`a.sub(b).len()`,
    `a.distanceTo(b)`); every operation returns a new vector.
  - `geometry.ts`: segment geometry. `numeric.ts`: Nelder–Mead, linear and least-squares solves,
    central differences, grid minima, golden-section search, bisection, and the `Matrix` alias
    (row-major `number[][]`). `wall.ts`: the wall the lowers share, its anchor and the rope's path
    over its edge.
  - `math.ts` (`clamp`, `deg`, `rad`, `linearScale`), `constants.ts` (`G`), `format.ts` (units
    for display), `random.ts` (the seeded picker tests use for random setups).

To add a visualisation: write the solver and its tests, the component and notes, register it in
`src/visualisations/index.ts` (and its `href` type), and add its page under `src/app`.

## Physics conventions

- Units are SI: metres, kilograms, newtons, radians (degrees only for display). Physics
  coordinates have y up, with x = 0 at the wall's face. SVG has y down, so diagrams flip y when
  drawing.
- Solvers find where things settle by minimising potential energy, then solve the balance of
  forces exactly at that position. Ropes only pull, surfaces only push.

## Tests

- Tests sit beside their source as `*.test.ts`. Physics checks (`violations()`, and
  `ladder-hinge-solver.checks.ts`) verify results against the physics directly. Keep them
  independent of the solvers: share primitives from `src/lib`, but never the solvers' own working,
  or a solver bug passes its own check.
- `KNOWN_FAILURES` in `ladder-hinge-solver.test.ts` lists setups the solver is known to get wrong.
  Each runs as an `it.fails` test, so when one gets fixed its test fails and it should come off the
  list.
- The sweep snapshot (`__snapshots__/ladder-hinge-sweep.txt`) records how 2000 random setups
  settle. A refactor must leave it byte-identical. Keep floating-point operations in the same order
  when restructuring numerical code: reordering them can move borderline setups. A deliberate
  change to the model may move some setups; once the moves look right, record them with
  `npm run test:sweep -- -u`.

## Pages and writing

- Every page must work at phone width (about 400 px). Articles also have print styles
  (`print:` classes); keep site chrome out of print.
- Page text is plain and direct, in NZ English (metres, centre, -ise); code identifiers follow
  their APIs (`color`, `center`). State assumptions and shortcuts openly in each page's "How this
  is calculated" section. Explain jargon or avoid it.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
