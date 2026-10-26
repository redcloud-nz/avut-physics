/**
 * A knot as it's drawn now, turned into a knot file: each picture's ropes fitted as strands (side by side as linked
 * pins), its arrows as arrow strands, and its bar as a bar prop, with over and under at every crossing and pass set
 * from the drawing, and the knot's captions, numbers, details and view. Rope diameters become millimetres, 11 to a
 * diameter, as every rope here is 11 mm.
 */

import { resample } from "@/lib/curve";
import { Vector2 } from "@/lib/vector2";

import { pictureCrossings, type FoundCrossing } from "../../knot-editor/crossing-geometry";
import type {
    CrossingEntry,
    Frame,
    Id,
    KnotFile,
    PassEntry,
    Picture,
    Step,
    Strand,
} from "../../knot-editor/format";
import { pictureGeometry, type PictureGeometry } from "../../knot-editor/geometry";
import type { Bar } from "../bar";
import type { TyingStep } from "../figure-eight-tying";
import { fullName, type Knot } from "../index";
import type { Pin as OldPin } from "../pinned-rope";
import { centreline, laySegments, type RopePath } from "../rope-path";
import type { Arrow } from "../tying-arrow";
import { ropeView, stepsView } from "../tying-drawing";

import { strandsOf, type StrandLook } from "./build";
import { fitRopes, pairedStretches, type FittedRope } from "./pairs";

/** Millimetres to a rope diameter. */
export const MM = 11;

/** How finely each rope's drawing is sampled to fit to (millimetres). */
const SAMPLE = 0.5;

/** How far a ported rope may stray from its drawing (millimetres): a tenth of a diameter. */
export const TOLERANCE = 0.1 * MM;

/**
 * The old spacing of ropes side by side, how far from it counts, and the shortest stretch counted (millimetres). The
 * doubled knots were built with their strands exactly that far apart, so only a little either way counts.
 */
const PAIRS = { spacing: 1.1 * MM, within: 0.05 * MM, shortest: 2 * MM };

/** How far apart the editor sets ropes side by side (its `DRAWN_WIDTH`, 1.25 diameters). */
const APART = 1.25 * MM;

/** An old pin counts as on the drawing within this (millimetres), and is kept as a pin. */
const ON_DRAWING = 0.05 * MM;

/** What the run reports about one picture. */
export type PictureReport = {
    label: string;
    /** Each rope's pins and its worst miss (millimetres). */
    ropes: { pins: number; linked: number; worst: number }[];
    /** Crossings the drawing didn't settle (both or neither marked over), left unset. */
    unset: number;
};

/** One picture as drawn now: its ropes, the old pins of each where it has them, its arrows and its bar. */
type OldPicture = {
    ropes: RopePath[];
    pins?: (OldPin[] | undefined)[];
    arrows: Arrow[];
    bar?: Bar;
};

const scaled = (p: { x: number; y: number }) => new Vector2(p.x * MM, p.y * MM);
const tenths = (v: number) => Math.round(v * 10) / 10 || 0;

/** A rope's drawing as points evenly spaced along it, and for each, whether it's on a stretch marked over. */
function sampled(path: RopePath): { points: Vector2[]; over: boolean[] } {
    const points = resample(centreline(path).points.map(scaled), SAMPLE);
    const laid = laySegments(path);
    const total = laid.reduce((sum, seg) => sum + seg.length, 0);
    const over = points.map((_, i) => {
        const s = (total * i) / (points.length - 1);
        const seg =
            laid.find((g) => s >= g.start && s <= g.start + g.length) ?? laid[laid.length - 1];
        return !!seg.over;
    });
    return { points, over };
}

/** The target point of a fitted rope nearest a place on one of its segments. */
function pointAt(rope: FittedRope, segment: number, at: Vector2): number {
    const [from, to] = [rope.fit.pins[segment].index, rope.fit.pins[segment + 1].index];
    let best = from;
    for (let i = from; i <= to; i++)
        if (rope.target[i].distanceTo(at) < rope.target[best].distanceTo(at)) best = i;
    return best;
}

