import { COLORS } from "@/articles/colors";
import { swungDown, tiedOff } from "@/articles/gentle-introduction";
import { AngleArc, Arrow } from "@/components/diagram/svg";
import { Eq } from "@/components/tex";
import { deg, rad } from "@/lib/math";
import { vec2, Vector2 } from "@/lib/vector2";
import { ink, Letter, r, Section } from "@/visual/common/details";
import { GHOST } from "@/visual/frame";
import type { VisualPage } from "@/visual/pages";

import { PullingOffCentreFigure } from "./figure";
import { ANCHORS, DEPTH, OFFSET, SWING } from "./rig";

/** The worked example. The left rope is 30° from the load's line, α, and the right one about 49°, β. */
const EXAMPLE = tiedOff(ANCHORS, vec2(OFFSET, -DEPTH), rad(SWING));

const TL = ink(COLORS.pull, r`T_\text{left}`);
const TR = ink(COLORS.pull, r`T_\text{right}`);
const W = ink(COLORS.load, "W");

/** An angle marked inside the corner at `at`, between the directions towards `a` and `b`, with its name. */
function Corner(props: { at: Vector2; a: Vector2; b: Vector2; radius: number; name: string }) {
    const start = deg(props.a.sub(props.at).angle());
    let sweep = deg(props.b.sub(props.at).angle()) - start;
    if (sweep > 180) sweep -= 360;
    if (sweep < -180) sweep += 360;
    const mid = rad(start + sweep / 2);
    return (
        <>
            <AngleArc center={props.at} radius={props.radius} startDeg={start} sweepDeg={sweep} />
            <Letter at={props.at.add(Vector2.fromAngle(mid, props.radius + 13))} color="var(--ink)">
                {props.name}
            </Letter>
        </>
    );
}

/** From the rig's metres, y up, to a drawing's units, y down. */
const drawn = (p: Vector2, per: number, origin: Vector2) => origin.add(vec2(p.x * per, -p.y * per));

/** The rig in the example, with the load's line carried on up through the master point and each rope's angle off it. */
function RigDrawing() {
    const per = 90;
    const origin = vec2(130, 30);
    const [left, right] = ANCHORS.map((a) => drawn(a, per, origin));
    const m = drawn(EXAMPLE.master, per, origin);
    const down = swungDown(rad(SWING));
    const pull = vec2(down.x, -down.y);
    return (
        <svg
            viewBox="20 15 220 230"
            className="mx-auto w-full max-w-64 text-ink-muted"
            role="img"
            aria-label="The rig in the example: the master point off centre and the load pulling to the right of straight down. The load's line, carried on up past the master point, is 30° from the left rope, α, and 49° from the right one, β."
        >
            <line
                x1={m.x}
                y1={m.y}
                x2={m.x - pull.x * 150}
                y2={m.y - pull.y * 150}
                stroke={GHOST}
                strokeDasharray="2 4"
                strokeWidth={1.5}
            />
            {[left, right].map((a, i) => (
                <g key={i}>
                    <line
                        x1={a.x}
                        y1={a.y}
                        x2={m.x}
                        y2={m.y}
                        stroke="currentColor"
                        strokeWidth={2}
                        opacity={0.8}
                    />
                    <circle cx={a.x} cy={a.y} r={4} fill="currentColor" />
                </g>
            ))}
            <line
                x1={m.x}
                y1={m.y}
                x2={m.x + pull.x * 90}
                y2={m.y + pull.y * 90}
                stroke="currentColor"
                strokeWidth={2}
                opacity={0.8}
            />
            <Arrow from={m} v={pull.scale(70)} color={COLORS.load} />
            <Corner at={m} a={m.sub(pull)} b={left} radius={40} name="α" />
            <Corner at={m} a={m.sub(pull)} b={right} radius={28} name="β" />
            <circle cx={m.x} cy={m.y} r={4} fill="currentColor" />
        </svg>
    );
}

/** Where to put a side's name: off the middle of the side from `a` to `b`, on the far side from `inside`. */
const outside = (a: Vector2, b: Vector2, inside: Vector2, by: number) => {
    const mid = a.add(b).scale(0.5);
    const n = b.sub(a).perp().unit();
    return mid.add(n.scale(n.dot(inside.sub(mid)) > 0 ? -by : by));
};

