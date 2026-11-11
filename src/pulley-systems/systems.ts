import type { Contents } from "@/visual/contents";

/*
 * The pulley systems, each on a page of its own at `/pulley-systems/<slug>`, in order of how much they gain. Their
 * drawings are in `drawing.tsx`, by the same slugs.
 */

export const SERIES = "Pulley Systems";

export const SYSTEMS = [
    { slug: "1-to-1", name: "1:1", text: "A single pulley at the anchor." },
    { slug: "2-to-1", name: "2:1", text: "A single pulley on the load." },
    {
        slug: "2-to-1-redirect",
        name: "2:1 redirected",
        text: "A 2:1, redirected down at the anchor.",
    },
    { slug: "z-rig", name: "3:1 Z-rig", text: "A Z-rig." },
    {
        slug: "3-to-1-redirect",
        name: "3:1 redirected",
        text: "A double at the anchor and a single on the load, redirected down.",
    },
    { slug: "4-to-1", name: "4:1", text: "Two double pulleys." },
    { slug: "5-to-1", name: "5:1", text: "Two double pulleys." },
    {
        slug: "5-to-1-single-pulleys",
        name: "5:1 with single pulleys",
        text: "The 9:1 Z-rig on Z-rig's pulleys, with both moving pulleys clipped to the load instead of to Prusiks.",
    },
    {
        slug: "6-to-1-redirect",
        name: "6:1 redirected",
        text: "The 5:1 with single pulleys, with one more single on the load and at the anchor, redirected down.",
    },
    {
        slug: "7-to-1",
        name: "7:1",
        text: "Two doubles at the anchor, and a double and a single on the load.",
    },
    {
        slug: "8-to-1-complex",
        name: "8:1 Complex",
        text: "The 9:1 complex, with the second rope tied to a ground anchor instead of the load.",
    },
    {
        slug: "9-to-1",
        name: "9:1 Z-Rig on Z-Rig",
        text: "A Z-rig pulling on another Z-rig, in the same rope.",
    },
    {
        slug: "9-to-1-complex",
        name: "9:1 Complex",
        text: "A 2:1 on the 4:1, tied to the load.",
    },
    {
        slug: "28-to-1",
        name: "28:1",
        text: "A 4:1 on the 7:1's rope, from a ground anchor.",
    },
] as const;

export type Slug = (typeof SYSTEMS)[number]["slug"];

export const CONTENTS: Contents = [
    { pages: SYSTEMS.map((s) => ({ name: s.name, href: `/pulley-systems/${s.slug}` })) },
];
