import { describe, expect, it } from "vitest";
import { add, cross, len, scale, sub, vec, type Vec } from "@/lib/vec";
import { PAST_EDGE, WAIST_HEIGHT, solveBelay, type BelayResult, type Setup, type V3 } from "./body-belay-solver";

const G = 9.81;

/** The page's inputs, in its units (masses in kg). */
type Inputs = {
  wallHeight: number;
  belayerBack: number;
  gap: number;
  belayerMass: number;
  grip: number;
  stretcherMass: number;
  teamDistance: number;
  teamPull: number;
};

const DEFAULTS: Inputs = {
  wallHeight: 4,
  belayerBack: 2,
  gap: 1,
  belayerMass: 80,
  grip: 0.6,
  stretcherMass: 80,
  teamDistance: 6,
  teamPull: 200,
};

function setupFor(inputs: Partial<Inputs>): Setup {
  const i = { ...DEFAULTS, ...inputs };
  const s: Setup = {
    wallHeight: i.wallHeight,
    belayerBack: i.belayerBack,
    gap: i.gap,
    belayerWeight: i.belayerMass * G,
    grip: i.grip,
    teamDistance: i.teamDistance,
    teamPull: i.teamPull,
    barLength: 2,
    barWeight: i.stretcherMass * G,
  };
  return s;
}

/** A seeded stream of random inputs across the page's slider ranges. */
function randomInputs(count: number, seed = 7): Inputs[] {
  let state = seed;
  const rand = () => (state = (state * 1103515245 + 12345) % 2147483648) / 2147483648;
  const pick = (lo: number, hi: number, step: number) =>
    Math.round((lo + Math.round((rand() * (hi - lo)) / step) * step) * 100) / 100;
  return Array.from({ length: count }, () => ({
    wallHeight: pick(2, 6, 0.1),
    belayerBack: pick(2, 5, 0.05),
    gap: pick(0, 6, 0.1),
    belayerMass: pick(40, 150, 1),
    grip: pick(0.1, 1.2, 0.05),
    stretcherMass: pick(1, 200, 1),
    teamDistance: pick(4, 10, 0.1),
    teamPull: pick(10, 1000, 10),
  }));
}

const v3 = (x: number, y: number, z: number): V3 => ({ x, y, z });
const add3 = (a: V3, b: V3) => v3(a.x + b.x, a.y + b.y, a.z + b.z);
const sub3 = (a: V3, b: V3) => v3(a.x - b.x, a.y - b.y, a.z - b.z);
const scale3 = (a: V3, k: number) => v3(a.x * k, a.y * k, a.z * k);
const len3 = (a: V3) => Math.hypot(a.x, a.y, a.z);
const unit3 = (a: V3) => scale3(a, 1 / len3(a));
const cross3 = (a: V3, b: V3) => v3(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);

/**
 * Everything wrong with the belayers and stretcher, checked against the physics directly rather than how the
 * solver works. The belayer checked is the one on the z > 0 side; the other is their mirror image.
 */
