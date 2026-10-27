/**
 * A picture drawn in layers, as the knot pages draw: props behind; every strand whole; props strands pass in front of
 * and behind; every strand's over stretches (where it's on top at a crossing, or passes in front of a prop), layer by
 * layer; then each rope's taped end. Ropes are drawn with `RopeDrawing`'s pieces, so a knot looks the same here as on
 * its page.
 *
 * Each strand and prop is its own memoised piece, compared by what it draws, so a change to one redraws only it.
 * Coordinates are millimetres, and each rope is drawn its own diameter across.
 */

import { memo } from "react";

import { Stretch, Tape, type RopeColors } from "@/knots/rope-drawing";
import { laySegments, type RopePath } from "@/knots/rope-path";
import { svgPoint } from "@/lib/svg-path";

import { ArrowDrawing, ArrowOverDrawing, arrowShape } from "./arrow-drawing";
import { ROPE_TOKENS, TAPE_TOKENS } from "./colours";
import type { PictureGeometry } from "./geometry";
import { strandSize, type Picture, type Prop } from "./knot-file";
import { kindOf } from "./props";

const samePath = (a: RopePath, b: RopePath) =>
    a.length === b.length &&
    a.every((seg, k) => seg.d === b[k].d && seg.over === b[k].over && seg.level === b[k].level);

const PropDrawing = memo(function PropDrawing(props: { prop: Prop }) {
    return kindOf(props.prop).draw(props.prop);
});

const RopeWhole = memo(function RopeWhole(props: { d: string; colors: RopeColors; width: number }) {
    return <Stretch d={props.d} offset={0} colors={props.colors} width={props.width} />;
});

/** A rope's over stretches in one layer. */
const RopeOver = memo(
    function RopeOver(props: { path: RopePath; level: number; colors: RopeColors; width: number }) {
        return laySegments(props.path).map(
            (seg, k) =>
                seg.over &&
                (seg.level ?? 0) === props.level && (
                    <Stretch
                        key={k}
                        d={`M ${svgPoint(seg.from)} ${seg.d}`}
                        offset={seg.start}
                        length={seg.length}
                        colors={props.colors}
                        width={props.width}
                    />
                ),
        );
    },
    (a, b) =>
        a.level === b.level &&
        a.colors === b.colors &&
        a.width === b.width &&
        samePath(a.path, b.path),
);

const RopeTape = memo(
    function RopeTape(props: { path: RopePath; width: number }) {
        return <Tape path={props.path} colors={TAPE_TOKENS} width={props.width} />;
    },
    (a, b) => a.width === b.width && samePath(a.path, b.path),
);

/** The picture, from its geometry and each strand's path (from `strandPaths`). */
export function PictureDrawing(props: {
    picture: Picture;
    geometry: PictureGeometry;
    paths: RopePath[];
}) {
    const { picture, geometry, paths } = props;
    const strands = picture.strands.map((strand, i) => ({
        strand,
        path: paths[i],
        arrow: strand.kind === "arrow" ? arrowShape(geometry.strands[i], paths[i]) : undefined,
        colors: strand.kind === "rope" ? ROPE_TOKENS[strand.colour] : undefined,
    }));
    const between = picture.props.map((prop) => kindOf(prop).between(prop));
    /** How many layers there are above the first. */
    const levels = Math.max(0, ...paths.flatMap((path) => path.map((seg) => seg.level ?? 0)));
    return (
        <g>
            {picture.props.map((prop, p) => !between[p] && <PropDrawing key={p} prop={prop} />)}
            {strands.map(({ path, arrow, colors }, i) =>
                arrow ? (
                    <ArrowDrawing key={i} shaft={arrow.shaft} head={arrow.head} />
                ) : (
                    <RopeWhole
                        key={i}
                        d={path.map((s) => s.d).join(" ")}
                        colors={colors!}
                        width={strandSize(strands[i].strand)}
                    />
                ),
            )}
            {picture.props.map((prop, p) => between[p] && <PropDrawing key={p} prop={prop} />)}
            {strands.map(({ path, arrow, colors }, i) =>
                arrow ? (
                    <ArrowOverDrawing
                        key={i}
                        over={arrow.over}
                        head={arrow.head}
                        headOver={arrow.headOver}
                    />
                ) : (
                    <RopeOver
                        key={i}
                        path={path}
                        level={0}
                        colors={colors!}
                        width={strandSize(strands[i].strand)}
                    />
                ),
            )}
            {/* Later layers, each over the one before: stretches running on under one on top. */}
            {Array.from({ length: levels }, (_, k) => k + 1).map((level) =>
                strands.map(
                    ({ path, arrow, colors }, i) =>
                        !arrow && (
                            <RopeOver
                                key={`${level}.${i}`}
                                path={path}
                                level={level}
                                colors={colors!}
                                width={strandSize(strands[i].strand)}
                            />
                        ),
                ),
            )}
            {strands.map(
                ({ strand, path }, i) =>
                    strand.kind === "rope" && (
                        <RopeTape key={i} path={path} width={strand.diameter} />
                    ),
            )}
        </g>
    );
}
