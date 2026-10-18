import type { Metadata } from "next";
import Link from "next/link";

import { legShare, preEqualised, redirectShare } from "@/articles/gentle-introduction";
import {
    ForcesFigure,
    LegPartsFigure,
    PythagorasFigure,
    RedirectFigure,
    SwingFigure,
    TwoLegsFigure,
} from "@/articles/gentle-introduction-figures";
import { LINK, Section, SITE, STRONG, Table, Why } from "@/articles/prose";
import { Eq } from "@/components/tex";
import { G } from "@/lib/constants";
import { kg } from "@/lib/format";
import { rad } from "@/lib/math";

const TITLE = "A Gentle Introduction to Rescue Physics";
const SUBTITLE = "Part 1: Weight, force and angles";
const DESCRIPTION =
    "What a load really puts on your ropes and anchors: weight and kilonewtons, forces as arrows, and why the angles in a rig matter so much. No equations needed.";

export const metadata: Metadata = { title: `${TITLE}, ${SUBTITLE}`, description: DESCRIPTION };

const r = String.raw;
const HREF = "/gentle-introduction/part-1";

/** The tag line example in Figure 1's "Why is this?". */
const TAGGED = { mass: 200, lean: 30 };
const tagged = {
    side: TAGGED.mass * Math.tan(rad(TAGGED.lean)),
    rope: TAGGED.mass / Math.cos(rad(TAGGED.lean)),
};

const percent = (share: number) => `${Math.round(share * 100)}%`;
/** A mass's weight in kilonewtons, to one place. */
const kN = (mass: number) => `${((mass * G) / 1000).toFixed(1)} kN`;

const LEG_ANGLES = [0, 30, 60, 90, 120, 150, 170];
const REDIRECT_ANGLES = [0, 30, 60, 90, 120, 150, 180];
/** How far off straight down the main line pulls in the text's example, and the rig figure 3 draws. */
const SWING = 20;
const RIG = { gap: 1, leg: 1 };
/** The example of legs spread wide: a 200 kg load on legs 150° apart. */
const WIDE = { mass: 200, angle: 150 };

