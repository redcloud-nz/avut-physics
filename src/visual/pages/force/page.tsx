import type { VisualPage } from "@/visual/pages";

import { ForceFigure } from "./figure";

const page: VisualPage = {
    slug: "force",
    name: "Force",
    title: "A force is a push or a pull",
    text: "Forces are measured in newtons (N). One newton speeds 1 kg up by 1 m/s every second, so on smooth ice, 100 N does that to a 100 kg load.",
    Figure: ForceFigure,
};

export default page;
