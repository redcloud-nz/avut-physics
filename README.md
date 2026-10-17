# AVUT Physics

Interactive physics visualisations and articles on rope rescue, online at
[physics.avut.nz](https://physics.avut.nz). Each visualisation works out where a rescue system
settles and the forces through it, and lets you change the setup with sliders to see what moves.

## What's on the site

**Visualisations**

- **Ladder Hinge Lower** (`/ladder-hinge-lower`): a ladder hinged at the base of a wall, with a
  stretcher hanging from it on a rope from an anchor behind the wall and an attachment to the
  ladder. Either the system settles where it balances, or a ground team holds the ladder.
- **Two-Point Lower** (`/two-point-lower`): a stretcher lowered over a wall on a rope from an
  anchor, with a ground team pulling a line from its other end to keep it off the wall.
- **Four-Point Lower** (`/four-point-lower`): a stretcher taken from the floor beside a slot,
  out over it and down, on four ropes from its corners to belays beside the slot. Each belayer's
  rope has its own slider, linkable in pairs or all four; the stretcher goes where the ropes put it.
- **Body-Belayed Two-Point Lower** (`/body-belay`): the same lower with no anchor, held by two
  belayers standing on the wall top with the rope round their waists. Shows whether their feet
  grip.
- **Block on an Incline** (`/block-on-an-incline`): a free-body diagram with static and kinetic
  friction. Not listed on the home page.

**Articles**

- **Standing Body Belays** (`/standing-body-belays`): how much grip a belayer's boots need to hold
  a stretcher still, and why even the best case leaves too little margin.

Each visualisation page ends with a "How this is calculated" section setting out the model and
its assumptions.

## Running it

Needs Node.js 20.9 or later.

```bash
npm install
npm run dev              # http://localhost:3000
```

| Command              | What it does                                                                       |
| -------------------- | ---------------------------------------------------------------------------------- |
| `npm test`           | Runs the tests (Vitest)                                                            |
| `npm run test:sweep` | Runs the ladder hinge sweep: 2000 random setups against a recorded snapshot        |
| `npm run figures`    | Works out the articles' figures again where they're out of date                    |
| `npm run lint`       | ESLint                                                                             |
| `npx tsc --noEmit`   | Type check                                                                         |
| `npm run format`     | Formats everything with Prettier (also run on staged files by the pre-commit hook) |
| `npm run build`      | Production build                                                                   |

## How it's built

A [Next.js](https://nextjs.org) app with React, Tailwind CSS, and maths typeset on the server by
MathJax. The diagrams are plain SVG.

```
src/
  app/                  One folder per page; each page is a thin wrapper
  visualisations/       Each visualisation's component, solver, notes and tests
  articles/             The articles' figures
  components/diagram/   SVG primitives (arrows, labels, angle arcs) and slider controls
  lib/                  Shared maths: Vector2/Vector3, segment geometry, numerical methods
```

The physics lives in the solvers (`src/visualisations/*-solver.ts`): plain functions that take a
setup and return where everything settles and the forces involved. They don't depend on React,
so the tests can run them over thousands of random setups. The tests check each result against
the physics directly: everything balances, ropes only pull, surfaces only push, and nothing passes
through anything else. They don't reuse the solvers' own working.

The solvers find the resting position by minimising potential energy (with Nelder–Mead), then
solve the balance of forces exactly at that position. The numerical methods are in
`src/lib/numeric.ts`.

The articles quote figures from the same solvers, too many to work out as the site builds. Each
article's `src/articles/<name>.compute.ts` works them out, and `npm run figures` saves them in
`<name>.figures.json`, which the article reads. The file records a hash of the compute module and
every local file it imports, so changing an article's inputs or a solver it uses marks its figures
out of date, and the build and the pre-commit hook refuse to go on until they're worked out again.

## Licence

[MIT](LICENSE.md)