/** A picture of the knot editor, from one as drawn now. */
function convertPicture(
    old: OldPicture,
    label: string,
    ids: () => Id,
): { picture: Picture; report: PictureReport } {
    const drawn = old.ropes.map(sampled);
    const targets = drawn.map((d) => d.points);
    const starts = targets.map((points, r) =>
        (old.pins?.[r] ?? []).flatMap((pin) => {
            const p = scaled(pin);
            let best = 0;
            points.forEach((q, i) => {
                if (q.distanceTo(p) < points[best].distanceTo(p)) best = i;
            });
            return points[best].distanceTo(p) <= ON_DRAWING ? [best] : [];
        }),
    );
    const pairs = pairedStretches(targets, PAIRS);
    const fitted = fitRopes(targets, starts, pairs, {
        tolerance: TOLERANCE,
        apart: APART,
        ease: 2 * MM,
    });

    // Arrows: pins at their points, as the editor would place them.
    const arrows: FittedRope[] = old.arrows.map((arrow) => {
        const points = arrow.points.map(scaled);
        return {
            fit: {
                pins: points.map((p, k) => ({ x: tenths(p.x), y: tenths(p.y), index: k })),
                tensions: points.slice(1).map(() => [1, 1] as [number, number]),
                misses: points.slice(1).map(() => 0),
                worst: 0,
            },
            target: points,
            links: new Map(),
        };
    });
    const looks: StrandLook[] = [
        ...old.ropes.map(
            (_, r): StrandLook => ({
                kind: "rope",
                colour: r === 0 ? "orange" : "green",
                diameter: MM,
            }),
        ),
        ...old.arrows.map((): StrandLook => ({ kind: "arrow" })),
    ];
    const strands: Strand[] = strandsOf([...fitted, ...arrows], looks, ids);
    const props = old.bar
        ? [
              {
                  id: ids(),
                  kind: "bar" as const,
                  x: tenths(old.bar.x * MM),
                  y: tenths(old.bar.y * MM),
                  r: tenths(old.bar.r * MM),
                  ...(old.bar.length && { length: tenths(old.bar.length * MM) }),
                  passes: [] as PassEntry[],
              },
          ]
        : [];
    const bare: Picture = { strands, crossings: [], props };
    const geometry = pictureGeometry(bare);
    const found = pictureCrossings(bare, geometry);

    /** Whether strand i is on top at this crossing's end of it, as drawn now (or for an arrow, as it's set). */
    const isOver = (c: FoundCrossing, end: 0 | 1, g: PictureGeometry): boolean | undefined => {
        const [i, k] = c.pair[end];
        if (i < fitted.length) return drawn[i].over[pointAt(fitted[i], k, c.at)];
        const arrow = old.arrows[i - fitted.length];
        if (arrow.front) return true;
        if (arrow.frontTo === undefined) return false;
        return (
            c.s[end] < g.strands[i].starts[Math.min(arrow.frontTo, g.strands[i].starts.length - 1)]
        );
    };
    let unset = 0;
    const crossings: CrossingEntry[] = [];
    for (const c of found.crossings) {
        const [a, b] = [isOver(c, 0, geometry), isOver(c, 1, geometry)];
        // An arrow's side settles it against a rope: the rope is over exactly where the arrow isn't.
        const arrowAt = (end: 0 | 1) => c.pair[end][0] >= fitted.length;
        let over: 0 | 1 | undefined;
        if (arrowAt(0) !== arrowAt(1)) over = arrowAt(0) ? (a ? 0 : 1) : b ? 1 : 0;
        else if (a && !b) over = 0;
        else if (b && !a) over = 1;
        if (over === undefined) {
            unset++;
            continue;
        }
        const seg = (end: 0 | 1) => strands[c.pair[end][0]].segments[c.pair[end][1]].id;
        crossings.push({ over: seg(over), under: seg(over === 0 ? 1 : 0), n: c.n });
    }
    const passes: PassEntry[] = found.passes.map((pass) => {
        const front =
            pass.strand < fitted.length &&
            drawn[pass.strand].over[pointAt(fitted[pass.strand], pass.segment, pass.at)];
        return [strands[pass.strand].segments[pass.segment].id, pass.n, front ? "front" : "behind"];
    });
    const picture: Picture = {
        strands,
        crossings,
        props: props.map((prop) => (prop.length ? { ...prop, passes } : prop)),
    };
    return {
        picture,
        report: {
            label,
            ropes: fitted.map((rope) => ({
                pins: rope.fit.pins.length,
                linked: rope.links.size,
                worst: rope.fit.worst,
            })),
            unset,
        },
    };
}

/** A step's number, from its label ("Step 2 of 5", "Step 2 (cont.)"). */
const stepNumber = (label: string) => Number(/Step (\d+)/.exec(label)?.[1] ?? 1);

const oldStep = (step: TyingStep, bar?: Bar): OldPicture => ({
    ropes: step.first ? [step.first, step.path] : [step.path],
    pins: step.first ? undefined : [step.rope?.pins],
    arrows: step.arrows,
    bar,
});

const frameOf = (view: { x: number; y: number; w: number; h: number }): Frame => ({
    x: tenths(view.x * MM),
    y: tenths(view.y * MM),
    w: tenths(view.w * MM),
    h: tenths(view.h * MM),
});

/**
 * The knot as a knot file, and a report on each picture. `knotPins` are the finished knot's old pins, where it's a
 * pinned rope and not one of its steps.
 */
export function convertKnot(
    knot: Knot,
    knotPins?: OldPin[],
): { file: KnotFile; reports: PictureReport[] } {
    let next = 1;
    const ids = () => next++;
    const steps = knot.steps ?? [];
    const last = steps[steps.length - 1];
    // A knot whose last step is its drawing (the figure-8) keeps that step's pins.
    const finishedIsLast = !!last && knot.drawing.length === 1 && knot.drawing[0] === last.path;
    const finished = convertPicture(
        {
            ropes: knot.drawing,
            pins: finishedIsLast ? [last.rope?.pins] : [knotPins],
            arrows: [],
            bar: knot.bar,
        },
        "Knot",
        ids,
    );
    const converted = steps.map((step) => convertPicture(oldStep(step, knot.bar), step.label, ids));
    const fileSteps: Step[] = steps.map((step, k) => ({
        number: stepNumber(step.label),
        instructions: step.caption,
        picture: converted[k].picture,
    }));
    const view = steps.length
        ? stepsView(steps, knot.bar)
        : ropeView(knot.drawing, knot.drawing.length > 1, knot.bar);
    return {
        file: {
            name: fullName(knot),
            description: knot.description,
            about: knot.about.join("\n\n"),
            frame: frameOf(view),
            knot: finished.picture,
            steps: fileSteps,
        },
        reports: [finished.report, ...converted.map((c) => c.report)],
    };
}
