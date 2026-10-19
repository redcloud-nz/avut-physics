import type { Metadata } from "next";
import Link from "next/link";

import { BelayerForcesDiagram } from "@/articles/belayer-forces-diagram";
import { LINK, Section, SITE, STRONG, Table } from "@/articles/prose";
import { SetupDiagram } from "@/articles/setup-diagram";
import { DEFAULTS, FIGURES } from "@/articles/standing-body-belays-figures";
import { StretcherWeightGraph } from "@/articles/stretcher-weight-graph";
import { Eq, M } from "@/components/tex";
import { degrees, kg, newtons } from "@/lib/format";
import { SURFACES } from "@/visualisations/body-belay-surfaces";

const TITLE = "Standing Body Belays";
const DESCRIPTION =
    "The best a standing body belay can do: how much grip a belayer’s boots need to hold a stretcher still, and why even that leaves too little margin.";

export const metadata: Metadata = { title: TITLE, description: DESCRIPTION };

const r = String.raw;

/** A safety factor, to two places. */
const sf = (x: number) => x.toFixed(2);

/** A list, joined with commas and a final "and". */
const listed = (items: string[]) =>
    items.length < 2
        ? items.join("")
        : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;

export default function Page() {
    const { hold, pairs, training, heaviest, weightTable, placingTable } = FIGURES;
    const { training: trainingPair, real, heavy } = pairs;
    const [equalLight, equalHeavy] = FIGURES.equal;
    const bestPlacing = Math.max(...placingTable.safety.flat());
    const backup = 1.5;
    const wetSteel = SURFACES.find((s) => s.key === "painted-steel")!.wet;
    const wetHold = wetSteel / hold.gripNeeded;
    const footings = SURFACES.flatMap((s) => [
        { label: `dry ${s.label.toLowerCase()}`, safety: s.dry / hold.gripNeeded },
        { label: `wet ${s.label.toLowerCase()}`, safety: s.wet / hold.gripNeeded },
    ]);
    const slipping = footings.filter((f) => f.safety < 1).map((f) => f.label);
    const best = Math.max(...footings.map((f) => f.safety));

    return (
        <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 pt-4 pb-16 text-base leading-relaxed text-ink-soft print:max-w-none print:px-0 print:text-[11pt] print:**:text-black">
            <Link href="/" className="text-sm text-link hover:text-highlight print:hidden">
                ← Physics Visualisations
            </Link>

            <header className="flex flex-col gap-2">
                <h1 className="text-3xl font-semibold tracking-tight text-ink-bright">{TITLE}</h1>
                <p className="text-lg text-ink-muted">{DESCRIPTION}</p>
                <p className="text-sm text-ghost">
                    Article · October 2026 · Online at{" "}
                    <Link href="/standing-body-belays" className={LINK}>
                        {SITE}/standing-body-belays
                    </Link>
                </p>
            </header>

            <section className="flex flex-col gap-3 rounded-xl border border-summary/40 bg-summary/5 p-5 print:break-inside-avoid print:border-black print:bg-transparent">
                <h2 className="text-lg font-semibold text-summary-heading">In short</h2>
                <ul className="flex list-disc flex-col gap-2 pl-5">
                    <li>
                        A belayer standing to hold a stretcher’s rope is kept from sliding towards
                        the edge by nothing but the grip of their boots. This article works out how
                        much grip that takes, with the stretcher held still.
                    </li>
                    <li>
                        The figures here are the absolute best case. They take it that the belayer
                        stands perfectly still, never topples, and never lets the rope run through
                        their hands. Any of those can fail first, and well short of these figures.
                    </li>
                    <li>
                        For a common case, two {DEFAULTS.belayerMass} kg belayers on a high cube
                        container holding a {DEFAULTS.stretcherMass} kg stretcher, the safety factor
                        (how many times over their boots could give the grip needed; below 1, they
                        slide) is at best about {sf(hold.safety)} on a clean, dry roof. On a wet one
                        it’s about {sf(wetHold)}, and their feet slide.
                    </li>
                    <li>
                        It seems to work in training because the belayers are usually heavier than
                        the mock casualty. A {trainingPair.belayer} kg belayer holding a{" "}
                        {trainingPair.stretcher} kg stretcher has a safety factor of about{" "}
                        {sf(trainingPair.safety)}. A {real.belayer} kg belayer holding a{" "}
                        {real.stretcher} kg casualty and stretcher has about {sf(real.safety)}:
                        their feet slide even on a dry roof.
                    </li>
                    <li>
                        Changing where they stand, leaning harder or adding a backup belayer doesn’t
                        get even the best case to a safety factor of 2 in every arrangement, the
                        least a footing that rescuers rely on should have.
                    </li>
                    <li>
                        <strong className="text-ink-strong">Conclusion:</strong> standing body
                        belays shouldn’t be used to lower or hold a stretcher. Use a hard belay,
                        where the rope runs round a solid anchor rather than round a rescuer. A
                        seated body belay, with the feet braced against something solid, should be
                        kept only as an emergency backup.
                    </li>
                </ul>
            </section>

            <Section title="What the manual already says">
                <p>
                    The General Rescue Manual (Ministry of Civil Defence & Emergency Management,
                    March 2006) already points away from body belays for stretchers:
                </p>
                <ul className="flex list-disc flex-col gap-2 pl-5">
                    <li>
                        Its body belay (10.7) is a <em>seated</em> one, on stable ground, and
                        “should never be used if there is any risk of a rescuer/rescuers being
                        required to hold the whole weight of the stretcher.”
                    </li>
                    <li>
                        For the two-point lower (10.11), “as the weight is taken by two points a
                        hard belays should be used rather than a waist belay whenever possible.”
                    </li>
                    <li>
                        The hazard tables for the lowers list, against losing rope control, “Use
                        hard belays whenever possible.”
                    </li>
                </ul>
                <p>
                    The manual doesn’t describe a standing body belay at all, yet it’s what teams
                    commonly use for a two-point lower (a rope from above to the stretcher’s head,
                    and a line from its foot to a team on the ground) off a roof or wall. In a
                    two-point lower, the belayers <em>are</em> holding the stretcher’s weight, from
                    the moment it goes over the edge. This article works out the most they could
                    hope to hold.
                </p>
            </Section>

            <Section title="The case being looked at">
                <SetupDiagram />
                <p>
                    Figure 1 shows the lower, off a high cube shipping container. Each belayer has
                    the rope round their waist. Seen from above, the two ropes run from belayers{" "}
                    {DEFAULTS.gap} m apart to the one point at the stretcher’s head, so they splay
                    apart in a V. The ground team pulls steadily, about {kg(DEFAULTS.teamPull)}, to
                    keep the stretcher off the wall. The roof is dry painted steel.
                </p>
                <p>
                    The belayers are holding the stretcher still, just after it has gone over the
                    edge. That’s what happens when the lower stops for a snag, a call to stop, or a
                    slip. While the rope is running, the edge’s friction takes part of the load, but
                    once it stops, that friction can act either way, depending on how the rope
                    settled, so it isn’t counted here. On a container, teams often keep the rope
                    running and hand over to the ground team within seconds, but anything that stops
                    the lower leaves the belayers holding it like this.
                </p>
                <p>
                    The weights are chosen to be ordinary rather than extreme.{" "}
                    {DEFAULTS.belayerMass} kg is a typical adult rescuer. {DEFAULTS.stretcherMass}{" "}
                    kg is a modest real load: an 80 kg casualty in a Ferno Model 71 basket
                    stretcher, which weighs 13.5 kg with its straps and footplate (Ferno Australia),
                    plus at least 1.5 kg for the blanket and extra lashings the manual calls for. A
                    real load is a whole adult plus the stretcher, so it’s usually heavier than any
                    one belayer, and often much heavier. The section on training below shows how the
                    figures change with the stretcher’s weight.
                </p>
            </Section>

            <Section title="Why only grip matters">
                <BelayerForcesDiagram />
                <p>
                    Figure 2 shows the forces on one belayer. Two things act on them: their weight,
                    down, and the rope’s pull at their waist, towards the edge and a little
                    downwards. The only thing that can stop them is the ground under their boots. It
                    pushes up on them (
                    <M tex="N" />, their weight plus the rope’s downward pull), and its grip pushes
                    back away from the edge (
                    <M tex="F" />, which must match the rope’s pull towards the edge). The grip
                    boots can give is at most <M tex={r`\mu_f N`} />, where <M tex={r`\mu_f`} /> is
                    the friction coefficient between their soles and the ground: how hard they can
                    be pushed sideways, for each unit they’re pressed together, before they slide.
                    So with the rope’s tension <M tex="T" /> at an angle <M tex={r`\beta`} /> below
                    level:
                </p>
                <Eq
                    tex={r`\text{grip needed} = \frac{F}{N} = \frac{T\cos\beta}{W_b + T\sin\beta}`}
                />
                <Eq tex={r`\text{safety factor} = \frac{\mu_f}{\text{grip needed}}`} />
                <p>
                    A safety factor of 2 means the boots could grip twice as hard as they need to;
                    at 1, they’re on the point of sliding.
                </p>
                <p>
                    Leaning back doesn’t appear in it. A belayer leans until their body lines up
                    with that push from the ground, so they don’t topple, but how far they lean
                    doesn’t change the push itself. Either way the total grip their boots must give
                    is the same, and a wide or staggered stance doesn’t change it either.
                </p>
                <p>
                    In the common case, each rope holds {newtons(hold.loadTension)} (about{" "}
                    {kg(hold.loadTension)}): a little more than half the stretcher, because the
                    ropes splay apart and the ground team’s pull adds to it. The ground pushes up on
                    each belayer with {newtons(hold.up)} and their boots must grip with{" "}
                    {newtons(hold.sideways)}, so the grip needed is {hold.gripNeeded.toFixed(2)}.
                    Dry painted steel gives about {DEFAULTS.grip} (see Footing), for a safety factor
                    of {sf(hold.safety)}.
                </p>
            </Section>

            <Section title="Why this is the best case">
                <p>
                    Grip is only one of the ways a standing body belay can fail. The figures here
                    take it that the other ways never happen first, so they’re the most a belay
                    could give, not what to expect of one. Three things in particular can bring the
                    real figure well below them:
                </p>
                <ul className="flex list-disc flex-col gap-2 pl-5">
                    <li>
                        <strong className={STRONG}>Toppling.</strong> The figures take the belayer
                        to lean at exactly the right angle, in the common case about{" "}
                        {degrees(hold.lean)} back from upright, and to hold it. Leaning less, the
                        rope pulls them over towards the edge; leaning more, they fall back.
                        Standing like that is a balancing act, and when the load changes, as it does
                        with every jerk on the rope, the lean it needs changes at once. A belayer
                        pulled forward has to step to catch themselves, and a foot in the air grips
                        nothing.
                    </li>
                    <li>
                        <strong className={STRONG}>Holding the rope.</strong> The rope is held by
                        its friction round the belayer’s waist and by their brake hand. Under a
                        heavy load it can run through before their feet slide, dropping the
                        stretcher instead, and a hand’s grip tires within minutes.
                    </li>
                    <li>
                        <strong className={STRONG}>Sharing the grip.</strong> The figures take the
                        grip to be shared between their boots in proportion to the weight on each.
                        In a staggered stance, or while shifting their weight, one foot carries
                        little weight but is still asked to grip, and that foot slides first.
                        Sliding boots grip less than still ones, so the other foot must then make up
                        the difference with less grip on offer, and it can follow.
                    </li>
                </ul>
                <p>
                    Experiments bear this out. Men pulling a handle as hard as they could, on a
                    floor with a friction coefficient of about 0.48, managed on average only about a
                    fifth of their body weight: under half what friction alone would allow (Chen and
                    others, 2011). In earlier tests, men pushing until they almost slipped used only
                    about half to four fifths of the grip on offer (Kroemer and Robinson, 1971).
                    Neither was a body belay, but both point the same way: people give way well
                    before the friction limit that these figures are worked out from. How far below
                    it a body belay fails hasn’t been measured.
                </p>
            </Section>

            <Section title="Footing">
                <p>
                    Twice the friction coefficient gives twice the safety factor, so it changes a
                    lot with the surface. The steel figures follow measurements with standard slip
                    testers (English and Marletta, 1995; Vidal, 2010). Smooth painted steel measured
                    0.7 to 0.9 dry; this takes {DEFAULTS.grip}, the low end, to allow for weathered
                    paint. Wet, it measured as little as 0.14 to 0.26 with glossy paints, and more
                    with primers; this takes {wetSteel}. The testers use a standard rubber pad
                    rather than boot soles, so even these are a guide. The other surfaces’ figures
                    are rough, middle-of-the-range estimates for rubber-soled boots. The real value
                    varies a lot with the tread and its wear, the surface’s finish, and any dust,
                    frost, oil or mud.
                </p>
                <Table
                    head={["Surface", "Dry", "Wet"]}
                    rows={SURFACES.map((s) => [
                        s.label,
                        sf(s.dry / hold.gripNeeded),
                        sf(s.wet / hold.gripNeeded),
                    ])}
                    highlight={(cell) => Number(cell) < 1}
                />
                <p>
                    Holding still, {listed(slipping)} are all below 1. Even the best, dry concrete
                    or rough rock, gives only {sf(best)}: none reaches 2, even in the best case.
                </p>
            </Section>

            <Section title="Why it seems to work in training">
                <p>
                    What matters is how heavy the stretcher is compared with the belayers. In
                    training the belayers are usually heavier than the mock casualty, which makes it
                    look much safer than it is with a real casualty, a stretcher, blankets and
                    lashings.
                </p>
                <StretcherWeightGraph />
                <p>
                    In Figure 3, on dry steel, a training load of {training.from}–{training.to} kg
                    gives a safety factor of about {sf(training.safety[1])} to{" "}
                    {sf(training.safety[0])}, and only loads up to about {heaviest.reachesTwo} kg
                    reach 2. A real casualty in a stretcher, {DEFAULTS.stretcherMass} kg or more,
                    gives about {sf(hold.safety)} or less, and from about {heaviest.slides + 1} kg
                    the belayer’s feet slide even on a dry roof. On wet steel, only loads up to
                    about {heaviest.wetHolds} kg stay above 1.
                </p>
                <p>
                    When the belayers and stretcher weigh the same, the safety factor stays between
                    about {sf(equalLight.safety)} and {sf(equalHeavy.safety)}, from{" "}
                    {equalLight.mass} kg to {equalHeavy.mass} kg. A team that has only ever held
                    light mock casualties has trained with a margin a real casualty won’t give them.
                </p>
                <p>
                    For other weights, the table below gives the safety factor on dry painted steel,
                    with everything else as in Figure 1. Roughly, it’s the stretcher’s weight
                    compared with the belayer’s that sets it.
                </p>
                <Table
                    head={[
                        "Belayer ↓ / stretcher →",
                        ...weightTable.stretchers.map((m) => `${m} kg`),
                    ]}
                    rows={weightTable.belayers.map((b, i) => [
                        `${b} kg`,
                        ...weightTable.safety[i].map(sf),
                    ])}
                    highlight={(cell) => Number(cell) < 1}
                />
            </Section>

            <Section title="What doesn’t fix it">
                <p>
                    <strong className={STRONG}>Standing somewhere else.</strong> Standing closer
                    together, the ropes splay less, so each carries less. Standing nearer the edge,
                    the rope pulls them more steeply downwards, so the ground pushes up harder, but
                    the V opens wider for the same spacing, so spacing matters more there. The table
                    below gives the safety factor for each placing, with everything else as in
                    Figure 1.
                </p>
                <Table
                    head={["Back from edge ↓ / apart →", ...placingTable.gaps.map((g) => `${g} m`)]}
                    rows={placingTable.backs.map((b, i) => [
                        `${b} m`,
                        ...placingTable.safety[i].map(sf),
                    ])}
                    highlight={(cell) => Number(cell) < 1}
                />
                <p>
                    The best placing, shoulder to shoulder and {placingTable.backs[0]} m from the
                    edge, gives {sf(bestPlacing)}: still short of 2. And rescuers within 2 m of the
                    edge should be tied off anyway, and an anchor good enough to tie off to is good
                    enough for a hard belay.
                </p>
                <p>Nor do these:</p>
                <ul className="flex list-disc flex-col gap-2 pl-5">
                    <li>
                        <strong className={STRONG}>Leaning harder, or a staggered stance.</strong>{" "}
                        As above, these don’t change the total grip needed, and a staggered stance
                        can make one foot slide first.
                    </li>
                    <li>
                        <strong className={STRONG}>Sitting down, without bracing the feet.</strong>{" "}
                        With their waist lower, the rope pulls them more nearly level and less
                        downwards, so the ground pushes up less. That cancels out what sitting
                        gains: a seated belayer whose feet only grip does about as well as a
                        standing one.
                    </li>
                    <li>
                        <strong className={STRONG}>A backup belayer.</strong> A second rescuer in
                        front, leaning back into the belayer, adds their grip. If they add half as
                        much grip as the belayer, the safety factor rises by half, to about{" "}
                        {sf(hold.safety * backup)}. That only just reaches 2, and only in the common
                        case on a dry roof. It relies on two people’s footing and on the backup
                        staying pressed into the belayer. With a {real.stretcher} kg casualty it’s
                        about {sf(real.safety * backup)}, and on a wet roof about{" "}
                        {sf(wetHold * backup)}: well short of 2.
                    </li>
                    <li>
                        <strong className={STRONG}>Heavier belayers.</strong> This helps, but only
                        compared with the load. A {heavy.belayer} kg belayer holding a{" "}
                        {heavy.stretcher} kg casualty is back down to {sf(heavy.safety)}.
                    </li>
                </ul>
                <p>
                    All of these are best-case figures too, before toppling, the rope running or
                    uneven grip.
                </p>
            </Section>

            <Section title="What does work">
                <ul className="flex list-disc flex-col gap-2 pl-5">
                    <li>
                        <strong className={STRONG}>A hard belay.</strong> The rope runs round a
                        solid anchor through a Munter hitch (or another friction device), so the
                        load goes into structure rather than through the rescuers’ boots. Real
                        anchors should always be the first choice, and this is what the manual
                        already asks for whenever possible.
                    </li>
                    <li>
                        <strong className={STRONG}>Braced feet.</strong> A seated belayer whose feet
                        are set against something solid (a parapet, a kerb, a beam) is held by that,
                        not by friction, and is far stronger. It’s the only kind of body belay that
                        does better than the boots’ grip, but it should still be an emergency backup
                        only, for when there’s truly no anchor. It isn’t modelled here.
                    </li>
                </ul>
            </Section>

            <Section title="Conclusion">
                <p>
                    Even in the best case, a standing body belay can’t hold a real stretcher with a
                    safe margin, and on a wet roof it can’t hold one at all. So:
                </p>
                <ol className="flex list-decimal flex-col gap-2 pl-5">
                    <li>Standing body belays shouldn’t be used to lower or hold a stretcher.</li>
                    <li>
                        Stretcher lowers should use hard belays from real anchors, which are always
                        the first choice.
                    </li>
                    <li>
                        A seated body belay, with the feet braced against something solid, should be
                        kept as an emergency backup only, for when there’s truly no anchor.
                    </li>
                    <li>
                        Any belay that relies on rescuers’ footing should show a safety factor of at
                        least 2, in every arrangement it’s used in and allowing for likely jerks and
                        dynamic loads.
                    </li>
                    <li>
                        In training, mock casualties should be at least as heavy as the belayers,
                        and preferably as heavy as a real casualty in a loaded stretcher, so that
                        what teams learn matches what they’ll meet.
                    </li>
                </ol>
            </Section>

            <Section title="How the figures were worked out">
                <p>Each figure comes from a static model of the lower, solved numerically:</p>
                <ul className="flex list-disc flex-col gap-2 pl-5">
                    <li>
                        The stretcher is a rigid 2 m bar. It settles where its weight, the ropes and
                        the ground team’s steady pull balance, without passing through the wall or
                        the ground.
                    </li>
                    <li>
                        Each rope runs from the stretcher’s head, over the edge by the shortest
                        path, to its belayer’s waist 1 m up. Seen from above, the two ropes form a
                        V; the wider it opens, the more each rope carries. The edge’s friction isn’t
                        counted.
                    </li>
                    <li>
                        Each belayer is a straight, rigid body from their feet to their head,
                        leaning back until it lines up with the push from the ground. The grip
                        needed and the safety factor then follow as above.
                    </li>
                </ul>
                <p>
                    To explore further, an interactive version of the same model, where any of the
                    settings can be changed, including the edge’s friction while lowering, is at{" "}
                    <Link href="/body-belay" className={LINK}>
                        {SITE}/body-belay
                    </Link>
                    .
                </p>
            </Section>

            <Section title="What else the figures leave out">
                <p>
                    Besides the three things in Why this is the best case, the model leaves out
                    more, and almost all of it makes things worse for the belayers:
                </p>
                <ul className="flex list-disc flex-col gap-2 pl-5">
                    <li>
                        It’s static. A jerk, such as the stretcher dropping as it goes over the edge
                        or a belayer slipping, briefly loads the rope far more.
                    </li>
                    <li>
                        The two belayers share the load evenly. In practice one usually takes more.
                    </li>
                    <li>
                        The ground is level and clean. A patch of grit, frost or oil under one boot
                        is enough to bring the safety factor down.
                    </li>
                    <li>
                        The edge’s friction isn’t counted. Depending on how the rope settled, it
                        could help the belayers a little or add to their load.
                    </li>
                    <li>
                        The rope and line don’t stretch, and the rope’s strength over the edge isn’t
                        modelled.
                    </li>
                </ul>
            </Section>

            <Section title="Sources">
                <ul className="flex list-disc flex-col gap-2 pl-5">
                    {SOURCES.map((source) => (
                        <li key={source.cite}>
                            {source.cite} <em>{source.title}</em>. {source.from}
                            {source.url && (
                                <>
                                    {" "}
                                    Online at{" "}
                                    <a href={source.url} className={LINK}>
                                        {source.url.replace(/^https:\/\/(www\.)?/, "")}
                                    </a>
                                    .
                                </>
                            )}
                        </li>
                    ))}
                </ul>
            </Section>

            <Section title="Terms used">
                <dl className="flex flex-col gap-2">
                    {TERMS.map(([term, meaning]) => (
                        <div key={term}>
                            <dt className="inline font-medium text-ink-strong">{term}: </dt>
                            <dd className="inline">{meaning}</dd>
                        </div>
                    ))}
                </dl>
            </Section>
        </main>
    );
}

