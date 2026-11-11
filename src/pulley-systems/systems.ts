import type { Contents } from "@/visual/contents";

/*
 * The pulley systems, each on a page of its own at `/pulley-systems/<slug>`, in order of how much they gain. Their
 * drawings are in `drawing.tsx`, by the same slugs.
 */

export const SERIES = "Pulley Systems";

export const SYSTEMS = [
    {
        slug: "1-to-1",
        name: "1:1",
        text: "A single pulley at the anchor.",
    },
    {
        slug: "2-to-1",
        name: "2:1",
        text: "A single pulley on the load.",
    },
    {
        slug: "2-to-1-redirect",
        name: "2:1 redirected",
        text: "A single pulley on the load, and a second at the anchor turning the team's rope down.",
    },
    {
        slug: "z-rig",
        name: "3:1 Z-rig",
        text: "A pulley at the anchor, and a second on a Prusik on the load's rope.",
    },
    {
        slug: "3-to-1-redirect",
        name: "3:1 redirected",
        text: "A double pulley at the anchor and a single on the load, with the team's rope turned down at the anchor.",
    },
    {
        slug: "4-to-1",
        name: "4:1",
        text: "Two double pulleys, with the rope tied to the one at the anchor.",
    },
    {
        slug: "5-to-1",
        name: "5:1",
        text: "Two double pulleys, with the rope tied to the one on the load.",
    },
    {
        slug: "5-to-1-single-pulleys",
        name: "5:1 with single pulleys",
        text: "Two single pulleys at the anchor and two on the load.",
    },
    {
        slug: "6-to-1-redirect",
        name: "6:1 redirected",
        text: "Three single pulleys at the anchor and three on the load, with the team's rope turned down at the anchor.",
    },
    {
        slug: "7-to-1",
        name: "7:1",
        text: "Two double pulleys at the anchor, and a double and a single on the load.",
    },
    {
        slug: "8-to-1-complex",
        name: "8:1 Complex",
        text: "Two double pulleys with the rope's end on a single pulley, and a second rope from a ground anchor round that single.",
    },
    {
        slug: "9-to-1",
        name: "9:1 Z-Rig on Z-Rig",
        text: "Two pulleys at the anchor, and two on Prusiks, all in one rope.",
    },
    {
        slug: "9-to-1-complex",
        name: "9:1 Complex",
        text: "Two double pulleys with the rope's end on a single pulley, and a second rope from the load round that single.",
    },
    {
        slug: "28-to-1",
        name: "28:1",
        text: "Two double pulleys at the anchor and a double and a single on the load, pulled by two more pulleys on a Prusik from a ground anchor.",
    },
] as const;

export type Slug = (typeof SYSTEMS)[number]["slug"];

export const CONTENTS: Contents = [
    { pages: SYSTEMS.map((s) => ({ name: s.name, href: `/pulley-systems/${s.slug}` })) },
];