export default function Page() {
    const pre = preEqualised(RIG, rad(SWING));
    const wide = legShare(rad(WIDE.angle)) * WIDE.mass;

    return (
        <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 pt-4 pb-16 text-base leading-relaxed text-slate-300 print:max-w-none print:px-0 print:text-[11pt] print:**:text-black">
            <Link href="/" className="text-sm text-sky-400 hover:text-sky-300 print:hidden">
                ← Physics Visualisations
            </Link>

            <header className="flex flex-col gap-2">
                <h1 className="text-3xl font-semibold tracking-tight text-slate-50">{TITLE}</h1>
                <p className="text-xl text-slate-200">{SUBTITLE}</p>
                <p className="text-lg text-slate-400">{DESCRIPTION}</p>
                <p className="text-sm text-slate-500">
                    Article · October 2026 · Online at{" "}
                    <Link href={HREF} className={LINK}>
                        {SITE}
                        {HREF}
                    </Link>
                </p>
            </header>

            <section className="flex flex-col gap-3 rounded-xl border border-amber-500/40 bg-amber-500/5 p-5 print:break-inside-avoid print:border-black print:bg-transparent">
                <h2 className="text-lg font-semibold text-amber-200">In short</h2>
                <ul className="flex list-disc flex-col gap-2 pl-5">
                    <li>
                        Mass, in kilograms, is how much there is of something. Weight is how hard
                        gravity pulls on it, and it’s measured in newtons. 1 kg weighs about 10 N,
                        so 100 kg weighs about 1 kN (a kilonewton, 1000 newtons). Rescue gear is
                        rated in kN.
                    </li>
                    <li>
                        A force has a size and a direction, so it’s drawn as an arrow. Ropes only
                        pull, along their own line. When something is held still, all the pulls on
                        it cancel out.
                    </li>
                    <li>
                        Two legs holding one load each take half of it only when they hang straight
                        down, side by side. The wider the angle between them, the harder each pulls:
                        at 90° each takes {percent(legShare(rad(90)))} of the load, at 120° each
                        takes the whole load, and past that each takes more than the load.
                    </li>
                    <li>
                        When the main line pulls off to one side, a pre-equalised anchor puts more
                        on the anchor on the other side. Pull it far enough and that anchor holds
                        everything.
                    </li>
                    <li>
                        A rope turning round a redirect pulls on it with up to twice the rope’s
                        tension. The sharper the turn, the harder the pull: a rope doubling right
                        back pulls with the full twice.
                    </li>
                </ul>
            </section>

            <Section title="What this is about">
                <p>
                    Every rope rescue system comes down to a few pieces of physics: how much the
                    load weighs, which way each rope pulls, and how those pulls add up at the
                    anchors. None of it needs equations to understand. This article explains each
                    idea in words and pictures, with sliders to try things out. If you want to know
                    where a rule comes from, open the “Why is this?” box under it.
                </p>
                <p>
                    This part covers weight and the forces in ropes and anchors.{" "}
                    <Link href="/gentle-introduction/part-2" className={LINK}>
                        Part 2
                    </Link>{" "}
                    covers pulleys, mechanical advantage, and the friction that eats into it.
                </p>
                <p>
                    Throughout, things are held still or moving at a steady speed. Those two come to
                    the same thing: a load being lowered steadily puts the same pull on the rope as
                    one hanging still. It’s speeding up or slowing down that takes extra force, and
                    stopping a moving load, catching a slip or a jerk on the rope can pull many
                    times harder than the weight. That’s left for a later part.
                </p>
            </Section>

            <Section title="Mass and weight">
                <p>
                    In everyday talk, a casualty “weighs 80 kg”. Strictly, 80 kg is their{" "}
                    <em>mass</em>: how much of them there is. It’s the same on Earth, on the Moon,
                    or floating in space. Their <em>weight</em> is how hard gravity pulls them down,
                    and that’s what a rope has to hold. Weight is a force, and forces are measured
                    in newtons (N).
                </p>
                <p>
                    On Earth, each kilogram weighs about 10 N (9.81 N, to be exact). So 100 kg
                    weighs about 1000 N, or 1 kilonewton (kN). That’s the conversion worth
                    remembering: <strong className={STRONG}>100 kg is about 1 kN</strong>.
                </p>
                <Table
                    head={["Load", "Mass", "Weight"]}
                    rows={[
                        ["A bag of sugar", "1 kg", "about 10 N"],
                        ["A rescuer", "80 kg", "about 0.8 kN"],
                        [
                            "A casualty in a stretcher, with a rescuer alongside",
                            "200 kg",
                            "about 2 kN",
                        ],
                        ["A small car", "1000 kg", "about 10 kN"],
                    ]}
                />
                <p>
                    Gear is rated in kN because what it has to withstand is a force, not a mass. A
                    karabiner marked 22 kN should hold a steady pull of at least 22 kN before it
                    breaks, the weight of about 2.2 tonnes. That’s along its spine with the gate
                    shut: pulled sideways or with the gate open, it’s much weaker, often only a
                    third as strong. And it’s a breaking strength, not what the karabiner should be
                    used for. Rescue systems are built so the gear is many times stronger than the
                    load (your team’s manual sets how many), and checking that starts with knowing
                    the forces in the system.
                </p>
                <p>
                    Rescuers often talk about forces in kilograms anyway, meaning “the weight of
                    that many kilograms”: a leg “holding 115 kg” pulls as hard as 115 kg hanging on
                    it would. This article does the same, with the kN alongside.
                </p>
                <Why>
                    <p>
                        Gravity is an acceleration, not a force. Drop something near the Earth’s
                        surface and, ignoring air, it speeds up by 9.81 metres per second every
                        second it falls. That acceleration is called <em>g</em>.
                    </p>
                    <p>
                        A force is what it takes to make a mass accelerate: force = mass ×
                        acceleration. A newton is the force that speeds up 1 kg by 1 metre per
                        second every second. “Metres per second, every second” is written m/s²
                        (metres per second squared), so the newton is built from kilograms, metres
                        and seconds:
                    </p>
                    <Eq tex={r`1\,\text{N} = 1\,\text{kg} \times 1\,\text{m/s}^2`} />
                    <p>
                        The force gravity puts on a mass, its weight, is its mass times <em>g</em>.
                        Kilograms times m/s² gives newtons:
                    </p>
                    <Eq
                        tex={r`\text{weight} = \text{mass} \times g = 80\,\text{kg} \times 9.81\,\text{m/s}^2 \approx 785\,\text{N}`}
                    />
                    <p>
                        To hold the load still, the rope has to pull up with that same force, so
                        that nothing is left over to speed the load up.
                    </p>
                    <p>
                        Rounding <em>g</em> up to 10 makes the sums easy and comes out 2% high,
                        which errs on the safe side. A newton on its own is small: about the weight
                        of a small apple, 100 g.
                    </p>
                    <p>
                        A bathroom scale actually measures your weight, the force you push down on
                        it with, then divides by <em>g</em> to show kilograms. That’s why the two
                        get mixed up.
                    </p>
                </Why>
            </Section>

            <Section title="Forces are arrows">
                <p>
                    A force has a size, how hard it pulls, and a direction, which way. So forces are
                    drawn as arrows: the longer the arrow, the harder the pull. A rope can only
                    pull, and only along its own line. It can’t push, and it can’t pull sideways to
                    itself.
                </p>
                <p>
                    When something is held still, the pulls on it balance: they cancel each other
                    out completely. A load hanging on one rope has two: its weight down, and the
                    rope pulling up just as hard. Pull the load sideways with a level tag line (a
                    rope to steer it), and the rope leans over until the three pulls balance again
                    (Figure 1). The rope now pulls harder than the load weighs, because it has to
                    hold the tag line’s pull as well as the weight.
                </p>
                <ForcesFigure />
                <Why>
                    <p>
                        Something that’s still stays still only if the pulls on it add up to
                        nothing. Arrows add by laying them tip to tail: start the second where the
                        first ends, and so on. If the last one ends where the first started, so that
                        they make a closed shape, they add up to nothing, and the forces balance.
                    </p>
                    <p>
                        In Figure 1 the rope leans 30°. For the triangle to close, the tag line must
                        pull with {percent(Math.tan(rad(30)))} of the load’s weight and the rope
                        with {percent(1 / Math.cos(rad(30)))} of it. So a tag line pulling a load
                        out from a cliff adds to the main line’s load, more the further it pulls the
                        load out. A tag line held from below, pulling down as well as out, adds even
                        more, because the main line has to hold its downward pull too.
                    </p>
                    <p>
                        The tag line is level and the weight pulls straight down, so the triangle
                        has a square corner. The sides of any triangle with a square corner follow
                        Pythagoras’ rule: square the two short sides, add them, and you get the long
                        side squared.
                    </p>
                    <PythagorasFigure />
                    <Eq tex={r`a^2 + b^2 = c^2`} />
                    <p>
                        Here <em>a</em> is the weight, <em>b</em> the tag line and <em>c</em> the
                        rope. On a {TAGGED.mass} kg load with the rope leaning {TAGGED.lean}°, the
                        tag line pulls with about {Math.round(tagged.side)} kg and the rope with
                        about {Math.round(tagged.rope)} kg:
                    </p>
                    <Eq
                        tex={r`${TAGGED.mass}^2 + ${Math.round(tagged.side)}^2 \approx ${Math.round(tagged.rope)}^2`}
                    />
                    <p>
                        So the rope always pulls harder than the weight or the tag line alone, but
                        less than the two added together.
                    </p>
                </Why>
            </Section>

            <Section title="Two legs, one load">
                <p>
                    Most anchors share a load between two or more points, each with its own leg to a
                    master point (the one point the load hangs from). If the two legs hang straight
                    down, side by side, each takes half the load. As the angle between them opens
                    up, each leg pulls harder, even though the load hasn’t changed. Try it in Figure
                    2.
                </p>
                <TwoLegsFigure />
                <div className="max-w-sm">
                    <Table
                        head={["Angle between the legs", "Each leg takes"]}
                        rows={LEG_ANGLES.map((a) => [`${a}°`, percent(legShare(rad(a)))])}
                    />
                </div>
                <p>
                    Each leg pulls partly up, holding the load, and partly sideways, pulling against
                    the other leg. The sideways parts cancel each other out and do nothing for the
                    load. The wider the angle, the more of each leg’s pull goes sideways, so the
                    harder it has to pull to hold its share up.
                </p>
                <p>
                    At 120°, <strong className={STRONG}>each leg holds the whole load</strong>, so
                    each anchor has to be strong enough to hold it alone. Past 120° each leg holds
                    more than the load, and it climbs fast: a {WIDE.mass} kg load on legs{" "}
                    {WIDE.angle}° apart puts about {kg(wide * G)} ({kN(wide)}) on each anchor.
                </p>
                <p>
                    That’s why many rigging guides ask for less than 90° between anchor legs and
                    treat 120° as the limit; check what your own team’s manual says. The same goes
                    for anything with two legs: a sling round a pillar, a bridle on a stretcher, or
                    a rope stretched tight across a gap with a load in the middle. A rope pulled
                    nearly straight with a load on it pulls enormously hard on its ends, and no
                    amount of pulling will get it fully straight.
                </p>
                <Why>
                    <p>
                        Split each leg’s pull into an up part and a sideways part, laid tip to tail
                        so that together they make the same arrow as the leg. The two up parts must
                        add up to the load; the sideways parts cancel.
                    </p>
                    <LegPartsFigure />
                    <p>
                        Call each leg’s pull <em>T</em>, for tension, and the angle between one leg
                        and straight up <em>θ</em>. The two legs mirror each other, so <em>θ</em> is
                        half the angle between them: legs 120° apart have <em>θ</em> = 60°. The sine
                        and cosine of <em>θ</em>, numbers a calculator gives, split <em>T</em> into
                        its two parts:
                    </p>
                    <Eq tex={r`x = T \sin\theta \qquad y = T \cos\theta`} />
                    <p>
                        The cosine is 1 at 0° and falls to 0 at 90°; the sine does the opposite. The
                        two parts are the short sides of a triangle with a square corner, and the
                        leg’s pull is its long side, so Pythagoras’ rule holds here too: <em>x</em>²
                        + <em>y</em>² = <em>T</em>².
                    </p>
                    <p>
                        The two legs’ up parts, <em>y</em>, together hold the load’s weight,{" "}
                        <em>W</em>:
                    </p>
                    <Eq
                        tex={r`2 T \cos\theta = W \qquad\text{so}\qquad T = \frac{W}{2\cos\theta}`}
                    />
                    <p>
                        Legs hanging side by side have <em>θ</em> = 0°, and cos 0° = 1, so each
                        takes half. Legs 120° apart have <em>θ</em> = 60°, and cos 60° = ½, so each
                        takes the whole load. As the legs approach straight across, <em>θ</em>{" "}
                        approaches 90°, the cosine heads to zero, and <em>T</em> grows without
                        limit.
                    </p>
                    <p>
                        Real slings stretch a little under load, which closes the angle a few
                        degrees and eases the legs slightly. The figures here leave that out.
                    </p>
                </Why>
            </Section>

            <Section title="When the main line pulls to one side">
                <p>
                    An anchor is built for the load to pull one way, but the main line (the rope
                    that holds the load) often runs off at an angle, to an edge or a redirect off to
                    one side. Take a pre-equalised anchor: each anchor has its own leg, tied off at
                    a fixed length so the legs share the load evenly when it pulls the way the
                    anchor was built for (Figure 3).
                </p>
                <SwingFigure />
                <p>
                    With the main line pulling {SWING}° to the right, the left anchor takes{" "}
                    {percent(pre.shares[0])} and the right only {percent(pre.shares[1])}. That’s the
                    opposite of what many people expect. The main line pulls the master point down
                    and to the right: away from the left anchor and towards the right one. So the
                    left leg tightens and the right one eases off. The legs can’t change length, so
                    the master point can’t move to even things up.
                </p>
                <p>
                    Pull further, past 30°, and the main line lines up with the left leg, carried on
                    down past the master point. The right leg goes slack, and the left anchor holds
                    everything, with nothing backing it up. So build a pre-equalised anchor facing
                    the way the load will actually pull. The{" "}
                    <Link href="/multi-point-anchor" className={LINK}>
                        multi-point anchor visualisation
                    </Link>{" "}
                    ({SITE}/multi-point-anchor) lets you try three anchors, anchors at different
                    heights, and an anchor tied for an angled pull.
                </p>
                <Why>
                    <p>
                        The legs have fixed lengths, so the master point stays where it is, and the
                        legs pull with whatever balances the main line there. Laid tip to tail, the
                        main line’s arrow and the two legs’ arrows must close into a triangle, with
                        each leg’s arrow along its leg. The nearer the main line comes to lining up
                        with one leg, the longer that leg’s arrow and the shorter the other’s. Once
                        the main line passes outside the V of the legs, closing the triangle would
                        need the far leg to push. Ropes can’t push, so it goes slack, and the master
                        point swings out until the main line pulls straight along the near leg.
                    </p>
                </Why>
            </Section>

            <Section title="Ropes that change direction">
                <p>
                    A rope running round a karabiner or pulley on a redirect keeps the same tension
                    on both sides (leaving friction aside until Part 2). The redirect feels both
                    parts pulling on it at once, so how hard it’s pulled depends on the angle
                    between them (Figure 4).
                </p>
                <p>
                    The angle here is between the rope’s two parts, so 0° is a rope doubling right
                    back. Some tables measure how far the rope turns instead, where 0° is straight
                    on; check which one a table means.
                </p>
                <RedirectFigure />
                <div className="max-w-sm">
                    <Table
                        head={["Angle between the rope’s parts", "The redirect takes"]}
                        rows={REDIRECT_ANGLES.map((a) => [`${a}°`, percent(redirectShare(rad(a)))])}
                    />
                </div>
                <ul className="flex list-disc flex-col gap-2 pl-5">
                    <li>
                        A rope doubling right back (0°), such as over a pulley at the top of a haul,
                        pulls on the pulley’s anchor with{" "}
                        <strong className={STRONG}>twice the rope’s tension</strong>: the load’s
                        side and the hauling side both pull on it.
                    </li>
                    <li>
                        At 90°, a right-angled turn, the redirect takes{" "}
                        {percent(redirectShare(rad(90)))} of the tension. At 120° it takes the same
                        as the rope.
                    </li>
                    <li>A rope running nearly straight past it barely pulls on it at all.</li>
                </ul>
                <Why>
                    <p>
                        It’s the same triangle as in Figure 2, from the other end. There, the two
                        legs’ pulls together had to make the load, and we worked out each leg. Here,
                        each part of the rope pulls with the rope’s tension, <em>T</em>, and we work
                        out the two together. As before, <em>θ</em> is the angle between one part
                        and the middle line, half the angle between the two parts:
                    </p>
                    <Eq tex={r`\text{pull on the redirect} = 2 T \cos\theta`} />
                    <p>
                        That’s why the two tables run opposite ways. In Figure 2 the load is fixed,
                        and as the legs spread, each must pull harder to make it up. Here the rope’s
                        tension is fixed, and as its parts spread, more of their pulls cancel each
                        other out, so the redirect feels less. At 120° the two meet: two legs each
                        hold the load, and a redirect holds the rope’s tension.
                    </p>
                </Why>
            </Section>

            <Section title="To remember">
                <Table
                    head={["", "Rule of thumb"]}
                    rows={[
                        ["Weight", "100 kg weighs about 1 kN"],
                        [
                            "Two legs",
                            `Each takes ${percent(legShare(rad(60)))} at 60°, ${percent(legShare(rad(90)))} at 90°, the whole load at 120°`,
                        ],
                        [
                            "Redirect",
                            `Takes ${percent(redirectShare(rad(0)))} of the rope’s tension doubled back, ${percent(redirectShare(rad(90)))} at 90°, ${percent(redirectShare(rad(120)))} at 120°`,
                        ],
                        [
                            "Main line to one side",
                            "A pre-equalised anchor loads the anchor on the other side more; pulled past that leg’s line, it holds everything",
                        ],
                    ]}
                />
            </Section>

            <Section title="What’s left out">
                <ul className="flex list-disc flex-col gap-2 pl-5">
                    <li>
                        Everything is held still, or moving steadily. Jerks, drops and catching a
                        fall all pull harder, often much harder.
                    </li>
                    <li>
                        There’s no friction. Real karabiners and pulleys grip the rope, so the two
                        parts of a rope round a redirect pull a little differently. Which way that
                        shifts the figures depends on which way the rope is running; Part 2 looks at
                        it.
                    </li>
                    <li>
                        Ropes and slings don’t stretch. Real ones stretch a little, which closes the
                        angle between legs slightly and makes the figures at wide angles a little
                        lower.
                    </li>
                    <li>
                        The ropes’ own weight is left out. It adds a little, which only matters with
                        long ropes.
                    </li>
                    <li>
                        Everything is drawn flat. Real anchors are spread out in three dimensions;
                        the same rules hold, using the actual angle between the legs.
                    </li>
                </ul>
            </Section>

            <Section title="Terms used">
                <dl className="flex flex-col gap-2">
                    {TERMS.map(([term, meaning]) => (
                        <div key={term}>
                            <dt className="inline font-medium text-slate-100">{term}: </dt>
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
    ["Mass", "how much of something there is, in kilograms (kg)."],
    ["Weight", "how hard gravity pulls something down; a force, in newtons."],
    ["Newton (N)", "the unit of force: about the weight of a 100 g apple."],
    ["Kilonewton (kN)", "1000 newtons: about the weight of 100 kg."],
    [
        "Breaking strength",
        "the steady pull a piece of gear should hold before it breaks; usually the figure stamped on it (some gear is marked with a working load instead).",
    ],
    ["Tension", "how hard a rope pulls; without friction, the same all along it."],
    ["Main line", "the rope that holds the load."],
    ["Tag line", "a rope used to steer a load or hold it away from a wall or cliff."],
    ["Master point", "the one point of an anchor that the load hangs from."],
    ["Leg", "a sling or rope from an anchor to the master point."],
    ["Pre-equalised", "rigged with each leg tied off at a fixed length."],
    ["Bridle", "the short legs joining a stretcher to the rope that holds it."],
    ["Haul", "pulling a load up with a rope system."],
    ["Redirect", "an anchor with a karabiner or pulley that turns a rope to run a new way."],
];
