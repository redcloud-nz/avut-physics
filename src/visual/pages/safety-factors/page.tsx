import { Section } from "@/visual/common/details";
import type { VisualPage } from "@/visual/pages";

import { SafetyFactorsFigure } from "./figure";

function SafetyFactorsMore() {
    return (
        <>
            <Section title="Where 22 kN comes from">
                <p>
                    A rescue load is usually taken as two people: a rescuer and a patient, with
                    their gear, about 200 kg. At 10 N for each kilogram, that weighs 2 kN.
                </p>
                <p>
                    Rescue systems commonly aim for a safety factor of 10:1: everything in the
                    system should hold at least ten times the load before it breaks. Ten times 2 kN
                    is 20 kN. Rescue karabiners and pulleys are typically rated at 22 kN or more, a
                    little over that, so a two-person load on them leaves 11:1.
                </p>
            </Section>
            <Section title="Why ten times?">
                <p>
                    The rating is what new gear breaks at in a test, pulled slowly and in the way
                    it’s built for. Real rescues are rougher than that, and the factor covers the
                    difference:
                </p>
                <ul className="list-disc pl-5">
                    <li>
                        Shocks. A slip, a jerk while hauling or a fall onto the system pulls much
                        harder than the load’s weight, as the next pages show.
                    </li>
                    <li>
                        Angles. Spread anchors and redirects can hold more than the load, as on Two
                        anchors and Redirects.
                    </li>
                    <li>
                        Knots and edges. A knot or a sharp bend weakens a rope, often by a quarter
                        or more.
                    </li>
                    <li>
                        Wear and misuse. Old, dirty or damaged gear, and a karabiner loaded across
                        its gate or on its side, hold far less than the rating.
                    </li>
                </ul>
            </Section>
            <Section title="The weakest link">
                <p>
                    A system is only as strong as its weakest part, so the safety factor that counts
                    is the weakest part’s strength divided by the load it holds. Check each part
                    with what it actually holds: an anchor pulley can hold twice the load, as on
                    Pulley on the anchor.
                </p>
            </Section>
        </>
    );
}

const page: VisualPage = {
    slug: "safety-factors",
    name: "Safety factors",
    title: "Gear is built to hold ten times the load",
    text: "A two-person rescue load weighs about 2 kN. Rescue gear aims to hold ten times its load: a safety factor of 10:1. So karabiners and pulleys are rated at about 22 kN.",
    Figure: SafetyFactorsFigure,
    More: SafetyFactorsMore,
};

export default page;