/** The load's pull and the two ropes' pulls tip to tail, closing a triangle, with its angles. */
function TriangleDrawing() {
    const per = 150;
    const down = swungDown(rad(SWING));
    const w = vec2(down.x, -down.y).scale(per);
    // The right rope's pull closes the triangle, so only the left one's direction is needed.
    const u = EXAMPLE.anchors[0].sub(EXAMPLE.master).unit();
    const p = vec2(70, 15);
    const q = p.add(w);
    const s = q.add(vec2(u.x, -u.y).scale(EXAMPLE.shares[0] * per));
    const centre = p
        .add(q)
        .add(s)
        .scale(1 / 3);
    return (
        <svg
            viewBox="-15 0 160 175"
            className="mx-auto w-full max-w-48 text-ink-muted"
            role="img"
            aria-label="The load's pull W, then the left rope's pull, then the right rope's, tip to tail, closing a triangle. The angle between W and the left rope is α, and between W and the right rope is β."
        >
            <Corner at={q} a={p} b={s} radius={26} name="α" />
            <Corner at={p} a={s} b={q} radius={26} name="β" />
            <Arrow from={p} v={w} color={COLORS.load} width={3} />
            <Arrow from={q} v={s.sub(q)} color={COLORS.pull} width={3} />
            <Arrow from={s} v={p.sub(s)} color={COLORS.pull} width={3} />
            <Letter at={outside(p, q, centre, 14)} color={COLORS.load}>
                W
            </Letter>
            <Letter at={outside(q, s, centre, 26)} color={COLORS.pull}>
                left
            </Letter>
            <Letter at={outside(s, p, centre, 32)} color={COLORS.pull}>
                right
            </Letter>
        </svg>
    );
}

function PullingOffCentreMore() {
    const [left, right] = EXAMPLE.shares.map((share) => (2 * share).toFixed(1));
    const total = (2 * (EXAMPLE.shares[0] + EXAMPLE.shares[1])).toFixed(2);
    return (
        <>
            <Section title="Working it out">
                <p>
                    Take the anchors 2 m apart, the master point tied off 1.2 m below them and 0.2 m
                    right of the middle, and a 2 kN load (about 200 kg) pulling 15° right of
                    straight down. The figure starts here.
                </p>
                <p>
                    What matters is how far each rope is from the load’s line, carried on up past
                    the master point. The left rope is 45° from straight up and the load’s line 15°,
                    so they’re <em>α</em> = 30° apart. The right rope is about 34° the other way, so
                    it’s <em>β</em> = 34° + 15° = 49° from the line.
                </p>
                <RigDrawing />
                <p>
                    Nothing moves, so the three pulls on the master point, laid tip to tail, close
                    up into a triangle (as on Equilibrium). The angles in its corners are the ones
                    we just found, and the third is whatever’s left of 180°.
                </p>
                <TriangleDrawing />
                <p>
                    Any triangle follows the sine rule: each side, divided by the sine of the angle
                    opposite it, comes out the same. The sine of the third angle is the same as the
                    sine of <em>α</em> + <em>β</em>, so:
                </p>
                <Eq
                    tex={r`\frac{${TL}}{\sin\beta} = \frac{${TR}}{\sin\alpha} = \frac{${W}}{\sin(\alpha + \beta)}`}
                />
                <p>
                    With <em>α</em> = 30° and <em>β</em> = 49°, so <em>α</em> + <em>β</em> = 79°:
                </p>
                <Eq
                    tex={r`${TL} = ${ink(COLORS.load, "2")} \times \frac{\sin 49^\circ}{\sin 79^\circ} = 2 \times \frac{0.75}{0.98} \approx ${ink(COLORS.pull, r`${left}\,\text{kN}`)}`}
                />
                <Eq
                    tex={r`${TR} = ${ink(COLORS.load, "2")} \times \frac{\sin 30^\circ}{\sin 79^\circ} = 2 \times \frac{0.5}{0.98} \approx ${ink(COLORS.pull, r`${right}\,\text{kN}`)}`}
                />
                <p>
                    The left anchor takes more, though the master point is tied off nearer the right
                    one: the angled pull lines the load up with the left rope. Between them the
                    anchors hold about {total} kN, more than the load, because the leaning ropes
                    pull against each other too.
                </p>
            </Section>
            <Section title="Most in line takes most">
                <p>
                    Each rope’s pull goes with the sine of the <em>other</em> rope’s angle. The
                    closer one rope comes to the load’s line, the further the other is from it, and
                    the more the near one holds.
                </p>
                <p>
                    Swing the pull until it lines up with the left rope and <em>α</em> is 0°. sin 0°
                    is 0, so the right rope holds nothing, and the left holds the whole load. Swing
                    further and <em>α</em> would go past 0°: the right rope would have to push, and
                    ropes can’t, so it goes slack and the master point swings out to hang from the
                    left anchor alone.
                </p>
            </Section>
            <Section title="Tied off, or sliding">
                <p>
                    This anchor is tied off at the master point (pre-equalised), so it doesn’t
                    adjust as the pull swings. A sliding (self-equalising) master point instead
                    moves until both ropes make the same angle with the load, so they share it
                    equally. The cost is that it drops a little, with a jolt, if one anchor fails.
                </p>
            </Section>
        </>
    );
}

const page: VisualPage = {
    slug: "pulling-off-centre",
    name: "Pulling off centre",
    title: "The anchor in line takes most",
    text: "With the master point tied off, the anchor whose rope lines up best with the load takes more. Swing the pull past one rope and the other goes slack.",
    Figure: PullingOffCentreFigure,
    More: PullingOffCentreMore,
};

export default page;
