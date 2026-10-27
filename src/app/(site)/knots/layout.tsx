import { knotContents } from "@/knots/knot-contents";
import { Sidebar } from "@/knots/sidebar";

/** The knots: on a wide screen, the list of them in a column to the left of the page being looked at. */
export default function KnotsLayout({ children }: LayoutProps<"/knots">) {
    return (
        <div className="flex min-h-full shrink-0">
            <Sidebar contents={knotContents()} />
            <div className="flex min-w-0 flex-1 flex-col">{children}</div>
        </div>
    );
}
