import { COLORS } from "@/articles/colors";
import { Arrow } from "@/components/diagram/svg";
import { deg } from "@/lib/math";
import { vec2 } from "@/lib/vector2";
import { slopeParts } from "@/visual/common/mechanics";
import { Note, SVG } from "@/visual/frame";

/** Friction's colour: the surface's grip, against the way the load slides. */
export const FRICTION = "var(--friction)";

/** Drawing units for the load's whole weight. */
const W = 90;
const FOOT = vec2(30, 262);
const LENGTH = 260;

/**
 * A load on a slope `angle` radians from flat, held by a rope to an anchor at the top. Its weight is drawn with its
 * parts along the slope and into it, and the rope's pull, `pull` of the weight, up the slope. With `friction`, the
 * surface's grip, that share of the weight, is drawn down the slope against the haul.
 */
export function SlopeDrawing(props: { angle: number; pull: number; friction?: number }) {
    const { along, into } = slopeParts(props.angle);
    const up = vec2(Math.cos(props.angle), -Math.sin(props.angle));
    // Straight out of the ground, up and back from the slope.
    const normal = vec2(up.y, -up.x);
    const top = FOOT.add(up.scale(LENGTH));
    const centre = FOOT.add(up.scale(140)).add(normal.scale(16));
    const anchor = FOOT.add(up.scale(LENGTH - 6)).add(normal.scale(16));
    const tilt = -deg(props.angle);
    const downSlope = up.neg();
    const corner = centre.add(downSlope.scale(along * W));
    return (
        <svg
            viewBox="0 0 320 300"
            className={SVG}
            fontSize={15}
            role="img"
            aria-label="A load on a slope held by a rope to an anchor at the top. Its weight is split into a part along the slope and a part into it."
        >
            <polygon
                points={`${FOOT.x},${FOOT.y} ${top.x},${top.y} ${top.x},${FOOT.y}`}
                fill="currentColor"
                opacity={0.12}
            />
            <line
                x1={FOOT.x}
                y1={FOOT.y}
                x2={top.x}
                y2={top.y}
                stroke="currentColor"
                strokeWidth={2}
                opacity={0.6}
            />
            <line
                x1={0}
                y1={FOOT.y}
                x2={320}
                y2={FOOT.y}
                stroke="currentColor"
                strokeWidth={1}
                opacity={0.3}
            />
            <line
                x1={centre.x}
                y1={centre.y}
                x2={anchor.x}
                y2={anchor.y}
                stroke="currentColor"
                strokeWidth={2}
                opacity={0.8}
            />
            <circle cx={anchor.x} cy={anchor.y} r={4} fill="currentColor" />
            <rect
                x={centre.x - 18}
                y={centre.y - 12}
                width={36}
                height={24}
                fill="currentColor"
                transform={`rotate(${tilt} ${centre.x} ${centre.y})`}
            />
            {along > 0.03 && (
                <Arrow from={centre} v={corner.sub(centre)} color={COLORS.sideways} dashed />
            )}
            {into > 0.03 && (
                <Arrow
                    from={corner}
                    v={normal.neg().scale(into * W)}
                    color={COLORS.redirect}
                    dashed
                />
            )}
            <Arrow from={centre} v={vec2(0, W)} color={COLORS.load} />
            {props.pull > 0.03 && (
                <Arrow from={centre} v={up.scale(props.pull * W)} color={COLORS.pull} width={3} />
            )}
            {/* Friction acts where the load meets the ground. */}
            {props.friction !== undefined && props.friction > 0.03 && (
                <Arrow
                    from={centre.add(normal.scale(-16))}
                    v={downSlope.scale(props.friction * W)}
                    color={FRICTION}
                    width={3}
                />
            )}
            <Note at={FOOT.add(vec2(46, -10))} anchor="start">
                {`${Math.round(deg(props.angle))}°`}
            </Note>
        </svg>
    );
}
