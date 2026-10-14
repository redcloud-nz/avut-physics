import { describe, expect, it } from "vitest";
import { add, cross, len, scale, sub, unit, vec, type Vec } from "@/lib/vec";
import { ropePathFor } from "./ladder-hinge-held";
import {
  TEAM_HEIGHT,
  TEAM_REACH,
  linePathFor,
  maxRope,
  minRope,
  solveLower,
  type LowerResult,
  type Setup,
} from "./two-point-lower-solver";

const G = 9.81;

/** The page's inputs, in its units (masses in kg). */
type Inputs = {
  wallHeight: number;
  anchorUp: number;
  anchorBack: number;
  stretcherMass: number;
  teamDistance: number;
  teamPull: number;
  /** Clamped to the rope lengths the page allows, as the page does. */
  rope: number;
};

const DEFAULTS: Inputs = {
  wallHeight: 4,
  anchorUp: 0.5,
  anchorBack: 2,
  stretcherMass: 80,
  teamDistance: 6,
  teamPull: 200,
  rope: 3,
};

function setupFor(inputs: Partial<Inputs>): Setup {
  const i = { ...DEFAULTS, ...inputs };
  const s: Setup = {
    wallHeight: i.wallHeight,
    anchorUp: i.anchorUp,
    anchorBack: i.anchorBack,
    rope: 0,
    teamDistance: i.teamDistance,
    teamPull: i.teamPull,
    barLength: 2,
    barWeight: i.stretcherMass * G,
  };
  s.rope = Math.min(Math.max(i.rope, Math.ceil(minRope(s) * 100) / 100), Math.floor(maxRope(s) * 100) / 100);
  return s;
}

/** A seeded stream of random inputs across the page's slider ranges, the rope anywhere in its range. */
function randomInputs(count: number, seed = 1): Inputs[] {
  let state = seed;
  const rand = () => (state = (state * 1103515245 + 12345) % 2147483648) / 2147483648;
  const pick = (lo: number, hi: number, step: number) =>
    Math.round((lo + Math.round((rand() * (hi - lo)) / step) * step) * 100) / 100;
  return Array.from({ length: count }, () => ({
    wallHeight: pick(2, 6, 0.1),
    anchorUp: pick(0.1, 2, 0.05),
    anchorBack: pick(2, 5, 0.05),
    stretcherMass: pick(1, 200, 1),
    teamDistance: pick(4, 10, 0.1),
    teamPull: pick(10, 1000, 10),
    rope: pick(0, 14, 0.05),
  }));
}

/** A short name for the arrangement, e.g. "hanging", "edge+top", "ground, team holding" or "none: <reason>". */
function arrangement(r: LowerResult): string {
  if (r.kind === "none") return `none: ${r.reason}`;
  const parts = [
    r.l.contacts
      .map((c) => c.surface)
      .sort()
      .join("+") || "hanging",
  ];
  if (!r.l.ropeTaut) parts.push("rope slack");
  if (r.l.teamHolding) parts.push("team holding");
  return parts.join(", ");
}

