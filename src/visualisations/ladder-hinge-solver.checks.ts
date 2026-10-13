import { add, cross, len, scale, sub, unit, vec, type Vec } from "@/lib/vec";
import type { HeldResult } from "./ladder-hinge-held";
import { minWallCable, type Result, type Setup } from "./ladder-hinge-solver";

/**
 * Test helpers for the ladder hinge solver: building setups the way the page does, naming the arrangement a
 * result is in, and checking a result against the physics independently of how the solver found it.
 */

const G = 9.81;

/** The page's inputs, in its units (masses in kg). */
export type Inputs = {
  wallHeight: number;
  /** How far along the ladder past the wall height the attachment is. */
  attachAbove: number;
  ladderLength: number;
  ladderMass: number;
  stretcherMass: number;
  attachmentLength: number;
  anchorUp: number;
  anchorBack: number;
  /** Raised to the shortest rope the page allows, as the page does. */
  rope: number;
};

export const DEFAULTS: Inputs = {
  wallHeight: 4,
  attachAbove: 0.5,
  ladderLength: 6.4,
  ladderMass: 30,
  stretcherMass: 80,
  attachmentLength: 0.25,
  anchorUp: 0.5,
  anchorBack: 2,
  rope: 3,
};

/** The solver's setup for the page's inputs (2 m stretcher, 10 cm ladder, 8 cm stretcher). */
export function setupFor(inputs: Partial<Inputs>): Setup {
  const i = { ...DEFAULTS, ...inputs };
  const s: Setup = {
    wallHeight: i.wallHeight,
    anchorUp: i.anchorUp,
    anchorBack: i.anchorBack,
    wallCable: 0,
    beamCable: i.attachmentLength,
    beamLength: i.ladderLength,
    attachDistance: Math.min(i.ladderLength, i.wallHeight + i.attachAbove),
    barLength: 2,
    touchGap: (0.1 + 0.08) / 2,
    beamThickness: 0.1,
    beamWeight: i.ladderMass * G,
    barWeight: i.stretcherMass * G,
  };
  s.wallCable = Math.max(i.rope, Math.ceil(minWallCable(s) * 100) / 100);
  return s;
}

/** A seeded stream of random inputs across the page's slider ranges, rounded to the sliders' steps. */
export function randomInputs(count: number, seed = 1): Inputs[] {
  let state = seed;
  const rand = () => (state = (state * 1103515245 + 12345) % 2147483648) / 2147483648;
  const pick = (lo: number, hi: number, step: number) =>
    Math.round((lo + Math.round((rand() * (hi - lo)) / step) * step) * 100) / 100;
  return Array.from({ length: count }, () => {
    const wallHeight = pick(2, 6, 0.1);
    const ladderLength = pick(Math.round((wallHeight + 0.1) * 10) / 10, 7, 0.1);
    return {
      wallHeight,
      ladderLength,
      attachAbove: pick(0.1, Math.max(0.1, ladderLength - wallHeight), 0.1),
      ladderMass: pick(1, 100, 1),
      stretcherMass: pick(1, 200, 1),
      attachmentLength: pick(0.1, 1, 0.05),
      anchorUp: pick(0.1, 2, 0.05),
      anchorBack: pick(2, 5, 0.05),
      rope: pick(0, 10, 0.05),
    };
  });
}

/**
 * A short name for the arrangement, e.g. "raised: hanging", "raised: edge+top", "hinged: rope, ladder down,
 * slid" or "none: <reason>".
 */
export function arrangement(r: Result): string {
  if (r.kind === "none") return `none: ${r.reason}`;
  if (r.kind === "raised") {
    const e = r.eq;
    const parts = [
      e.contacts
        .map((c) => c.surface)
        .sort()
        .join("+") || "hanging",
    ];
    if (!e.hinge) parts.push("ladder down");
    if (e.wallOnBeam) parts.push("leaning");
    return `raised: ${parts.join(", ")}`;
  }
  const h = r.h;
  const parts = [h.lyingFlat ? "flat" : (h.barContact?.surface ?? "rope")];
  if (h.phi === 0) parts.push("ladder down");
  if (!h.beamCableTaut) parts.push("slid");
  if (!h.cableTaut) parts.push("rope slack");
  if (h.wallOnBeam) parts.push("leaning");
  return `hinged: ${parts.join(", ")}`;
}

