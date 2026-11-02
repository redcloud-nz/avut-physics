import { redirect } from "next/navigation";

import { presentHref, SLIDES } from "@/visual/pages";

/** Presenting the series starts from its first slide. */
export default function Page() {
    redirect(presentHref(SLIDES[0].slug));
}
