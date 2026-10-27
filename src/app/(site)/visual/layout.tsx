import { DetailsPanelProvider } from "@/visual/details-panel";
import { CONTENTS } from "@/visual/pages";
import { Sidebar } from "@/visual/sidebar";

/** The visual introduction: on a wide screen, its contents in a column to the left of the page being read. */
export default function VisualLayout({ children }: LayoutProps<"/visual">) {
    return (
        <div className="flex min-h-full shrink-0">
            <Sidebar contents={CONTENTS} />
            <div className="flex min-w-0 flex-1 flex-col">
                <DetailsPanelProvider>{children}</DetailsPanelProvider>
            </div>
        </div>
    );
}
