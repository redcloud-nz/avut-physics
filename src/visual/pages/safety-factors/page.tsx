import { Section } from "@/visual/common/details";
import type { VisualPage } from "@/visual/pages";

import { SafetyFactorsFigure } from "./figure";

function SafetyFactorsMore() {
    return (
        <>
            <Section title="Where 20 kN comes from">
                <p>
                    A rescue load is usually taken as two people: a rescuer and a patient, with
                    their gear, about 200 kg. At 10 N for each kilogram, that weighs 2 kN.
                </p>
                <p>
                    Rescue systems commonly aim for a safety factor of 10:1: every part of the
                    system should hold at least ten times what it carries before it breaks. Ten
                    times 2 kN is 20 kN. Some teams and standards use other factors: the American
                    rescue standard NFPA 1983 was built around 15:1.
                </p>
                <p>
                    It’s written like a pulley system’s 3:1, but it’s a different thing: strength
                    divided by load, not how much a system multiplies your pull.
                </p>
            </Section>
            <Section title="Check the rating">
                <p>
                    The safety factor is something you build into the system, not something the gear
                    gives you. A basic 22 kN karabiner only just clears 20 kN. Gear made for rescue
                    is usually rated higher: around 36 kN for a rescue pulley and 40 kN for an NFPA
                    general-use karabiner.
                </p>
            </Section>
            <Section title="The weakest link">
                <p>
                    A system is only as strong as its weakest part, so the safety factor that counts
                    is the weakest part’s strength divided by the force it actually holds. Work out
                    both honestly:
                </p>
                <ul className="list-disc pl-5">
                    <li>
                        Strength. A knot or a sharp bend weakens a rope, often by a quarter or more,
                        so take that off its rating.
                    </li>
                    <li>
                        Force. Spread anchors, redirects and anchor pulleys can hold more than the
                        load, as on Two anchors, Redirects and Pulley on the anchor. A 22 kN pulley
                        on the anchor with a 2 kN load doubled round it holds 4 kN, so that part is
                        only 5.5:1.
                    </li>
                </ul>
            </Section>
            <Section title="Why ten times?">
                <p>
                    The rating is what new gear breaks at in a test, pulled slowly and in the way
                    it’s built for. The factor covers what you can’t work out:
                </p>
                <ul className="list-disc pl-5">
                    <li>Wear and damage you can’t see in old or dirty gear.</li>
                    <li>
                        Misuse, such as a karabiner loaded across its gate or on its side, which
                        holds far less than the rating.
                    </li>
                    <li>Small jerks while hauling or lowering.</li>
                    <li>A load that weighs more than you guessed.</li>
                </ul>
                <p>
                    It doesn’t cover a fall onto the system. As the next page shows, a short fall
                    can pull ten times the load’s weight on its own. Keeping slack out of the system
                    and belaying is what covers that.
                </p>
            </Section>
        </>
    );
}

const page: VisualPage = {
    slug: "safety-factors",
    name: "Safety factors",
    title: "Aim for ten times the load",
    text: "A two-person rescue load weighs about 2 kN. Rescue systems commonly aim for every part to hold ten times what it carries, 20 kN here: a safety factor of 10:1. Check each part’s rating.",
    Figure: SafetyFactorsFigure,
    More: SafetyFactorsMore,
};

export default page;
