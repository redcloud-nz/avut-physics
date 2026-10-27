import Link from "next/link";

/** The series' pages in their sections, in order. The pages at either end belong to no section, so have no title. */
export type Contents = { title?: string; pages: { name: string; href: string }[] }[];

/**
 * The series' pages, numbered from start to end through their sections, with the current one picked out: in the
 * drawer a page's title brings down, beside the page on a wide screen, and on the series' first page.
 */
export function ContentsList(props: {
    contents: Contents;
    /** The page being read, if one is, by its number from 0. */
    current?: number;
    /** Called as a link is followed, before the page changes. */
    onFollow?: () => void;
}) {
    // Where each section's numbering starts.
    const starts = props.contents.map((_, s) =>
        props.contents.slice(0, s).reduce((n, section) => n + section.pages.length, 0),
    );
    return (
        <div className="flex flex-col gap-3">
            {props.contents.map((section, s) => (
                <section key={section.pages[0].href} aria-label={section.title}>
                    {section.title && (
                        <h3 className="px-2 pb-1 text-xs font-medium text-ink-muted">
                            {section.title}
                        </h3>
                    )}
                    <ol className="flex flex-col">
                        {section.pages.map((page, j) => {
                            const i = starts[s] + j;
                            return (
                                <li key={page.href}>
                                    <Link
                                        href={page.href}
                                        aria-current={i === props.current ? "page" : undefined}
                                        onClick={props.onFollow}
                                        className={`flex gap-3 rounded-lg px-2 py-1.5 hover:bg-surface-raised ${
                                            i === props.current
                                                ? "bg-surface-raised text-highlight"
                                                : ""
                                        }`}
                                    >
                                        <span className="w-5 shrink-0 text-right text-ghost tabular-nums">
                                            {i + 1}
                                        </span>
                                        {page.name}
                                    </Link>
                                </li>
                            );
                        })}
                    </ol>
                </section>
            ))}
        </div>
    );
}

/** How many pages the contents list, through all their sections. */
export function pageCount(contents: Contents) {
    return contents.reduce((n, section) => n + section.pages.length, 0);
}
