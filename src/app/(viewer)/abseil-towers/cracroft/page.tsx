import { redirect } from "next/navigation";

import { RIGS } from "@/abseil-tower/rig";

/** The tower's address on its own goes to its first rig. */
export default function Page() {
    redirect(`/abseil-towers/cracroft/${RIGS[0].slug}`);
}
