/* The pieces articles are written with: sections, tables, links, and the boxes that explain why. */

/** The site's address, written out so it can be read on paper. */
export const SITE = "physics.avut.nz";

export const LINK =
    "text-sky-400 underline-offset-2 hover:text-sky-300 hover:underline print:underline";
export const STRONG = "text-slate-100";

export function Section(props: { title: string; children: React.ReactNode }) {
    return (
        <section className="flex flex-col gap-3">
            <h2 className="text-xl font-semibold text-slate-100 print:break-after-avoid">
                {props.title}
            </h2>
            {props.children}
        </section>
    );
}

/** A table of figures; `highlight` picks out the cells to mark, such as safety factors below 1. */
export function Table(props: {
    head: string[];
    rows: string[][];
    highlight?: (cell: string, column: number) => boolean;
}) {
    return (
        <div className="overflow-x-auto rounded-lg border border-slate-800 print:break-inside-avoid print:border-black">
            <table className="w-full text-left text-sm tabular-nums">
                <thead className="bg-slate-900 text-slate-400 print:bg-transparent">
                    <tr>
                        {props.head.map((h, i) => (
                            <th key={i} className="px-3 py-2 font-medium">
                                {h}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {props.rows.map((row, i) => (
                        <tr key={i} className="border-t border-slate-800 print:border-slate-400">
                            {row.map((cell, j) => (
                                <td
                                    key={j}
                                    className={
                                        j > 0 && props.highlight?.(cell, j)
                                            ? "px-3 py-2 font-medium text-rose-300 print:underline"
                                            : "px-3 py-2"
                                    }
                                >
                                    {cell}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

/** The reasoning behind what the text has just said, closed until the reader opens it, and always open in print. */
export function Why(props: { title?: string; children: React.ReactNode }) {
    return (
        <details className="group rounded-lg border border-slate-800 bg-slate-900/50 print:break-inside-avoid print:border-slate-400 print:bg-transparent">
            <summary className="cursor-pointer px-4 py-2 text-sm font-medium text-sky-300 select-none hover:text-sky-200 print:list-none print:text-black">
                {props.title ?? "Why is this?"}
            </summary>
            <div className="flex flex-col gap-3 px-4 pt-1 pb-4 text-[0.95em]">{props.children}</div>
        </details>
    );
}
