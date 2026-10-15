import { describe, expect, it } from "vitest";
import { solve } from "./ladder-hinge-solver";
import { arrangement, randomInputs, setupFor, violations, type Inputs } from "./ladder-hinge-solver.checks";

/** Setups the solver is known to get wrong. When one is fixed its `it.fails` test fails: remove it from here. */
const KNOWN_FAILURES: { why: string; inputs: Inputs }[] = [
  {
    why: "light ladder, heavy stretcher resting on the wall top: the ladder's torques don't balance",
    inputs: {
      wallHeight: 5.3,
      ladderLength: 6.8,
      attachAbove: 1.3,
      ladderMass: 16,
      stretcherMass: 116,
      attachmentLength: 0.1,
      anchorUp: 0.9,
      anchorBack: 2.1,
      rope: 2.7,
    },
  },
  {
    why: "stretcher lying flat on the ladder: the ladder's torques are slightly off",
    inputs: {
      wallHeight: 3.1,
      ladderLength: 6.5,
      attachAbove: 2.7,
      ladderMass: 51,
      stretcherMass: 146,
      attachmentLength: 0.4,
      anchorUp: 1.7,
      anchorBack: 2.4,
      rope: 2.75,
    },
  },
];

const isKnownFailure = (i: Inputs) => KNOWN_FAILURES.some((k) => JSON.stringify(k.inputs) === JSON.stringify(i));

describe("physics rules", () => {
  it("hold for random setups across the sliders' ranges", { timeout: 60_000 }, () => {
    const failures = randomInputs(400)
      .filter((i) => !isKnownFailure(i))
      .map((i) => {
        const s = setupFor(i);
        const r = solve(s);
        return { inputs: i, arrangement: arrangement(r), problems: violations(s, r) };
      })
      .filter((f) => f.problems.length > 0);
    expect(failures).toEqual([]);
  });

  for (const k of KNOWN_FAILURES) {
    it.fails(`known failure: ${k.why}`, () => {
      const s = setupFor(k.inputs);
      expect(violations(s, solve(s))).toEqual([]);
    });
  }
});

