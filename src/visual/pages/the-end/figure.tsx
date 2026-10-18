import { ChevronRight } from "lucide-react";
import Link from "next/link";

import { COLORS } from "@/articles/colors";

/** The series' big ideas, a line each, with the page each one comes from. */
const IDEAS: { slug: string; color: string; idea: string }[] = [
    { slug: "weight", color: COLORS.load, idea: "100 kg weighs about 1 kN." },
    { slug: "equilibrium", color: COLORS.pull, idea: "When nothing moves, the forces cancel." },
    {
        slug: "two-anchors",
        color: COLORS.sideways,
        idea: "Spread anchors hold more: at 120°, each holds the whole load.",
    },
    { slug: "redirect", color: COLORS.redirect, idea: "A redirect feels both parts of the rope." },
    {
        slug: "counting",
        color: COLORS.pull,
        idea: "In a simple system, count the parts that get shorter; the T method works on any.",
    },
    { slug: "friction", color: "#fb923c", idea: "Friction eats the advantage." },
    { slug: "inclines", color: COLORS.redirect, idea: "On a slope, the rope holds only part." },
    {
        slug: "safety-factors",
        color: COLORS.load,
        idea: "Aim for every part to hold ten times what it carries.",
    },
    { slug: "shock-loading", color: "#fda4af", idea: "Falling doesn’t hurt; stopping does." },
];

export function EndFigure() {
    return (
        <ul className="my-auto flex flex-col gap-1.5">
            {IDEAS.map((i) => (
                <li key={i.slug}>
                    <Link
                        href={`/visual/${i.slug}`}
                        className="flex items-center gap-3 rounded-lg bg-slate-900/60 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800"
                    >
                        <span
                            className="size-2.5 shrink-0 rounded-full"
                            style={{ background: i.color }}
                        />
                        <span className="flex-1">{i.idea}</span>
                        <ChevronRight className="size-4 shrink-0 text-slate-500" aria-hidden />
                    </Link>
                </li>
            ))}
        </ul>
    );
}
