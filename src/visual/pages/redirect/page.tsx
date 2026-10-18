import { Section } from "@/visual/common/details";
import type { VisualPage } from "@/visual/pages";

import { RedirectFigure } from "./figure";

function RedirectMore() {
    return (
        <>
            <Section title="Running freely">
                <p>
                    This takes the rope as running freely, as round a good pulley, so both parts
                    pull equally hard. Round a karabiner, friction makes the load side pull harder
                    than the team side while the rope runs (Pulley friction comes back to this), but
                    the redirect still feels both together. Use a pulley for a redirect where you
                    can: a karabiner adds a lot of friction and wears the rope.
                </p>
            </Section>
            <Section title="Build the redirect’s anchor for it">
                <p>
                    A tight turn pulls on the redirect with nearly twice the rope’s tension, which
                    can be more than the main anchor holds. Redirects often go on smaller or
                    improvised anchors, so build them for that force, not just the load.
                </p>
            </Section>
        </>
    );
}

const page: VisualPage = {
    slug: "redirect",
    name: "Redirects",
    title: "A redirect feels both parts",
    text: "A rope pulls just as hard on both sides of a redirect, so the redirect feels both. The tighter the rope turns, the harder it pulls. Doubled right back, it pulls with twice the rope’s tension.",
    Figure: RedirectFigure,
    More: RedirectMore,
};

export default page;
