import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { aboutParagraphs, endsBothWays, fullName, KNOTS, KNOTS_TITLE } from "@/knots";
import { knotContents } from "@/knots/knot-contents";
import { KnotDrawing, knotView, PAGE_SCALE, stepLabels, workedPicture } from "@/knots/knot-drawing";
import { KnotPage } from "@/knots/knot-page";

export function generateStaticParams() {
    return KNOTS.map((knot) => ({ slug: knot.slug }));
}

export async function generateMetadata(props: PageProps<"/knots/[slug]">): Promise<Metadata> {
    const { slug } = await props.params;
    const knot = KNOTS.find((k) => k.slug === slug);
    if (!knot) return {};
    return {
        title: `${fullName(knot)}, ${KNOTS_TITLE}`,
        description: knot.file.description,
        openGraph: {
            title: fullName(knot),
            description: knot.file.description,
            url: `/knots/${slug}`,
            type: "website",
        },
    };
}

// Every slug is prerendered, so moving between knots doesn't wait. Awaiting `params` outside a Suspense boundary
// keeps the 404 for a slug that isn't a knot, so this tells Next's instant-navigation check the wait is expected.
export const instant = false;

export default async function Page(props: PageProps<"/knots/[slug]">) {
    const { slug } = await props.params;
    const knot = KNOTS.find((k) => k.slug === slug);
    if (!knot) notFound();
    // The drawings are worked out here and handed over drawn, so the browser shows the same numbers (see `KnotDrawing`).
    const { file } = knot;
    const name = fullName(knot);
    const finished = workedPicture(file.knot);
    const labels = stepLabels(file.steps.map((step) => step.number));
    return (
        <KnotPage
            key={slug}
            href={`/knots/${slug}`}
            contents={knotContents()}
            type={knot.type}
            abok={knot.abok}
            name={knot.name}
            variant={knot.variant}
            description={file.description}
            about={aboutParagraphs(file)}
            // Drawn at the same size per millimetre as every other knot, so their ropes all look as thick.
            drawing={
                <KnotDrawing
                    worked={finished}
                    view={knotView(finished, endsBothWays(knot))}
                    label={`${name}, finished`}
                    scale={PAGE_SCALE}
                    className="mx-auto block"
                />
            }
            steps={
                file.steps.length
                    ? file.steps.map((step, k) => ({
                          label: labels[k],
                          caption: step.instructions,
                          // Every step in the file's frame, so the rope stays put as the steps change.
                          drawing: (
                              <KnotDrawing
                                  worked={workedPicture(step.picture)}
                                  view={file.frame}
                                  label={`${labels[k]}: ${step.instructions}`}
                                  scale={PAGE_SCALE}
                              />
                          ),
                      }))
                    : undefined
            }
        />
    );
}
