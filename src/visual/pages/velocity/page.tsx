import { Eq } from "@/components/tex";
import { r, Section } from "@/visual/common/details";
import type { VisualPage } from "@/visual/pages";

import { VelocityFigure } from "./figure";

function VelocityMore() {
    return (
        <Section title="Metres per second and kilometres per hour">
            <p>
                Road speeds are in kilometres per hour (km/h). A kilometre is 1000 m and an hour is
                3600 seconds, so something going 1 m/s goes 3600 m in an hour, which is 3.6 km:
            </p>
            <Eq tex={r`1\,\text{m/s} = 3600\,\text{m/h} = 3.6\,\text{km/h}`} />
            <p>
                So to turn m/s into km/h, multiply by 3.6. To go back, divide by 3.6. A few to get a
                feel for it:
            </p>
            <ul className="list-disc pl-5">
                <li>Walking: about 1.4 m/s, or 5 km/h.</li>
                <li>Something dropped, after one second: about 10 m/s, or 36 km/h.</li>
                <li>The open road: 100 km/h, or about 28 m/s.</li>
            </ul>
        </Section>
    );
}

const page: VisualPage = {
    slug: "velocity",
    name: "Velocity",
    title: "Velocity is how fast something goes",
    text: "Something moving at 2 metres per second (2 m/s) goes another 2 m every second. The marks are where it was after each second: evenly spaced, because its velocity doesn’t change.",
    Figure: VelocityFigure,
    More: VelocityMore,
};

export default page;
