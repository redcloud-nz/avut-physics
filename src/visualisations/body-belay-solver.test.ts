import { describe, expect, it } from "vitest";
import { G } from "@/lib/constants";
import { seededPicker } from "@/lib/random";
import { Vector2, vec2 } from "@/lib/vector2";
import { vec3 } from "@/lib/vector3";
import { PAST_EDGE, WAIST_HEIGHT, solveBelay, type BelayResult, type Setup } from "./body-belay-solver";

/** The page's inputs, in its units (masses in kg). */
type Inputs = {
  wallHeight: number;
  belayerBack: number;
  gap: number;
  belayerMass: number;
  grip: number;
  edgeFriction: number;
  stretcherMass: number;
  teamDistance: number;
  teamPull: number;
};

const DEFAULTS: Inputs = {
  wallHeight: 4,
  belayerBack: 3,
  gap: 2,
  belayerMass: 80,
  grip: 0.5,
  edgeFriction: 0.2,
  stretcherMass: 90,
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
    edgeFriction: i.edgeFriction,
    teamDistance: i.teamDistance,
    teamPull: i.teamPull,
    barLength: 2,
    barWeight: i.stretcherMass * G,
  };
  return s;
}

/** A seeded stream of random inputs across the page's slider ranges. */
function randomInputs(count: number, seed = 7): Inputs[] {
  const pick = seededPicker(seed);
  return Array.from({ length: count }, () => ({
    wallHeight: pick(2, 6, 0.1),
    belayerBack: pick(2, 5, 0.05),
    gap: pick(0, 6, 0.1),
    belayerMass: pick(40, 150, 1),
    grip: pick(0.1, 1.2, 0.05),
    edgeFriction: pick(0, 0.6, 0.05),
    stretcherMass: pick(1, 200, 1),
    teamDistance: pick(4, 10, 0.1),
    teamPull: pick(10, 1000, 10),
  }));
}

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
  const feet = vec3(-s.belayerBack, h, s.gap / 2);
  if (b.feet.sub(feet).len() > 1e-9) out.push("feet in the wrong place");
  if (Math.abs(Math.hypot(b.facing.x, b.facing.z) - 1) > 1e-9) out.push("facing isn't a direction");
  const up = vec3(-Math.sin(b.lean) * b.facing.x, Math.cos(b.lean), -Math.sin(b.lean) * b.facing.z);
  if (b.waist.sub(feet.add(up.scale(WAIST_HEIGHT))).len() > 1e-9) out.push("waist isn't on the body");
  if (l.anchor.sub(b.waist.xy()).len() > 1e-9) out.push("side on, the ropes aren't tied at the waist");

  // Each rope takes the shortest path from the waist to the stretcher's end, over the edge when it wraps:
  // unfolded about the edge, a straight line. Side on, it's paid out to just past the edge.
  const end = vec3(l.barEnd1.x, l.barEnd1.y, 0);
  const toEdge = Math.hypot(b.waist.x, b.waist.y - h);
  const path = l.wrapEdge ? Math.hypot(toEdge + l.barEnd1.sub(vec2(0, h)).len(), b.waist.z) : end.sub(b.waist).len();
  const paidOut = Math.hypot(toEdge + PAST_EDGE, b.waist.z);
  if (path > paidOut + 1e-3) out.push(`rope stretched by ${(path - paidOut).toFixed(4)} m`);
  if (Math.abs(r.rope - paidOut) > 1e-9) out.push("rope isn't just past the edge");
  if (l.ropeTaut && Math.abs(path - r.rope) > 1e-3) out.push("taut rope isn't on its shortest path");
  const crossing = r.edgeCrossing;
  if (!!crossing !== !!l.wrapEdge) out.push("edge crossing doesn't match the wrap");
  if (crossing) {
    if (Math.abs(crossing.x) > 1e-9 || Math.abs(crossing.y - h) > 1e-9) out.push("crossing isn't on the edge");
    if (Math.abs(crossing.sub(b.waist).len() + end.sub(crossing).len() - path) > 1e-6)
      out.push("rope doesn't cross the edge on its shortest path");
  }

  // The rope's tension pulls the waist along its first run and the stretcher along its last; the two ropes'
  // sideways pulls on the stretcher cancel.
  const next = crossing ?? end;
  if (Math.abs(b.pull.len() - r.tension) > fTol) out.push("belayer's pull isn't the rope's tension");
  if (r.tension > fTol && b.pull.unit().sub(next.sub(b.waist).unit()).len() > 1e-3)
    out.push("rope pulls the belayer the wrong way");
  const last = (crossing ?? b.waist).sub(end).unit();
  if (l.t1.sub(vec2(2 * r.loadTension * last.x, 2 * r.loadTension * last.y)).len() > fTol)
    out.push("ropes' pull on the stretcher isn't both tensions");

  // Sliding over the edge towards the stretcher, each rope loses tension to the edge's friction by the capstan rule,
  // over the angle it turns through there.
  const first = next.sub(b.waist).unit();
  const wrap = crossing
    ? Math.acos(Math.min(1, Math.max(-1, -(first.x * last.x + first.y * last.y + first.z * last.z))))
    : 0;
  if (Math.abs(wrap - r.wrap) > 1e-6) out.push("rope's wrap over the edge is wrong");
  if (Math.abs(r.tension - r.loadTension * Math.exp(-s.edgeFriction * wrap)) > fTol)
    out.push("edge friction doesn't take the capstan rule's share");
  const angle = Math.acos(Math.min(1, last.x * last.x + last.y * last.y - last.z * last.z));
  if (r.tension > fTol && Math.abs(angle - r.ropeAngle) > 1e-3) out.push("angle between ropes is wrong");

  // The belayer balances, and the push into their feet runs along their body (so nothing topples them).
  const net = b.pull.add(b.ground).add(vec3(0, -s.belayerWeight, 0));
  if (net.len() > fTol) out.push(`forces on the belayer don't balance by ${net.len().toFixed(2)} N`);
  if (up.cross(b.ground).len() > 2e-3 * b.ground.len()) out.push("ground's push isn't along the body");
  if (b.ground.y <= 0) out.push("feet lift");
  if (Math.abs(b.gripNeeded - Math.hypot(b.ground.x, b.ground.z) / b.ground.y) > 1e-9) out.push("grip needed is wrong");
  if (b.holds !== b.gripNeeded <= s.grip) out.push("holds doesn't match the grip");
  const capacity = s.grip * b.ground.y;
  const needed = Math.hypot(b.ground.x, b.ground.z);
  if (Math.abs(b.safety - capacity / needed) > 1e-9 * b.safety)
    out.push("safety factor isn't friction available over needed");

  // The stretcher balances too.
  const forces: { at: Vector2; f: Vector2 }[] = [
    { at: l.barEnd1.add(l.barEnd2).scale(0.5), f: vec2(0, -s.barWeight) },
    { at: l.barEnd1, f: l.t1 },
    { at: l.barEnd2, f: l.t2 },
    ...l.contacts.map((c) => ({ at: c.point, f: c.force })),
  ];
  const sum = forces.reduce((acc, x) => acc.add(x.f), Vector2.ZERO);
  if (sum.len() > fTol) out.push(`forces on the stretcher don't balance by ${sum.len().toFixed(2)} N`);
  const torque = forces.reduce((acc, x) => acc + x.at.sub(l.barEnd1).cross(x.f), 0);
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
    const r = solved({ gap: 0, edgeFriction: 0 });
    expect(r.ropeAngle).toBe(0);
    expect(r.tension).toBeCloseTo(r.l.t1.len() / 2, 6);
  });

  it("eases the belayers' load the more the edge grips the rope, without moving the stretcher", () => {
    const [none, steel, concrete] = [0, 0.2, 0.55].map((edgeFriction) => solved({ edgeFriction }));
    expect(steel.loadTension).toBeCloseTo(none.loadTension, 0);
    expect(steel.tension).toBeLessThan(none.tension);
    expect(concrete.tension).toBeLessThan(steel.tension);
    expect(concrete.b.gripNeeded).toBeLessThan(none.b.gripNeeded);
  });

  it("two belayers on dry painted steel hold a patient on a stretcher just over the edge only with its friction", () => {
    expect(solved({}).b.holds).toBe(true);
    expect(solved({ edgeFriction: 0 }).b.holds).toBe(false);
    expect(solved({ grip: 0.25, edgeFriction: 0.55 }).b.holds).toBe(false);
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
