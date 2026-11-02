import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { presentHref, SECTION_COUNT, SERIES, SLIDES } from "@/visual/pages";
import { PageSlide, SectionSlide, Slide } from "@/visual/slide";

export function generateStaticParams() {
    return SLIDES.map((s) => ({ slug: s.slug }));
}

export async function generateMetadata(
    props: PageProps<"/present/visual/[slug]">,
): Promise<Metadata> {
    const { slug } = await props.params;
    const slide = SLIDES.find((s) => s.slug === slug);
    if (!slide) return {};
    // The slides say what the series' pages say already, so search engines are pointed at the pages.
    return {
        title: `${slide.kind === "page" ? slide.page.title : slide.title}: ${SERIES}`,
        robots: { index: false },
    };
}

// As with the series' pages: every slug is prerendered, and awaiting `params` outside a Suspense boundary keeps the
// 404 for one that isn't a slide.
export const instant = false;

export default async function Page(props: PageProps<"/present/visual/[slug]">) {
    const { slug } = await props.params;
    const index = SLIDES.findIndex((s) => s.slug === slug);
    if (index < 0) notFound();
    const slide = SLIDES[index];
    const href = (i: number) =>
        i < 0 || i >= SLIDES.length ? undefined : presentHref(SLIDES[i].slug);
    // Leaving a section's heading goes to its first page.
    const exit = `/visual/${slide.kind === "page" ? slide.slug : slide.pages[0].slug}`;
    return (
        <Slide
            key={slug}
            index={index}
            total={SLIDES.length}
            section={slide.kind === "page" ? slide.section : undefined}
            prev={href(index - 1)}
            next={href(index + 1)}
            first={presentHref(SLIDES[0].slug)}
            last={presentHref(SLIDES[SLIDES.length - 1].slug)}
            exit={exit}
        >
            {slide.kind === "page" ? (
                <PageSlide title={slide.page.title} text={slide.page.text}>
                    <slide.page.Figure />
                </PageSlide>
            ) : (
                <SectionSlide
                    title={slide.title}
                    number={slide.number}
                    count={SECTION_COUNT}
                    pages={slide.pages.map((p) => p.title)}
                />
            )}
        </Slide>
    );
}
