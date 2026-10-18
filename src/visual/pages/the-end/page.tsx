import Link from "next/link";

import { Section } from "@/visual/common/details";
import type { VisualPage } from "@/visual/pages";

import { EndFigure } from "./figure";

const LINK = "text-sky-300 underline underline-offset-2 hover:text-sky-200";

function EndMore() {
    return (
        <>
            <Section title="Where next">
                <p>
                    <Link href="/gentle-introduction/part-1" className={LINK}>
                        A Gentle Introduction to Rescue Physics
                    </Link>{" "}
                    goes through the same ideas at more length, as an article to read through.
                </p>
                <p>
                    The{" "}
                    <Link href="/" className={LINK}>
                        visualisations
                    </Link>{" "}
                    work out real setups, such as multi-point anchors, lowers and loads on a ute,
                    with the full physics.
                </p>
            </Section>
            <Section title="Check it on the day">
                <p>
                    These pages round numbers and leave things out to keep each idea clear. Use them
                    to understand why rope systems behave as they do, and use your training, your
                    team’s standards and the gear’s ratings to build them.
                </p>
            </Section>
        </>
    );
}

const page: VisualPage = {
    slug: "the-end",
    name: "The end",
    title: "What to take away",
    text: "That’s the whole introduction. Here’s each big idea in a line: tap one to go back to its page.",
    Figure: EndFigure,
    More: EndMore,
};

export default page;
