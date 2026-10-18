import Link from "next/link";

import { visualisations } from "@/visualisations";

export default function Home() {
    return (
        <main className="mx-auto w-full max-w-6xl px-4 pt-4 pb-10">
            <header className="mb-6">
                <h1 className="text-3xl font-semibold tracking-tight text-slate-50">
                    Physics Visualisations
                </h1>
                <p className="mt-1 text-slate-400">
                    Interactive physics diagrams with adjustable parameters.
                </p>
            </header>
            <ul className="grid gap-4 sm:grid-cols-2">
                {visualisations.map((v) => (
                    <li key={v.href}>
                        <Link
                            href={v.href}
                            className="flex h-full flex-col gap-1 rounded-xl border border-slate-800 bg-slate-900/50 p-4 transition-colors hover:border-sky-500"
                        >
                            <h2 className="text-lg font-semibold text-slate-100">{v.title}</h2>
                            <p className="text-sm text-slate-400">{v.description}</p>
                        </Link>
                    </li>
                ))}
            </ul>
            <h2 className="mt-10 mb-4 text-xl font-semibold tracking-tight text-slate-50">
                Articles
            </h2>
            <ul className="grid gap-4 sm:grid-cols-2">
                <li>
                    <Link
                        href="/visual"
                        className="flex h-full flex-col gap-1 rounded-xl border border-slate-800 bg-slate-900/50 p-4 transition-colors hover:border-sky-500"
                    >
                        <h3 className="text-lg font-semibold text-slate-100">
                            A Visual Introduction to Rescue Physics
                        </h3>
                        <p className="text-sm text-slate-400">
                            The physics of rope rescue, one idea per screen, made for phones.
                        </p>
                    </Link>
                </li>
                <li>
                    <Link
                        href="/standing-body-belays"
                        className="flex h-full flex-col gap-1 rounded-xl border border-slate-800 bg-slate-900/50 p-4 transition-colors hover:border-sky-500"
                    >
                        <h3 className="text-lg font-semibold text-slate-100">
                            Standing Body Belays
                        </h3>
                        <p className="text-sm text-slate-400">
                            The best a standing body belay can do holding a stretcher still, and why
                            even that isn’t enough.
                        </p>
                    </Link>
                </li>
            </ul>
        </main>
    );
}