const dot = (a: Vec, b: Vec) => a.x * b.x + a.y * b.y;

function segmentDistance(p: Vec, a: Vec, b: Vec) {
  const ab = sub(b, a);
  const t = Math.max(0, Math.min(1, dot(sub(p, a), ab) / dot(ab, ab)));
  return len(sub(p, add(a, scale(ab, t))));
}

/** Distance between two segments, or 0 if they cross. */
function segmentGap(a: Vec, b: Vec, c: Vec, d: Vec) {
  const side = (p: Vec, q: Vec, r: Vec) => cross(sub(q, p), sub(r, p));
  if (side(a, b, c) * side(a, b, d) < 0 && side(c, d, a) * side(c, d, b) < 0) return 0;
  return Math.min(
    segmentDistance(a, c, d),
    segmentDistance(b, c, d),
    segmentDistance(c, a, b),
    segmentDistance(d, a, b),
  );
}

/** The rope's path from its anchor to p, over the wall's top edge if a straight line would cut through the wall. */
function ropePath(p: Vec, s: Setup) {
  const anchor = vec(-s.anchorBack, s.wallHeight + s.anchorUp);
  const edge = vec(0, s.wallHeight);
  // Ending right at the edge, the rope runs straight from the anchor.
  const blocked =
    len(sub(p, edge)) > 1e-6 &&
    p.x > -1e-9 &&
    anchor.y + ((p.y - anchor.y) * -anchor.x) / (p.x - anchor.x) < s.wallHeight;
  return blocked
    ? { length: len(sub(edge, anchor)) + len(sub(p, edge)), towards: edge }
    : { length: len(sub(p, anchor)), towards: anchor };
}

/**
 * Everything wrong with a result, checked from the physics alone: the geometry fits together, nothing
 * passes through anything, ropes only pull and surfaces only push, and the stretcher and ladder balance.
 * Empty when the result is sound.
 */
