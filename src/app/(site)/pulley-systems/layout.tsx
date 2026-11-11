import { CONTENTS, SERIES } from "@/pulley-systems/systems";
import { Sidebar } from "@/visual/sidebar";

/**
 * The pulley systems: on a wide screen, the list of them in a column to the left of the one being looked at. Like the
 * visual introduction, it fills the screen (see `.fills-screen` in globals.css).
 */
export default function PulleySystemsLayout({ children }: LayoutProps<"/pulley-systems">) {
    return (
        <div className="fills-screen flex min-h-full shrink-0">
            <Sidebar contents={CONTENTS} series={SERIES} href="/pulley-systems" />
            <div className="flex min-w-0 flex-1 flex-col">{children}</div>
        </div>
    );
}