function violations(s: Setup, r: BelayResult): string[] {
  if (r.kind === "none") return [`no solution: ${r.reason}`];
  const { l, b } = r;
  const out: string[] = [];
  const fTol = 1e-3 * (s.barWeight + s.belayerWeight + s.teamPull);
  const h = s.wallHeight;
  const feet = v3(-s.belayerBack, h, s.gap / 2);
  if (len3(sub3(b.feet, feet)) > 1e-9) out.push("feet in the wrong place");
  if (Math.abs(Math.hypot(b.facing.x, b.facing.z) - 1) > 1e-9) out.push("facing isn't a direction");
  const up = v3(-Math.sin(b.lean) * b.facing.x, Math.cos(b.lean), -Math.sin(b.lean) * b.facing.z);
  if (len3(sub3(b.waist, add3(feet, scale3(up, WAIST_HEIGHT)))) > 1e-9) out.push("waist isn't on the body");
  if (len(sub(l.anchor, vec(b.waist.x, b.waist.y))) > 1e-9) out.push("side on, the ropes aren't tied at the waist");

  // Each rope takes the shortest path from the waist to the stretcher's end, over the edge when it wraps:
  // unfolded about the edge, a straight line. Side on, it's paid out to just past the edge.
  const end = v3(l.barEnd1.x, l.barEnd1.y, 0);
  const toEdge = Math.hypot(b.waist.x, b.waist.y - h);
  const path = l.wrapEdge ? Math.hypot(toEdge + len(sub(l.barEnd1, vec(0, h))), b.waist.z) : len3(sub3(end, b.waist));
  const paidOut = Math.hypot(toEdge + PAST_EDGE, b.waist.z);
  if (path > paidOut + 1e-3) out.push(`rope stretched by ${(path - paidOut).toFixed(4)} m`);
  if (Math.abs(r.rope - paidOut) > 1e-9) out.push("rope isn't just past the edge");
  if (l.ropeTaut && Math.abs(path - r.rope) > 1e-3) out.push("taut rope isn't on its shortest path");
  const crossing = r.edgeCrossing;
  if (!!crossing !== !!l.wrapEdge) out.push("edge crossing doesn't match the wrap");
  if (crossing) {
    if (Math.abs(crossing.x) > 1e-9 || Math.abs(crossing.y - h) > 1e-9) out.push("crossing isn't on the edge");
    if (Math.abs(len3(sub3(crossing, b.waist)) + len3(sub3(end, crossing)) - path) > 1e-6)
      out.push("rope doesn't cross the edge on its shortest path");
  }

  // The rope's tension pulls the waist along its first run and the stretcher along its last; the two ropes'
  // sideways pulls on the stretcher cancel.
  const next = crossing ?? end;
  if (Math.abs(len3(b.pull) - r.tension) > fTol) out.push("belayer's pull isn't the rope's tension");
  if (r.tension > fTol && len3(sub3(unit3(b.pull), unit3(sub3(next, b.waist)))) > 1e-3)
    out.push("rope pulls the belayer the wrong way");
  const last = unit3(sub3(crossing ?? b.waist, end));
  if (len(sub(l.t1, vec(2 * r.tension * last.x, 2 * r.tension * last.y))) > fTol)
    out.push("ropes' pull on the stretcher isn't both tensions");
  const angle = Math.acos(Math.min(1, last.x * last.x + last.y * last.y - last.z * last.z));
  if (r.tension > fTol && Math.abs(angle - r.ropeAngle) > 1e-3) out.push("angle between ropes is wrong");

  // The belayer balances, and the push into their feet runs along their body (so nothing topples them).
  const net = add3(add3(b.pull, b.ground), v3(0, -s.belayerWeight, 0));
  if (len3(net) > fTol) out.push(`forces on the belayer don't balance by ${len3(net).toFixed(2)} N`);
  if (len3(cross3(up, b.ground)) > 2e-3 * len3(b.ground)) out.push("ground's push isn't along the body");
  if (b.ground.y <= 0) out.push("feet lift");
  if (Math.abs(b.gripNeeded - Math.hypot(b.ground.x, b.ground.z) / b.ground.y) > 1e-9) out.push("grip needed is wrong");
  if (b.holds !== b.gripNeeded <= s.grip) out.push("holds doesn't match the grip");

  // The stretcher balances too.
  const forces: { at: Vec; f: Vec }[] = [
    { at: scale(add(l.barEnd1, l.barEnd2), 0.5), f: vec(0, -s.barWeight) },
    { at: l.barEnd1, f: l.t1 },
    { at: l.barEnd2, f: l.t2 },
    ...l.contacts.map((c) => ({ at: c.point, f: c.force })),
  ];
  const sum = forces.reduce((acc, x) => add(acc, x.f), vec(0, 0));
  if (len(sum) > fTol) out.push(`forces on the stretcher don't balance by ${len(sum).toFixed(2)} N`);
  const torque = forces.reduce((acc, x) => acc + cross(sub(x.at, l.barEnd1), x.f), 0);
  if (Math.abs(torque) > fTol) out.push(`torques on the stretcher don't balance by ${torque.toFixed(2)} N·m`);
  return out;
}

describe("body belay: physics rules", () => {
  it("hold for random setups across the sliders' ranges", { timeout: 120_000 }, () => {
    const failures = randomInputs(150)
      .map((i) => {
        const s = setupFor(i);
        return { inputs: i, problems: violations(s, solveBelay(s)) };
      })
      .filter((f) => f.problems.length > 0);
    expect(failures).toEqual([]);
  });
});

describe("body belay", () => {
  const solved = (inputs: Partial<Inputs>) => {
    const s = setupFor(inputs);
    const r = solveBelay(s);
    expect(violations(s, r)).toEqual([]);
    if (r.kind !== "belayed") throw new Error(r.reason);
    return r;
  };

  it("shares the load evenly between ropes side by side", () => {
    const r = solved({ gap: 0 });
    expect(r.ropeAngle).toBe(0);
    expect(r.tension).toBeCloseTo(len(r.l.t1) / 2, 6);
  });

  it("two belayers of the stretcher's weight hold it just over the edge on ordinary footing", () => {
    expect(solved({}).b.holds).toBe(true);
  });

  it("loads each rope and belayer more the wider the ropes open", () => {
    const [near, far] = [solved({ gap: 1 }), solved({ gap: 6 })];
    expect(far.ropeAngle).toBeGreaterThan(near.ropeAngle);
    expect(far.tension).toBeGreaterThan(near.tension);
    expect(far.b.gripNeeded).toBeGreaterThan(near.b.gripNeeded);
    expect(far.b.holds).toBe(false);
  });

  it("leans further the harder the ground team pulls", () => {
    expect(solved({ teamPull: 600 }).b.lean).toBeGreaterThan(solved({ teamPull: 50 }).b.lean);
  });
});
