/** Full-window viewers' layout: the page fills the window and never scrolls, so a scroll over the drawing can zoom. */
export default function ViewerLayout({ children }: LayoutProps<"/">) {
    return <div className="h-dvh overflow-hidden">{children}</div>;
}
