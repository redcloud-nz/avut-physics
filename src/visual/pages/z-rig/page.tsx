import type { VisualPage } from "@/visual/pages";

import { ZRigFigure } from "./figure";

const page: VisualPage = {
    slug: "z-rig",
    name: "Z-rig",
    title: "The Z-rig: 3:1",
    text: "The main line doubles back round a travelling pulley on a rope grab (green). Three parts of rope pull the load, so the team pulls a third.",
    Figure: ZRigFigure,
};

export default page;