export function violations(s: Setup, r: Result): string[] {
  if (r.kind === "none") return [];
  const out: string[] = [];
  const fail = (what: string, amount: number) => out.push(`${what} (${amount.toPrecision(3)})`);
  const W = s.barWeight;
  const forceTol = 1e-3 * (s.beamWeight + W);
  const torqueTol = forceTol * s.beamLength;
  const gapTol = 1e-4;

  const raised = r.kind === "raised";
  const e = raised ? r.eq : r.h;
  const { phi, barEnd1: P1, barEnd2: P2, beamAttach: B } = e;
  const along = vec(Math.cos(phi), Math.sin(phi));
  const normal = vec(-Math.sin(phi), Math.cos(phi));
  const ropeTaut = raised || r.h.cableTaut;
  const attachmentTaut = raised || r.h.beamCableTaut;

  // Geometry.
  const phiMax = Math.acos(Math.min(1, s.beamThickness / 2 / s.wallHeight));
  if (phi < 0 || phi > phiMax + 1e-9) fail("ladder angle out of range", phi);
  if (Math.abs(len(sub(P1, P2)) - s.barLength) > gapTol) fail("stretcher length", len(sub(P1, P2)));
  if (len(sub(B, scale(along, s.attachDistance))) > gapTol) fail("attachment point off the ladder", len(B));
  const attachment = len(sub(B, P2));
  if (attachmentTaut ? Math.abs(attachment - s.beamCable) > gapTol : attachment > s.beamCable + gapTol) {
    fail("attachment length", attachment);
  }
  const rope = ropePath(P1, s);
  if (ropeTaut ? Math.abs(rope.length - s.wallCable) > 1e-3 : rope.length > s.wallCable + 1e-3) {
    fail("rope length", rope.length);
  }
  if (!raised) {
    if (Math.abs(dot(P2, normal) - s.touchGap) > gapTol)
      fail("stretcher's end not touching the ladder", dot(P2, normal));
    if (dot(P2, along) < 0 || dot(P2, along) > s.beamLength + 1e-6)
      fail("stretcher's end off the ladder", dot(P2, along));
  }

  // Nothing passes through anything.
  const tip = scale(along, s.beamLength);
  const gap = segmentGap(P1, P2, vec(0, 0), tip);
  if (gap < s.touchGap - 1e-3) fail("stretcher into the ladder", gap);
  let depth = 0;
  for (let i = 0; i <= 100; i++) {
    const p = add(P1, scale(sub(P2, P1), i / 100));
    if (p.x < 0 && p.y < s.wallHeight) depth = Math.max(depth, Math.min(-p.x, s.wallHeight - p.y));
    depth = Math.max(depth, -p.y);
  }
  if (depth > 1e-3) fail("stretcher into the wall or ground", depth);

  // Ropes pull, surfaces push.
  const pulls = (t: Vec, towards: Vec) =>
    len(t) < 1e-9 || (dot(t, towards) > 0 && Math.abs(cross(unit(t), unit(towards))) < 1e-6);
  if (ropeTaut && !pulls(e.t1, sub(rope.towards, P1))) fail("rope doesn't pull towards its anchor", len(e.t1));
  if (!ropeTaut && len(e.t1) > 1e-9) fail("slack rope carries tension", len(e.t1));
  if (!pulls(e.t2, sub(B, P2))) fail("attachment doesn't pull towards the ladder", len(e.t2));
  if (!attachmentTaut && len(e.t2) > 1e-9) fail("slack attachment carries tension", len(e.t2));
  const contacts = raised ? r.eq.contacts : r.h.barContact ? [r.h.barContact] : [];
  for (const c of contacts) {
    const [push, sideways, off] =
      c.surface === "ground"
        ? [c.force.y, c.force.x, c.point.y]
        : c.surface === "wall"
          ? [c.force.x, c.force.y, c.point.x]
          : c.surface === "top"
            ? [c.force.y, c.force.x, c.point.y - s.wallHeight]
            : [
                cross(sub(P2, P1), c.force) / s.barLength,
                dot(c.force, unit(sub(P2, P1))),
                len(sub(c.point, vec(0, s.wallHeight))),
              ];
    if (push < -forceTol) fail(`${c.surface} pulls the stretcher`, push);
    if (Math.abs(sideways) > forceTol) fail(`${c.surface} pushes sideways`, sideways);
    if (Math.abs(off) > 1e-3) fail(`${c.surface} contact off its surface`, off);
  }
  if (!raised) {
    const h = r.h;
    if (dot(h.beamPush, normal) < -forceTol) fail("ladder pulls the stretcher", dot(h.beamPush, normal));
    if (Math.abs(cross(h.beamPush, normal)) > forceTol) fail("ladder pushes along itself", cross(h.beamPush, normal));
    if (len(sub(h.support, add(h.t2, h.beamPush))) > forceTol) fail("support isn't T₂ + N", len(h.support));
  }

  // The stretcher balances.
  const onBar: { at: Vec; f: Vec }[] = [{ at: P1, f: e.t1 }, ...contacts.map((c) => ({ at: c.point, f: c.force }))];
  onBar.push(raised ? { at: P2, f: r.eq.t2 } : { at: r.h.supportAt, f: r.h.support });
  const centre = scale(add(P1, P2), 0.5);
  const net = onBar.reduce((sum, l) => add(sum, l.f), vec(0, -W));
  const turn = onBar.reduce((sum, l) => sum + cross(sub(l.at, centre), l.f), 0);
  if (len(net) > forceTol) fail("stretcher's forces don't balance", len(net));
  if (Math.abs(turn) > forceTol * s.barLength) fail("stretcher's torques don't balance", turn);

  // The ladder balances: the hinge takes what's left, or lying down, the ground shares it (pushing only).
  const onLadder = [raised ? { at: B, f: r.eq.cableOnBeam } : { at: r.h.supportAt, f: scale(r.h.support, -1) }];
  if (e.wallOnBeam) {
    onLadder.push({ at: e.wallOnBeam.point, f: e.wallOnBeam.force });
    if (dot(e.wallOnBeam.force, vec(Math.sin(phi), -Math.cos(phi))) < -forceTol)
      fail("wall's edge pulls the ladder", 1);
    if (phi < phiMax - 1e-6) fail("ladder held by the wall's edge without leaning on it", phi);
  }
  const ladderTurn =
    onLadder.reduce((sum, l) => sum + cross(l.at, l.f), 0) - s.beamWeight * (s.beamLength / 2) * Math.cos(phi);
  if (e.hinge) {
    const ladderNet = onLadder.reduce((sum, l) => add(sum, l.f), add(e.hinge, vec(0, -s.beamWeight)));
    if (len(ladderNet) > forceTol) fail("ladder's forces don't balance", len(ladderNet));
    if (Math.abs(ladderTurn) > torqueTol) fail("ladder's torques don't balance", ladderTurn);
  } else {
    if (phi > (0.05 * Math.PI) / 180) fail("raised ladder without a hinge force", phi);
    if (ladderTurn > torqueTol) fail("ground would have to hold the ladder down", ladderTurn);
  }
  return out;
}