/** Terms a reader may not know, in plain words. */
const TERMS: [string, string][] = [
    [
        "Body belay",
        "a belay where the rope runs round the belayer’s body, usually their waist, and is held by its friction there and by their brake hand. Also called a waist belay. A standing body belay is one done standing up.",
    ],
    ["Brake hand", "the belayer’s hand that grips the rope to stop it running."],
    ["Ferno Model 71", "a common basket stretcher."],
    [
        "Friction coefficient",
        "how hard two surfaces can be pushed along each other, for each unit they’re pressed together, before they slide.",
    ],
    [
        "Hard belay",
        "a belay where the rope runs to or round a solid anchor, such as a structural member or a vehicle, so the anchor takes the load rather than a rescuer.",
    ],
    ["High cube container", "a shipping container 2.89 m tall, against the standard 2.59 m."],
    [
        "Munter hitch",
        "a friction hitch tied round a carabiner, which lets one rescuer control a heavy load on a rope running through it.",
    ],
    ["Newton (N)", "a unit of force. The weight of 1 kg is about 10 N."],
    [
        "Rope, line",
        "here, the rope runs from the belayers over the edge to the stretcher’s head; the line runs from its foot to the ground team.",
    ],
    [
        "Safety factor",
        "how many times over something could do what’s asked of it. For a rope, its breaking force over its load; for a belayer’s footing, the grip their boots can give over the grip needed. Below 1, it fails.",
    ],
    ["Tied off", "clipped to an anchor, so a slip can’t take a rescuer over the edge."],
    [
        "Two-point lower",
        "a stretcher lower with a rope from above to the stretcher’s head and a line from its foot to a team on the ground, who keep it off the wall.",
    ],
];

