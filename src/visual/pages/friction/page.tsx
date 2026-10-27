import { COLORS } from "@/articles/colors";
import { Eq } from "@/components/tex";
import { teaching } from "@/lib/format";
import { ink, r, Section, Var } from "@/visual/common/details";
import type { VisualPage } from "@/visual/pages";

import { FrictionFigure } from "./figure";

const E = ink(COLORS.redirect, "e");
const T = ink(COLORS.pull, "T");

/** Each system's advantage while hauling, with every pulley passing on `e`: the sum 1 + e + e² + … of its parts. */
const advantage = (parts: number, e: number) =>
    Array.from({ length: parts }, (_, i) => e ** i).reduce((a, b) => a + b, 0);

const ROWS = [
    { e: 1, what: "perfect" },
    { e: 0.9, what: "good pulley" },
    { e: 0.7, what: "small or worn pulley" },
    { e: 0.5, what: "karabiner" },
];

function FrictionMore() {
    return (
        <>
            <Section title="Where 2.7:1 comes from">
                <p>
                    Say each pulley passes on a share <Var color={COLORS.redirect}>e</Var> of the
                    rope’s pull: 90% is <Var color={COLORS.redirect}>e</Var> = 0.9. While you haul,
                    the rope runs towards you, and the pulley holds a little back, so the part on
                    the load’s side of it pulls a little less than the part on your side.
                </p>
                <p>
                    You pull the haul line with 1<Var color={COLORS.pull}>T</Var>. Round the
                    travelling pulley, the rope to the anchor’s pulley carries{" "}
                    <Var color={COLORS.redirect}>e</Var>
                    <Var color={COLORS.pull}>T</Var>, and round the anchor’s pulley, the main line
                    to the load carries <Var color={COLORS.redirect}>e</Var>²
                    <Var color={COLORS.pull}>T</Var>. The travelling pulley’s sling adds its two
                    parts, 1<Var color={COLORS.pull}>T</Var> + <Var color={COLORS.redirect}>e</Var>
                    <Var color={COLORS.pull}>T</Var>, to the main line at the grab. So the load
                    gets:
                </p>
                <Eq tex={r`(1 + ${E} + ${E}^2)\,${T}`} />
                <p>
                    With <Var color={COLORS.redirect}>e</Var> = 0.9:
                </p>
                <Eq tex={r`(1 + 0.9 + 0.81)\,${T} = 2.71\,${T}`} />
                <p>
                    Each pulley the rope goes round takes its share off what’s left, so the parts
                    further from your hands lose the most.
                </p>
            </Section>
            <Section title="Worse pulleys, more pulleys">
                <div className="panel-scroll overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="text-ink-muted">
                            <tr>
                                <th className="py-1 pr-3 font-normal">Each passes on</th>
                                <th className="py-1 pr-3 font-normal">Z-rig</th>
                                <th className="py-1 font-normal">5:1</th>
                            </tr>
                        </thead>
                        <tbody>
                            {ROWS.map(({ e, what }) => (
                                <tr key={e} className="border-t border-border">
                                    <td className="py-1 pr-3">
                                        {teaching.percent(e)}{" "}
                                        <span className="text-ink-muted">({what})</span>
                                    </td>
                                    <td className="py-1 pr-3">{teaching.ratio(advantage(3, e))}</td>
                                    <td className="py-1">{teaching.ratio(advantage(5, e))}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <p>
                    With good pulleys, the 5:1 still gives about 4:1. With karabiners in place of
                    pulleys, it gives less than 2:1, barely more than the Z-rig, though you pull in
                    5 m of rope for each metre the load comes up rather than 3. More pulleys only
                    help if each one is good.
                </p>
            </Section>
            <Section title="Friction works against the rope’s run">
                <p>
                    Friction always works against the way the rope runs. Hauling, it takes away from
                    your pull. Lowering, the rope runs the other way, so friction helps you hold the
                    load back.
                </p>
            </Section>
            <Section title="Edges">
                <p>
                    A rope running over an edge, even a padded one, loses much more than a pulley
                    does, and wears the rope. An edge roller, or a high redirect that lifts the rope
                    clear of the edge, gets much of it back.
                </p>
            </Section>
        </>
    );
}

const page: VisualPage = {
    slug: "friction",
    name: "Pulley friction",
    title: "Friction eats the advantage",
    text: "Every pulley passes on a little less than it gets: that share is its efficiency. Good pulleys pass on about 90%; a karabiner, about half. Here’s the Z-rig again.",
    Figure: FrictionFigure,
    More: FrictionMore,
};

export default page;