/** One setup for each arrangement the page can show, and what it should settle into. */
const SCENARIOS: [string, Partial<Inputs>][] = [
  [
    "raised: hanging",
    {
      wallHeight: 3,
      ladderLength: 7,
      attachAbove: 0.1,
      stretcherMass: 20,
      ladderMass: 80,
      attachmentLength: 0.5,
      anchorUp: 2,
      anchorBack: 3,
      rope: 4,
    },
  ],
  [
    "raised: hanging, leaning",
    { wallHeight: 2, ladderLength: 7, attachAbove: 1, stretcherMass: 150, ladderMass: 80, anchorBack: 3, rope: 0 },
  ],
  [
    "raised: hanging, ladder down",
    { wallHeight: 2, ladderLength: 5, attachAbove: 1, stretcherMass: 20, attachmentLength: 0.5, anchorUp: 2, rope: 4 },
  ],
  [
    "raised: edge",
    {
      wallHeight: 2,
      ladderLength: 7,
      attachAbove: 1,
      stretcherMass: 20,
      ladderMass: 5,
      attachmentLength: 1,
      anchorBack: 3,
      rope: 2.5,
    },
  ],
  [
    "raised: edge+top",
    { wallHeight: 3, attachAbove: 0.1, ladderMass: 80, attachmentLength: 1, anchorUp: 2, anchorBack: 5, rope: 4 },
  ],
  [
    "raised: top",
    {
      wallHeight: 2.5,
      ladderLength: 7,
      attachAbove: 1,
      stretcherMass: 150,
      ladderMass: 80,
      attachmentLength: 0.5,
      anchorUp: 1,
      anchorBack: 3,
      rope: 2.5,
    },
  ],
  [
    "raised: top, leaning",
    {
      ladderLength: 7,
      attachAbove: 1,
      stretcherMass: 150,
      ladderMass: 5,
      attachmentLength: 0.5,
      anchorUp: 1,
      anchorBack: 5,
      rope: 3,
    },
  ],
  [
    "raised: wall",
    {
      wallHeight: 5,
      ladderLength: 5.5,
      attachAbove: 0.3,
      ladderMass: 78,
      stretcherMass: 55,
      attachmentLength: 0.3,
      anchorUp: 0.55,
      anchorBack: 3,
      rope: 3.05,
    },
  ],
  ["hinged: rope", {}],
  [
    "hinged: rope, leaning",
    {
      wallHeight: 2.5,
      ladderLength: 5,
      attachAbove: 1,
      stretcherMass: 150,
      attachmentLength: 0.5,
      anchorUp: 2,
      rope: 0,
    },
  ],
  [
    "hinged: rope, ladder down",
    { wallHeight: 3, ladderLength: 7, stretcherMass: 150, ladderMass: 5, anchorUp: 2, rope: 6 },
  ],
  [
    "hinged: rope, ladder down, slid",
    { wallHeight: 2, attachAbove: 0.1, stretcherMass: 20, attachmentLength: 1, rope: 2.5 },
  ],
  ["hinged: top", { wallHeight: 5, ladderLength: 7, stretcherMass: 20, anchorUp: 2, anchorBack: 5, rope: 0 }],
  [
    "hinged: top, rope slack, leaning",
    { ladderLength: 5, stretcherMass: 20, ladderMass: 5, attachmentLength: 0.5, anchorBack: 5, rope: 2.5 },
  ],
  ["hinged: edge", { wallHeight: 2, stretcherMass: 150, anchorUp: 1, anchorBack: 3, rope: 3 }],
  [
    "hinged: flat, ladder down, rope slack",
    { wallHeight: 5, attachAbove: 1, ladderMass: 80, attachmentLength: 1, anchorUp: 1, rope: 10 },
  ],
  [
    "none: The stretcher would lift off the ladder, into a position this model can't find.",
    { wallHeight: 3, attachAbove: 0.1, ladderMass: 80, anchorBack: 5, rope: 5 },
  ],
  [
    "none: The rope is too short for the stretcher to reach over the wall's edge.",
    {
      wallHeight: 3.5,
      ladderLength: 6.5,
      attachAbove: 0.9,
      stretcherMass: 55,
      ladderMass: 65,
      attachmentLength: 0.1,
      anchorUp: 0.2,
      anchorBack: 2.5,
      rope: 0.5,
    },
  ],
  [
    "none: The rope is too short: the stretcher can't reach far enough over the wall's edge for the attachment to reach the ladder.",
    {
      wallHeight: 6,
      ladderLength: 6.1,
      attachAbove: 0.1,
      stretcherMass: 150,
      ladderMass: 75,
      attachmentLength: 0.3,
      anchorUp: 1.6,
      anchorBack: 5,
      rope: 0.5,
    },
  ],
];

describe("arrangements", () => {
  it.each(SCENARIOS)("%s", (expected, inputs) => {
    const s = setupFor(inputs);
    const r = solve(s);
    expect(arrangement(r)).toBe(expected);
    expect(violations(s, r)).toEqual([]);
  });
});

describe("forces", () => {
  it("default settings: the stretcher rests against the ladder", () => {
    const r = solve(setupFor({}));
    if (r.kind !== "hinged") throw new Error(arrangement(r));
    expect((r.h.phi * 180) / Math.PI).toBeCloseTo(49.33, 1);
    expect(r.h.t1.len()).toBeCloseTo(642.7, 0);
    expect(r.h.t2.len()).toBeCloseTo(641.7, 0);
    expect(r.h.beamPush.len()).toBeCloseTo(99.8, 0);
  });

  it("a slid foot: the rope and the ladder's push each carry half the stretcher, the attachment nothing", () => {
    const s = setupFor({ wallHeight: 2, attachAbove: 0.1, stretcherMass: 20, attachmentLength: 1, rope: 2.5 });
    const r = solve(s);
    if (r.kind !== "hinged") throw new Error(arrangement(r));
    expect(r.h.beamCableTaut).toBe(false);
    expect(r.h.t2.len()).toBe(0);
    expect(r.h.t1.len()).toBeCloseTo(s.barWeight / 2, 0);
    expect(r.h.beamPush.len()).toBeCloseTo(s.barWeight / 2, 0);
  });
});