/** The article's sources, in the order of their authors' names. */
const SOURCES: { cite: string; title: string; from: string; url?: string }[] = [
    {
        cite: "Chen, Y.-L., Lee, Y.-C. and Hsu, T.-C. (2011).",
        title: "Isometric Push and Pull Strengths of Young Taiwanese Males",
        from: "Industrial Health 49, 696–702.",
        url: "https://www.jniosh.johas.go.jp/en/indu_hel/doc/IH_49_6_696.pdf",
    },
    {
        cite: "English, W. and Marletta, W. (1995).",
        title: "An Investigation of Surface Slip Resistance on Structural Steel",
        from: "CPWR, the Center to Protect Workers’ Rights. Table 2, averaged over its two slip testers.",
        url: "https://stacks.cdc.gov/view/cdc/192919",
    },
    {
        cite: "Ferno Australia (n.d.).",
        title: "Ferno 71 and Ferno 71S Basket Stretcher",
        from: "Product page.",
        url: "https://www.ferno.com.au/products/emergency-and-rescue/rescue-stretchers/basket-stretchers/ferno-71-and-ferno-71s-basket-stretcher/",
    },
    {
        cite: "Kroemer, K. H. E. and Robinson, D. E. (1971).",
        title: "Horizontal Static Forces Exerted by Men Standing in Common Working Positions on Surfaces of Various Tractions",
        from: "AMRL-TR-70-114, Aerospace Medical Research Laboratory, Wright-Patterson Air Force Base. Table II.",
        url: "https://apps.dtic.mil/sti/pdfs/AD0720252.pdf",
    },
    {
        cite: "Ministry of Civil Defence & Emergency Management (2006).",
        title: "General Rescue Manual",
        from: "March 2006 edition, now available from the National Emergency Management Agency (NEMA). Sections 5.9, 10.7 and 10.11, and the hazard tables for the lowers.",
    },
    {
        cite: "Vidal, K. E. (2010).",
        title: "Comparison of Slip Resistance of Tread Plate and Smooth Steel with Various Finishes Using a Variable Incidence Tribometer",
        from: "Proceedings of the American Academy of Forensic Sciences, C22.",
        url: "https://www.aafs.org/sites/default/files/media/documents/AAFS-2010-C22.pdf",
    },
];
