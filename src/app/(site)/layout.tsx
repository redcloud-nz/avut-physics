import { SiteChrome } from "@/components/site-chrome";

/** Every page of the site, inside its chrome. The knot editor, in `(editor)`, has none. */
export default function SiteLayout({ children }: LayoutProps<"/">) {
    return <SiteChrome>{children}</SiteChrome>;
}