/** A short name for a held-ladder arrangement, e.g. "held: rope+attachment+ladder" or "none: <reason>". */
export function heldArrangement(r: HeldResult): string {
  if (r.kind === "none") return `none: ${r.reason}`;
  const h = r.h;
  const held = [h.ropeTaut && "rope", h.attachmentTaut && "attachment", ...h.contacts.map((c) => c.surface)];
  const by = h.hold ? "team" : h.wallOnBeam ? "leaning" : "ladder down";
  return `held: ${[...new Set(held.filter(Boolean))].sort().join("+")}, ${by}`;
}

/** Everything wrong with a held-ladder result, checked from the physics alone, like `violations`. */
export function heldViolations(s: Setup, phi: number, r: HeldResult): string[] {
  if (r.kind === "none") return [];
  const out: string[] = [];
  const fail = (what: string, amount: number) => out.push(`${what} (${amount.toPrecision(3)})`);
  const h = r.h;
  const W = s.barWeight;
  const forceTol = 1e-3 * (s.beamWeight + W);
  const torqueTol = forceTol * s.beamLength;
  const gapTol = 1e-4;
  const { barEnd1: P1, barEnd2: P2, beamAttach: B } = h;
  const along = vec(Math.cos(phi), Math.sin(phi));
  const normal = vec(-Math.sin(phi), Math.cos(phi));

  if (Math.abs(h.phi - phi) > 1e-9) fail("ladder not at the held angle", h.phi);
  if (Math.abs(len(sub(P1, P2)) - s.barLength) > gapTol) fail("stretcher length", len(sub(P1, P2)));
  if (len(sub(B, scale(along, s.attachDistance))) > gapTol) fail("attachment point off the ladder", len(B));
  const attachment = h.attachVia ? len(sub(h.attachVia, B)) + len(sub(P2, h.attachVia)) : len(sub(B, P2));
  if (h.attachVia && len(sub(h.attachVia, scale(along, s.beamLength))) > 1e-9) fail("attachment wraps off the tip", 1);
  if (h.attachmentTaut ? Math.abs(attachment - s.beamCable) > gapTol : attachment > s.beamCable + gapTol)
    fail("attachment length", attachment);
  const rope = ropePath(P1, s);
  if (h.ropeTaut ? Math.abs(rope.length - s.wallCable) > 1e-3 : rope.length > s.wallCable + 1e-3)
    fail("rope length", rope.length);

  const tip = scale(along, s.beamLength);
  const gap = segmentGap(P1, P2, vec(0, 0), tip);
  if (gap < s.touchGap - 1e-3) fail("stretcher into the ladder", gap);
  if (dot(P2, normal) < 0 && !h.attachVia) fail("attachment through the ladder", dot(P2, normal));
  let depth = 0;
  for (let i = 0; i <= 100; i++) {
    const p = add(P1, scale(sub(P2, P1), i / 100));
    if (p.x < 0 && p.y < s.wallHeight) depth = Math.max(depth, Math.min(-p.x, s.wallHeight - p.y));
    depth = Math.max(depth, -p.y);
  }
  if (depth > 1e-3) fail("stretcher into the wall or ground", depth);

  const pulls = (t: Vec, towards: Vec) =>
    len(t) < 1e-9 || (dot(t, towards) > 0 && Math.abs(cross(unit(t), unit(towards))) < 1e-6);
  if (!pulls(h.t1, sub(rope.towards, P1))) fail("rope doesn't pull towards its anchor", len(h.t1));
  if (!pulls(h.t2, sub(h.attachVia ?? B, P2))) fail("attachment doesn't pull towards the ladder", len(h.t2));
  const barDir = unit(sub(P2, P1));
  h.contacts.forEach((c, i) => {
    const lp = h.ladderPoints[i];
    // Square to the surface: the ground, wall and wall top have fixed normals; at the wall's edge or the
    // ladder's tip the push is square to the stretcher; on the ladder's face, square to the ladder.
    const surfaceDir =
      c.surface === "ground" || c.surface === "top"
        ? vec(1, 0)
        : c.surface === "wall"
          ? vec(0, 1)
          : c.surface === "edge" || (lp && len(sub(lp, tip)) < 1e-9)
            ? barDir
            : along;
    if (Math.abs(dot(c.force, surfaceDir)) > forceTol) fail(`${c.surface} pushes sideways`, dot(c.force, surfaceDir));
    const touchingAt = c.surface === "ladder" ? len(sub(c.point, lp ?? c.point)) - s.touchGap : 0;
    const off =
      c.surface === "ground"
        ? c.point.y
        : c.surface === "wall"
          ? c.point.x
          : c.surface === "top"
            ? c.point.y - s.wallHeight
            : c.surface === "edge"
              ? segmentDistance(vec(0, s.wallHeight), P1, P2)
              : touchingAt;
    if (Math.abs(off) > 1e-3) fail(`${c.surface} contact off its surface`, off);
    if (c.surface === "ladder" && !lp) fail("ladder contact without a point on the ladder", 0);
  });

  const onBar = [{ at: P1, f: h.t1 }, { at: P2, f: h.t2 }, ...h.contacts.map((c) => ({ at: c.point, f: c.force }))];
  const centre = scale(add(P1, P2), 0.5);
  const net = onBar.reduce((sum, l) => add(sum, l.f), vec(0, -W));
  const turn = onBar.reduce((sum, l) => sum + cross(sub(l.at, centre), l.f), 0);
  if (len(net) > forceTol) fail("stretcher's forces don't balance", len(net));
  if (Math.abs(turn) > forceTol * s.barLength) fail("stretcher's torques don't balance", turn);

  const onLadder = [{ at: h.attachVia ?? B, f: scale(h.t2, -1) }];
  h.contacts.forEach((c, i) => {
    const lp = h.ladderPoints[i];
    if (lp) onLadder.push({ at: lp, f: scale(c.force, -1) });
  });
  if (h.hold) {
    onLadder.push({ at: h.hold.point, f: h.hold.force });
    if (Math.abs(dot(h.hold.force, along)) > forceTol) fail("team pushes along the ladder", dot(h.hold.force, along));
  }
  if (h.wallOnBeam) onLadder.push({ at: h.wallOnBeam.point, f: h.wallOnBeam.force });
  const ladderTurn =
    onLadder.reduce((sum, l) => sum + cross(l.at, l.f), 0) - s.beamWeight * (s.beamLength / 2) * Math.cos(phi);
  if (h.hinge) {
    const ladderNet = onLadder.reduce((sum, l) => add(sum, l.f), add(h.hinge, vec(0, -s.beamWeight)));
    if (len(ladderNet) > forceTol) fail("ladder's forces don't balance", len(ladderNet));
    if (Math.abs(ladderTurn) > torqueTol) fail("ladder's torques don't balance", ladderTurn);
  } else if (ladderTurn > torqueTol) fail("ground would have to hold the ladder down", ladderTurn);
  return out;
}
