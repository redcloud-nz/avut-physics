/*
 * The cards under each visualisation that explain how it works out what it shows.
 */

/** A card of notes, "How this is calculated" unless given another title. */
export function NotesCard(props: { title?: string; children: React.ReactNode }) {
    return (
        <section className="flex flex-col gap-4 rounded-xl border border-border bg-surface/50 p-4 text-sm leading-relaxed text-ink-muted lg:p-6">
            <h2 className="text-base font-medium text-ink">
                {props.title ?? "How this is calculated"}
            </h2>
            {props.children}
        </section>
    );
}

/** One titled part of a notes card. */
export function Part(props: { title: string; children: React.ReactNode }) {
    return (
        <div className="flex flex-col gap-2">
            <h3 className="font-medium text-ink-soft">{props.title}</h3>
            {props.children}
        </div>
    );
}
