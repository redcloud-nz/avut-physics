import { G } from "@/lib/constants";
import { segmentDistance, segmentGap } from "@/lib/geometry";
import { seededPicker } from "@/lib/random";
import { vec2, Vector2 } from "@/lib/vector2";

import type { HeldResult } from "./ladder-hinge-held";
import { minWallCable, type Result, type Setup } from "./ladder-hinge-solver";

/**
 * Test helpers for the ladder hinge solver: building setups the way the page does, naming the arrangement a
 * result is in, and checking a result against the physics independently of how the solver found it.
 */

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
    const pick = seededPicker(seed);
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

/** The rope's path from its anchor to p, over the wall's top edge if a straight line would cut through the wall. */
function ropePath(p: Vector2, s: Setup) {
    const anchor = vec2(-s.anchorBack, s.wallHeight + s.anchorUp);
    const edge = vec2(0, s.wallHeight);
    // Ending right at the edge, the rope runs straight from the anchor.
    const blocked =
        p.distanceTo(edge) > 1e-6 &&
        p.x > -1e-9 &&
        anchor.y + ((p.y - anchor.y) * -anchor.x) / (p.x - anchor.x) < s.wallHeight;
    return blocked
        ? { length: edge.distanceTo(anchor) + p.distanceTo(edge), towards: edge }
        : { length: p.distanceTo(anchor), towards: anchor };
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
    const along = Vector2.fromAngle(phi);
    const normal = along.perp();
    const ropeTaut = raised || r.h.cableTaut;
    const attachmentTaut = raised || r.h.beamCableTaut;

    // Geometry.
    const phiMax = Math.acos(Math.min(1, s.beamThickness / 2 / s.wallHeight));
    if (phi < 0 || phi > phiMax + 1e-9) fail("ladder angle out of range", phi);
    if (Math.abs(P1.distanceTo(P2) - s.barLength) > gapTol)
        fail("stretcher length", P1.distanceTo(P2));
    if (B.distanceTo(along.scale(s.attachDistance)) > gapTol)
        fail("attachment point off the ladder", B.len());
    const attachment = B.distanceTo(P2);
    if (
        attachmentTaut
            ? Math.abs(attachment - s.beamCable) > gapTol
            : attachment > s.beamCable + gapTol
    ) {
        fail("attachment length", attachment);
    }
    const rope = ropePath(P1, s);
    if (ropeTaut ? Math.abs(rope.length - s.wallCable) > 1e-3 : rope.length > s.wallCable + 1e-3) {
        fail("rope length", rope.length);
    }
    if (!raised) {
        if (Math.abs(P2.dot(normal) - s.touchGap) > gapTol)
            fail("stretcher's end not touching the ladder", P2.dot(normal));
        if (P2.dot(along) < 0 || P2.dot(along) > s.beamLength + 1e-6)
            fail("stretcher's end off the ladder", P2.dot(along));
    }

    // Nothing passes through anything.
    const tip = along.scale(s.beamLength);
    const gap = segmentGap(P1, P2, Vector2.ZERO, tip);
    if (gap < s.touchGap - 1e-3) fail("stretcher into the ladder", gap);
    let depth = 0;
    for (let i = 0; i <= 100; i++) {
        const p = P1.add(P2.sub(P1).scale(i / 100));
        if (p.x < 0 && p.y < s.wallHeight)
            depth = Math.max(depth, Math.min(-p.x, s.wallHeight - p.y));
        depth = Math.max(depth, -p.y);
    }
    if (depth > 1e-3) fail("stretcher into the wall or ground", depth);

    // Ropes pull, surfaces push.
    const pulls = (t: Vector2, towards: Vector2) =>
        t.len() < 1e-9 || (t.dot(towards) > 0 && Math.abs(t.unit().cross(towards.unit())) < 1e-6);
    if (ropeTaut && !pulls(e.t1, rope.towards.sub(P1)))
        fail("rope doesn't pull towards its anchor", e.t1.len());
    if (!ropeTaut && e.t1.len() > 1e-9) fail("slack rope carries tension", e.t1.len());
    if (!pulls(e.t2, B.sub(P2))) fail("attachment doesn't pull towards the ladder", e.t2.len());
    if (!attachmentTaut && e.t2.len() > 1e-9) fail("slack attachment carries tension", e.t2.len());
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
                          P2.sub(P1).cross(c.force) / s.barLength,
                          c.force.dot(P2.sub(P1).unit()),
                          c.point.distanceTo(vec2(0, s.wallHeight)),
                      ];
        if (push < -forceTol) fail(`${c.surface} pulls the stretcher`, push);
        if (Math.abs(sideways) > forceTol) fail(`${c.surface} pushes sideways`, sideways);
        if (Math.abs(off) > 1e-3) fail(`${c.surface} contact off its surface`, off);
    }
    if (!raised) {
        const h = r.h;
        if (h.beamPush.dot(normal) < -forceTol)
            fail("ladder pulls the stretcher", h.beamPush.dot(normal));
        if (Math.abs(h.beamPush.cross(normal)) > forceTol)
            fail("ladder pushes along itself", h.beamPush.cross(normal));
        if (h.support.distanceTo(h.t2.add(h.beamPush)) > forceTol)
            fail("support isn't T₂ + N", h.support.len());
    }

    // The stretcher balances.
    const onBar: { at: Vector2; f: Vector2 }[] = [
        { at: P1, f: e.t1 },
        ...contacts.map((c) => ({ at: c.point, f: c.force })),
    ];
    onBar.push(raised ? { at: P2, f: r.eq.t2 } : { at: r.h.supportAt, f: r.h.support });
    const centre = P1.add(P2).scale(0.5);
    const net = onBar.reduce((sum, l) => sum.add(l.f), vec2(0, -W));
    const turn = onBar.reduce((sum, l) => sum + l.at.sub(centre).cross(l.f), 0);
    if (net.len() > forceTol) fail("stretcher's forces don't balance", net.len());
    if (Math.abs(turn) > forceTol * s.barLength) fail("stretcher's torques don't balance", turn);

    // The ladder balances: the hinge takes what's left, or lying down, the ground shares it (pushing only).
    const onLadder = [
        raised ? { at: B, f: r.eq.cableOnBeam } : { at: r.h.supportAt, f: r.h.support.neg() },
    ];
    if (e.wallOnBeam) {
        onLadder.push({ at: e.wallOnBeam.point, f: e.wallOnBeam.force });
        if (e.wallOnBeam.force.dot(normal.neg()) < -forceTol)
            fail("wall's edge pulls the ladder", 1);
        if (phi < phiMax - 1e-6) fail("ladder held by the wall's edge without leaning on it", phi);
    }
    const ladderTurn =
        onLadder.reduce((sum, l) => sum + l.at.cross(l.f), 0) -
        s.beamWeight * (s.beamLength / 2) * Math.cos(phi);
    if (e.hinge) {
        const ladderNet = onLadder.reduce(
            (sum, l) => sum.add(l.f),
            e.hinge.add(vec2(0, -s.beamWeight)),
        );
        if (ladderNet.len() > forceTol) fail("ladder's forces don't balance", ladderNet.len());
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
    const held = [
        h.ropeTaut && "rope",
        h.attachmentTaut && "attachment",
        ...h.contacts.map((c) => c.surface),
    ];
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
    const along = Vector2.fromAngle(phi);
    const normal = along.perp();

    if (Math.abs(h.phi - phi) > 1e-9) fail("ladder not at the held angle", h.phi);
    if (Math.abs(P1.distanceTo(P2) - s.barLength) > gapTol)
        fail("stretcher length", P1.distanceTo(P2));
    if (B.distanceTo(along.scale(s.attachDistance)) > gapTol)
        fail("attachment point off the ladder", B.len());
    const attachment = h.attachVia
        ? h.attachVia.distanceTo(B) + P2.distanceTo(h.attachVia)
        : B.distanceTo(P2);
    if (h.attachVia && h.attachVia.distanceTo(along.scale(s.beamLength)) > 1e-9)
        fail("attachment wraps off the tip", 1);
    if (
        h.attachmentTaut
            ? Math.abs(attachment - s.beamCable) > gapTol
            : attachment > s.beamCable + gapTol
    )
        fail("attachment length", attachment);
    const rope = ropePath(P1, s);
    if (h.ropeTaut ? Math.abs(rope.length - s.wallCable) > 1e-3 : rope.length > s.wallCable + 1e-3)
        fail("rope length", rope.length);

    const tip = along.scale(s.beamLength);
    const gap = segmentGap(P1, P2, Vector2.ZERO, tip);
    if (gap < s.touchGap - 1e-3) fail("stretcher into the ladder", gap);
    if (P2.dot(normal) < 0 && !h.attachVia) fail("attachment through the ladder", P2.dot(normal));
    let depth = 0;
    for (let i = 0; i <= 100; i++) {
        const p = P1.add(P2.sub(P1).scale(i / 100));
        if (p.x < 0 && p.y < s.wallHeight)
            depth = Math.max(depth, Math.min(-p.x, s.wallHeight - p.y));
        depth = Math.max(depth, -p.y);
    }
    if (depth > 1e-3) fail("stretcher into the wall or ground", depth);

    const pulls = (t: Vector2, towards: Vector2) =>
        t.len() < 1e-9 || (t.dot(towards) > 0 && Math.abs(t.unit().cross(towards.unit())) < 1e-6);
    if (!pulls(h.t1, rope.towards.sub(P1)))
        fail("rope doesn't pull towards its anchor", h.t1.len());
    if (!pulls(h.t2, (h.attachVia ?? B).sub(P2)))
        fail("attachment doesn't pull towards the ladder", h.t2.len());
    const barDir = P2.sub(P1).unit();
    h.contacts.forEach((c, i) => {
        const lp = h.ladderPoints[i];
        // Square to the surface: the ground, wall and wall top have fixed normals; at the wall's edge or the
        // ladder's tip the push is square to the stretcher; on the ladder's face, square to the ladder.
        const surfaceDir =
            c.surface === "ground" || c.surface === "top"
                ? vec2(1, 0)
                : c.surface === "wall"
                  ? vec2(0, 1)
                  : c.surface === "edge" || (lp && lp.distanceTo(tip) < 1e-9)
                    ? barDir
                    : along;
        if (Math.abs(c.force.dot(surfaceDir)) > forceTol)
            fail(`${c.surface} pushes sideways`, c.force.dot(surfaceDir));
        const touchingAt =
            c.surface === "ladder" ? c.point.distanceTo(lp ?? c.point) - s.touchGap : 0;
        const off =
            c.surface === "ground"
                ? c.point.y
                : c.surface === "wall"
                  ? c.point.x
                  : c.surface === "top"
                    ? c.point.y - s.wallHeight
                    : c.surface === "edge"
                      ? segmentDistance(vec2(0, s.wallHeight), P1, P2)
                      : touchingAt;
        if (Math.abs(off) > 1e-3) fail(`${c.surface} contact off its surface`, off);
        if (c.surface === "ladder" && !lp) fail("ladder contact without a point on the ladder", 0);
    });

    const onBar = [
        { at: P1, f: h.t1 },
        { at: P2, f: h.t2 },
        ...h.contacts.map((c) => ({ at: c.point, f: c.force })),
    ];
    const centre = P1.add(P2).scale(0.5);
    const net = onBar.reduce((sum, l) => sum.add(l.f), vec2(0, -W));
    const turn = onBar.reduce((sum, l) => sum + l.at.sub(centre).cross(l.f), 0);
    if (net.len() > forceTol) fail("stretcher's forces don't balance", net.len());
    if (Math.abs(turn) > forceTol * s.barLength) fail("stretcher's torques don't balance", turn);

    const onLadder = [{ at: h.attachVia ?? B, f: h.t2.neg() }];
    h.contacts.forEach((c, i) => {
        const lp = h.ladderPoints[i];
        if (lp) onLadder.push({ at: lp, f: c.force.neg() });
    });
    if (h.hold) {
        onLadder.push({ at: h.hold.point, f: h.hold.force });
        if (Math.abs(h.hold.force.x) > forceTol) fail("team pushes sideways", h.hold.force.x);
    }
    if (h.wallOnBeam) onLadder.push({ at: h.wallOnBeam.point, f: h.wallOnBeam.force });
    const ladderTurn =
        onLadder.reduce((sum, l) => sum + l.at.cross(l.f), 0) -
        s.beamWeight * (s.beamLength / 2) * Math.cos(phi);
    if (h.hinge) {
        const ladderNet = onLadder.reduce(
            (sum, l) => sum.add(l.f),
            h.hinge.add(vec2(0, -s.beamWeight)),
        );
        if (ladderNet.len() > forceTol) fail("ladder's forces don't balance", ladderNet.len());
        if (Math.abs(ladderTurn) > torqueTol) fail("ladder's torques don't balance", ladderTurn);
    } else if (ladderTurn > torqueTol)
        fail("ground would have to hold the ladder down", ladderTurn);
    return out;
}
