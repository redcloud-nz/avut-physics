/** The series presented as slides: they fill the window, with none of the site's chrome (no scroll box, no footer). */
export default function PresentLayout({ children }: LayoutProps<"/">) {
    return <div className="h-dvh overflow-hidden">{children}</div>;
}
