import type { Contents } from "@/visual/contents";

/*
 * The pulley systems, each on a page of its own at `/pulley-systems/<slug>`, in order of how much they gain. Their
 * drawings are in `drawing.tsx`, by the same slugs.
 */

export const SERIES = "Pulley Systems";

export const SYSTEMS = [
    { slug: "one-to-one", name: "1:1", text: "A single pulley at the anchor." },
    { slug: "two-to-one", name: "2:1", text: "A single pulley on the load." },
    {
        slug: "two-to-one-redirect",
        name: "2:1 redirected",
        text: "A 2:1, redirected down at the anchor.",
    },
    { slug: "z-rig", name: "3:1 Z-rig", text: "A Z-rig." },
    { slug: "four-to-one", name: "4:1", text: "Two double pulleys." },
    { slug: "five-to-one", name: "5:1", text: "Two double pulleys." },
    {
        slug: "seven-to-one",
        name: "7:1",
        text: "Two doubles at the anchor, and a double and a single on the load.",
    },
    {
        slug: "nine-to-one",
        name: "9:1",
        text: "A Z-rig pulling on another Z-rig, in the same rope.",
    },
    {
        slug: "nine-to-one-complex",
        name: "9:1 Complex",
        text: "A 2:1 on the 4:1, tied to the load.",
    },
    {
        slug: "twenty-eight-to-one",
        name: "28:1",
        text: "A 4:1 on the 7:1's rope, from a ground anchor.",
    },
] as const;

export type Slug = (typeof SYSTEMS)[number]["slug"];

export const CONTENTS: Contents = [
    { pages: SYSTEMS.map((s) => ({ name: s.name, href: `/pulley-systems/${s.slug}` })) },
];
