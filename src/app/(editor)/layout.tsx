/** The knot editor's layout: it fills the window, with none of the site's chrome (no scroll box, no footer). */
export default function EditorLayout({ children }: LayoutProps<"/">) {
    return <div className="h-dvh overflow-hidden">{children}</div>;
}
