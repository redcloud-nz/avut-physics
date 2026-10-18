import { COLORS } from "@/articles/colors";
import { Eq } from "@/components/tex";
import { ink, r, Section, Var } from "@/visual/common/details";
import { FRICTION } from "@/visual/common/slope";
import type { VisualPage } from "@/visual/pages";

import { SurfaceFrictionFigure } from "./figure";

const W = ink(COLORS.load, "W");
const MU = ink(FRICTION, r`\mu`);

function SurfaceFrictionMore() {
    return (
        <>
            <Section title="How hard the ground grips">
                <p>
                    Friction between the load and the ground pushes against the way the load slides.
                    How hard it can push depends on how hard the load presses into the ground,{" "}
                    <Var color={COLORS.load}>W</Var> cos <em>θ</em>, and on the surfaces: a share
                    called the grip, <Var color={FRICTION}>μ</Var>.
                </p>
                <Eq tex={r`\text{friction} = ${MU}\,${W}\cos\theta`} />
                <p>
                    A stretcher’s plastic shell on wet rock grips little; a person sliding on grass
                    or scree grips much more. The figure’s slider runs from no grip at all to a grip
                    as big as the press into the ground.
                </p>
            </Section>
            <Section title="It helps one way and costs the other">
                <p>
                    Hauling up, the load slides up, so friction pushes it down: the rope has to beat
                    the part down the slope and friction too. Lowering, the load slides down, so
                    friction pushes it up and helps the rope hold it back.
                </p>
                <Eq
                    tex={r`\text{haul} = ${W}(\sin\theta + ${MU}\cos\theta) \qquad \text{lower} = ${W}(\sin\theta - ${MU}\cos\theta)`}
                />
                <p>
                    If the most friction can give is more than the part down the slope, the load
                    holds itself and needs pulling down. That happens below the angle whose tan is{" "}
                    <Var color={FRICTION}>μ</Var>: about 22° for a grip of 40%.
                </p>
            </Section>
            <Section title="Don’t count on it">
                <p>
                    Friction is hard to know in advance and changes as you go: wet rock, a smooth
                    patch, a load that starts sliding. Once it slides, the grip usually drops a
                    little, so a load that has started moving is easier to keep moving. Plan the
                    rope system to hold the load without friction’s help.
                </p>
            </Section>
        </>
    );
}

const page: VisualPage = {
    slug: "surface-friction",
    name: "Surface friction",
    title: "The ground’s grip works against the way the load slides",
    text: "Hauling up a slope, friction adds to the pull. Lowering, it helps hold the load back, and on a gentle slope it can hold the load by itself.",
    Figure: SurfaceFrictionFigure,
    More: SurfaceFrictionMore,
};

export default page;