/** Everything wrong with a result, checked against the physics directly rather than how the solver works. */
function violations(s: Setup, r: LowerResult): string[] {
  if (r.kind === "none") return [`no solution: ${r.reason}`];
  const l = r.l;
  const W = s.barWeight;
  const tol = 1e-3;
  const fTol = 1e-3 * (W + s.teamPull);
  const out: string[] = [];
  const P1 = l.barEnd1;
  const P2 = l.barEnd2;
  const h = s.wallHeight;
  const edge = vec(0, h);
  const anchor = vec(-s.anchorBack, h + s.anchorUp);
  const team = vec(s.teamDistance, TEAM_HEIGHT);

  if (Math.abs(len(sub(P2, P1)) - s.barLength) > tol) out.push("stretcher isn't 2 m long");

  // The rope can't stretch, and pulls only along its last run when taut.
  const rope = ropePathFor(s, P1);
  if (rope.length > s.rope + tol) out.push(`rope stretched by ${(rope.length - s.rope).toFixed(4)} m`);
  if (l.ropeTaut && rope.length < s.rope - tol) out.push("rope pulls while slack");
  if (len(l.t1) > fTol && len(sub(unit(l.t1), unit(sub(rope.wrapEdge ?? anchor, P1)))) > tol)
    out.push("rope pulls the wrong way");

  // The team pulls steadily along the line, unless they're holding its end within reach.
  const line = linePathFor(s, P2);
  const lineDir = unit(sub(line.via ?? team, P2));
  if (len(l.t2) > fTol && len(sub(unit(l.t2), lineDir)) > tol) out.push("line pulls the wrong way");
  if (len(l.t2) > s.teamPull + fTol) out.push("line pulls harder than the team");
  // Within the team's reach the line can only hang slack: nearer still, it carries nothing.
  const reach = len(sub(P2, team));
  if (!l.teamHolding && Math.abs(len(l.t2) - s.teamPull) > fTol) out.push("line isn't at the team's pull");
  if (l.teamHolding && reach > TEAM_REACH + tol) out.push("team holds an end out of reach");
  if (reach < TEAM_REACH - tol && len(l.t2) > fTol) out.push("line pulls within the team's reach");

  // Nothing passes through the ground or the wall.
  for (const P of [P1, P2]) {
    if (P.y < -tol) out.push("end below the ground");
    if (P.x < -tol && P.y < h - tol) out.push("end inside the wall");
  }
  const [a, b] = P1.x < P2.x ? [P1, P2] : [P2, P1];
  if (a.x < -tol && b.x > tol && a.y + ((b.y - a.y) * -a.x) / (b.x - a.x) < h - tol)
    out.push("stretcher cuts through the wall's corner");

  // Each contact touches its surface and only pushes, square to it.
  for (const c of l.contacts) {
    const f = c.force;
    const along = (n: Vec) => Math.abs(cross(n, f)) < fTol && f.x * n.x + f.y * n.y > 0;
    const ok =
      c.surface === "ground"
        ? Math.abs(c.point.y) < tol && along(vec(0, 1))
        : c.surface === "wall"
          ? Math.abs(c.point.x) < tol && c.point.y <= h + tol && along(vec(1, 0))
          : c.surface === "top"
            ? Math.abs(c.point.y - h) < tol && c.point.x <= tol && along(vec(0, 1))
            : len(sub(c.point, edge)) < tol;
    if (!ok) out.push(`${c.surface} contact is wrong`);
  }
  // The stretcher's edge contact pushes square to the stretcher (or out from the edge at an end).
  for (const c of l.contacts.filter((c) => c.surface === "edge")) {
    const d = unit(sub(P2, P1));
    const atEnd = Math.min(len(sub(c.point, P1)), len(sub(c.point, P2))) < tol;
    if (!atEnd && Math.abs(c.force.x * d.x + c.force.y * d.y) > fTol) out.push("edge pushes along the stretcher");
  }

  // The stretcher balances.
  const forces: { at: Vec; f: Vec }[] = [
    { at: scale(add(P1, P2), 0.5), f: vec(0, -W) },
    { at: P1, f: l.t1 },
    { at: P2, f: l.t2 },
    ...l.contacts.map((c) => ({ at: c.point, f: c.force })),
  ];
  const net = forces.reduce((sum, x) => add(sum, x.f), vec(0, 0));
  if (len(net) > fTol) out.push(`forces don't balance by ${len(net).toFixed(2)} N`);
  const torque = forces.reduce((sum, x) => sum + cross(sub(x.at, P1), x.f), 0);
  if (Math.abs(torque) > fTol) out.push(`torques don't balance by ${torque.toFixed(2)} N·m`);
  return out;
}

describe("two-point lower: physics rules", () => {
  it("hold for random setups across the sliders' ranges", { timeout: 60_000 }, () => {
    const failures = randomInputs(300)
      .map((i) => {
        const s = setupFor(i);
        const r = solveLower(s);
        return { inputs: i, arrangement: arrangement(r), problems: violations(s, r) };
      })
      .filter((f) => f.problems.length > 0);
    expect(failures).toEqual([]);
  });
});

describe("two-point lower", () => {
  it.each([
    ["the shortest rope: on the wall top, at its edge", { rope: 0 }, "edge"],
    ["over the edge", { rope: 1.5 }, "edge"],
    ["hanging clear of the wall", { rope: 3 }, "hanging"],
    ["line end on the ground", { rope: 5 }, "ground"],
    ["landed, a metre short of the team", { rope: 99 }, "ground+ground"],
    [
      "a hard pull: the team holds the end in mid-air",
      { teamDistance: 4, teamPull: 2000, rope: 5 },
      "hanging, team holding",
    ],
  ])("%s", (_, inputs, expected) => {
    const s = setupFor(inputs);
    const r = solveLower(s);
    expect(arrangement(r)).toBe(expected);
    expect(violations(s, r)).toEqual([]);
  });

  it("hangs further from the wall the harder the team pulls", () => {
    const gap = (teamPull: number) => {
      const r = solveLower(setupFor({ teamPull, rope: 3 }));
      if (r.kind !== "lowered") throw new Error(arrangement(r));
      return Math.min(r.l.barEnd1.x, r.l.barEnd2.x);
    };
    expect(gap(400)).toBeGreaterThan(gap(200));
    expect(gap(200)).toBeGreaterThan(gap(50));
  });
});
