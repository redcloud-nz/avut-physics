import Link from "next/link";

import { SiteChrome } from "@/components/site-chrome";

/**
 * The 404, for an address that matches no page and for a page that isn't there (`notFound()`). Only the root layout is
 * above it, so it draws the site's chrome itself.
 */
export default function NotFound() {
    return (
        <SiteChrome>
            <main className="mx-auto w-full max-w-6xl px-4 pt-4 pb-10">
                <h1 className="text-3xl font-semibold tracking-tight text-ink-bright">
                    Page not found
                </h1>
                <p className="mt-1 text-ink-muted">
                    There’s no page at this address.{" "}
                    <Link href="/" className="text-action hover:text-highlight">
                        See everything on the site
                    </Link>
                    .
                </p>
            </main>
        </SiteChrome>
    );
}
