import { describe, expect, it } from "vitest";

import { PAGES, SECTIONS, SLIDES } from "./index";

describe("the series presented", () => {
    it("gives every slide its own address", () => {
        const slugs = SLIDES.map((s) => s.slug);
        expect(new Set(slugs).size).toBe(slugs.length);
    });

    it("shows every page once, in order", () => {
        const pages = SLIDES.flatMap((s) => (s.kind === "page" ? [s.page] : []));
        expect(pages).toEqual(PAGES);
    });

    it("opens each titled section with its heading", () => {
        const titled = SECTIONS.filter((s) => s.title);
        expect(titled.every((s) => s.slug)).toBe(true);
        for (const section of titled) {
            const at = SLIDES.findIndex((s) => s.slug === section.slug);
            expect(SLIDES[at]).toMatchObject({ kind: "section", title: section.title });
            expect(SLIDES[at + 1]).toMatchObject({ kind: "page", page: section.pages[0] });
        }
    });
});
