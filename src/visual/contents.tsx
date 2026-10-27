import Link from "next/link";

/**
 * The series' pages, numbered, with the current one picked out: in the drawer a page's title brings down, and beside
 * the page on a wide screen.
 */
export function ContentsList(props: {
    contents: { name: string; href: string }[];
    /** The page being read, if one is. */
    current?: number;
    /** Called as a link is followed, before the page changes. */
    onFollow?: () => void;
}) {
    return (
        <ol className="flex flex-col">
            {props.contents.map((page, i) => (
                <li key={page.href}>
                    <Link
                        href={page.href}
                        aria-current={i === props.current ? "page" : undefined}
                        onClick={props.onFollow}
                        className={`flex gap-3 rounded-lg px-2 py-1.5 hover:bg-surface-raised ${
                            i === props.current ? "bg-surface-raised text-highlight" : ""
                        }`}
                    >
                        <span className="w-5 shrink-0 text-right text-ghost tabular-nums">
                            {i + 1}
                        </span>
                        {page.name}
                    </Link>
                </li>
            ))}
        </ol>
    );
}
