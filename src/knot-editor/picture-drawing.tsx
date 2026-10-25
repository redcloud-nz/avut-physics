/**
 * A picture drawn in layers, as the knot pages draw: props behind; every strand whole; props strands pass in front of
 * and behind; every strand's over stretches (where it's on top at a crossing, or passes in front of a prop); then each
 * rope's taped end. Ropes are drawn with `RopeDrawing`'s pieces, so a knot looks the same here as on its page.
 *
 * Each strand and prop is its own memoised piece, compared by what it draws, so a change to one redraws only it.
 * Coordinates are rope diameters.
 */

import { memo } from "react";

import { Stretch, Tape, type RopeColors } from "@/knots/rope-drawing";
import { laySegments, type RopePath } from "@/knots/rope-path";

import { ArrowDrawing, ArrowOverDrawing, arrowShape } from "./arrow-drawing";
import { ROPE_TOKENS, TAPE_TOKENS } from "./colours";
import type { Picture, Prop } from "./format";
import type { PictureGeometry } from "./geometry";
import { kindOf } from "./props";

const samePath = (a: RopePath, b: RopePath) =>
    a.length === b.length && a.every((seg, k) => seg.d === b[k].d && seg.over === b[k].over);

const PropDrawing = memo(function PropDrawing(props: { prop: Prop }) {
    return kindOf(props.prop).draw(props.prop);
});

const RopeWhole = memo(function RopeWhole(props: { d: string; colors: RopeColors }) {
    return <Stretch d={props.d} offset={0} colors={props.colors} />;
});

const RopeOver = memo(
    function RopeOver(props: { path: RopePath; colors: RopeColors }) {
        return laySegments(props.path).map(
            (seg, k) =>
                seg.over && (
                    <Stretch
                        key={k}
                        d={`M ${Math.round(seg.from.x * 1e4) / 1e4} ${Math.round(seg.from.y * 1e4) / 1e4} ${seg.d}`}
                        offset={seg.start}
                        length={seg.length}
                        colors={props.colors}
                    />
                ),
        );
    },
    (a, b) => a.colors === b.colors && samePath(a.path, b.path),
);

const RopeTape = memo(
    function RopeTape(props: { path: RopePath }) {
        return <Tape path={props.path} colors={TAPE_TOKENS} />;
    },
    (a, b) => samePath(a.path, b.path),
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
    return (
        <g>
            {picture.props.map((prop, p) => !between[p] && <PropDrawing key={p} prop={prop} />)}
            {strands.map(({ path, arrow, colors }, i) =>
                arrow ? (
                    <ArrowDrawing key={i} shaft={arrow.shaft} head={arrow.head} />
                ) : (
                    <RopeWhole key={i} d={path.map((s) => s.d).join(" ")} colors={colors!} />
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
                    <RopeOver key={i} path={path} colors={colors!} />
                ),
            )}
            {strands.map(
                ({ strand, path }, i) => strand.kind === "rope" && <RopeTape key={i} path={path} />,
            )}
        </g>
    );
}
