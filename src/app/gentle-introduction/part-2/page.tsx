import type { Metadata } from "next";
import Link from "next/link";

import { LINK, Section, SITE, STRONG, Table, Why } from "@/articles/prose";
import {
    FrictionFigure,
    RedirectHaulFigure,
    SixToOneFigure,
    SixToOneTMethodFigure,
    TwoToOneFigure,
    ZRigFigure,
    ZRigTMethodFigure,
} from "@/articles/pulley-figures";
import {
    loadPerMetre,
    pullsOf,
    REDIRECT,
    SIX_TO_ONE,
    TWO_TO_ONE,
    Z_RIG,
} from "@/articles/pulley-systems";
import { Eq } from "@/components/tex";

const TITLE = "A Gentle Introduction to Rescue Physics";
const SUBTITLE = "Part 2: Pulleys and mechanical advantage";
const DESCRIPTION =
    "How a few pulleys let a small team haul a heavy load, what it costs them, how to work out any pulley system with the T method, and how much friction takes away.";

export const metadata: Metadata = { title: `${TITLE}, ${SUBTITLE}`, description: DESCRIPTION };

const r = String.raw;
const HREF = "/gentle-introduction/part-2";
const PART_1 = "/gentle-introduction/part-1";

/** The load the text's examples haul. */
const LOAD = 200;
/** A good pulley's efficiency, for the text's friction examples. */
const GOOD = 0.9;
/** A karabiner's in place of a pulley, roughly. */
const KARABINER = 0.5;

const SYSTEMS = [
    { name: "Pulley on the anchor", sys: REDIRECT },
    { name: "2:1", sys: TWO_TO_ONE },
    { name: "Z-rig, 3:1", sys: Z_RIG },
    { name: "2:1 on a 3:1, 6:1", sys: SIX_TO_ONE },
];

/** A mechanical advantage to one place, as "2.7:1". */
const ratio = (a: number) => `${Number.isInteger(a) ? a : a.toFixed(1)}:1`;

export default function Page() {
    const zGood = pullsOf(Z_RIG, GOOD).advantage;
    // The Z-rig with a karabiner in place of one of its pulleys: on the travelling pulley, or at the anchor.
    const zKarabinerTravelling = 1 + KARABINER + KARABINER * GOOD;
    const zKarabinerAnchor = 1 + GOOD + GOOD * KARABINER;

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
                        A pulley on the anchor only turns the rope. The team still pulls as hard as
                        the load weighs, and the anchor holds twice that.
                    </li>
                    <li>
                        A pulley that moves with the load lets two parts of the rope share it, so
                        the team pulls half as hard. The price is pulling twice as much rope. That
                        trade is mechanical advantage, here 2:1.
                    </li>
                    <li>
                        A Z-rig turns the main line back on itself with a rope grab and two pulleys,
                        for 3:1. Putting one system on the haul line of another multiplies them: a
                        2:1 on a 3:1 is a 6:1.
                    </li>
                    <li>
                        The T method works out any pulley system: call the team’s pull 1<em>T</em>,
                        give every part of that rope the same, and add up wherever ropes meet.
                        Whatever reaches the load is the mechanical advantage.
                    </li>
                    <li>
                        Friction eats into it at every pulley. A Z-rig with good pulleys gives about{" "}
                        {ratio(Math.round(zGood * 10) / 10)} rather than 3:1, and a karabiner in
                        place of a pulley loses far more.
                    </li>
                </ul>
            </section>

            <Section title="What this is about">
                <p>
                    <Link href={PART_1} className={LINK}>
                        Part 1
                    </Link>{" "}
                    covered weight, forces as arrows, and how angles change the pull on anchors and
                    redirects. This part is about hauling: how a few pulleys let a small team raise
                    a load much heavier than they could lift, and what it costs them.
                </p>
                <p>
                    A pulley system’s <em>mechanical advantage</em> is how many times harder the
                    rope pulls on the load than the team pulls on the rope. It’s written as a ratio:
                    a 3:1 (said “three to one”) pulls on the load with three times the team’s pull.
                </p>
                <p>
                    The systems here are drawn flat, as if seen from above, with the anchor on the
                    left and the load off to the right, over an edge. An edge or a redirect between
                    the system and the load changes the angles, not the advantage. Until the last
                    section the pulleys are perfect, with no friction, and every part of a rope runs
                    in the same line, as in the drawings.
                </p>
            </Section>

            <Section title="A pulley on the anchor">
                <p>
                    As Part 1 showed, a rope keeps its tension round a pulley: both sides pull
                    equally hard. So a pulley fixed to the anchor only turns the rope round. The
                    team pulls as hard as the load weighs, and for every metre of rope they pull in,
                    the load comes a metre. The anchor holds both parts of the rope, twice the load
                    (Figure 1).
                </p>
                <RedirectHaulFigure />
                <p>
                    That can still be worth doing, to let the team pull in a better direction, but
                    it gives no advantage. It’s a 1:1.
                </p>
            </Section>

            <Section title="A pulley on the load: 2:1">
                <p>
                    Now tie the rope to the anchor instead, run it round a pulley clipped to the
                    load, and bring it back to the team (Figure 2). The load hangs from two parts of
                    the rope, and both carry the rope’s tension. So each holds half the load, and
                    the team only has to pull with half.
                </p>
                <TwoToOneFigure />
                <p>
                    The catch is in how far the team pulls. For the load to come a metre closer,
                    both parts of the rope must get a metre shorter, and those two metres of rope
                    come through the team’s hands. Half the pull,{" "}
                    <strong className={STRONG}>twice the distance</strong>. That’s true of every
                    pulley system: whatever it gains in force, the team pays for in rope.
                </p>
                <Why>
                    <p>
                        Pushing or pulling something along takes <em>work</em>: the force times how
                        far it moves. Pulleys can’t make work, only pass it on, so the team’s work
                        pulling the rope is the work done raising the load:
                    </p>
                    <Eq
                        tex={r`\text{team's pull} \times \text{rope pulled} = \text{load} \times \text{distance the load moves}`}
                    />
                    <p>
                        On a {LOAD} kg load, the team pulls with {LOAD / 2} kg over 2 m to move the
                        load 1 m:
                    </p>
                    <Eq
                        tex={r`${LOAD / 2}\,\text{kg} \times 2\,\text{m} = ${LOAD}\,\text{kg} \times 1\,\text{m}`}
                    />
                    <p>
                        So a system’s mechanical advantage is also how many metres of rope the team
                        pulls for each metre the load moves. That gives a way to check any system:
                        pull a metre of rope through, and see how far the load comes. With friction
                        the team puts in more work than the load gets, and the rest warms the
                        pulleys.
                    </p>
                </Why>
            </Section>

            <Section title="The Z-rig: 3:1">
                <p>
                    A 2:1 needs a pulley on the load itself, which is often over an edge and out of
                    reach. The Z-rig builds its advantage at the top instead, from the main line
                    (Figure 3). The main line comes up from the load and runs round a pulley on the
                    anchor. Then it doubles back towards the load, round a{" "}
                    <em>travelling pulley</em>, and back again to the team. The travelling pulley is
                    clipped to a <em>rope grab</em> on the main line: a prusik or a mechanical
                    device that grips the rope when it’s pulled.
                </p>
                <ZRigFigure />
                <p>
                    Three parts of rope pull on the grab and load together: the main line to the
                    anchor pulley, and the two parts round the travelling pulley. Each carries the
                    rope’s tension, so together they pull with three times the team’s pull. And for
                    the load to come a metre, all three parts must shorten by a metre, so the team
                    pulls three.
                </p>
                <p>
                    The travelling pulley comes towards the anchor pulley as the team hauls. When
                    the two nearly meet, the team has to <em>reset</em>: let the load hang, slide
                    the grab back down the main line towards the load, and haul again. Something has
                    to hold the load while they do. Usually the anchor pulley is a{" "}
                    <em>progress capture</em> device, which lets the rope run in towards the anchor
                    but grips it if it tries to run back out.
                </p>
                <p>
                    Counting the parts of rope that pull on the load, and on anything moving with
                    it, gives the advantage of simple systems like these. It doesn’t work once a
                    system has parts moving at different speeds, as in the next section. The T
                    method, after that, always works.
                </p>
                <Why>
                    <p>
                        Count the rope. When the load comes 1 m closer, the grab comes 1 m with it,
                        and so does the travelling pulley. The main line from the load to the anchor
                        pulley is 1 m shorter. So are the two parts between the anchor pulley and
                        the travelling pulley, and between the travelling pulley and where the team
                        holds the rope. That’s 3 m of rope, and it has all come through the team’s
                        hands.
                    </p>
                    <p>
                        So the work rule from the 2:1 says the load gets three times the team’s
                        pull: a 3:1.
                    </p>
                </Why>
            </Section>

            <Section title="Systems on systems">
                <p>
                    Put a whole pulley system on the haul line of another, and their advantages
                    multiply. In Figure 4, a 2:1 pulls on a rope grab on the Z-rig’s haul line. The
                    2:1 doubles the team’s pull, and the Z-rig triples that, so the load gets six
                    times the team’s pull: a 6:1. This is called a <em>compound</em> system, and a
                    single rope system like the 2:1 or the Z-rig is a <em>simple</em> one.
                </p>
                <SixToOneFigure />
                <p>
                    The 2:1’s pulley moves at a different speed from the Z-rig’s travelling pulley:
                    three times as fast, as the marks on the ropes show. That’s why counting the
                    parts of rope doesn’t work here. Count the parts pulling on things that move,
                    and you get five, not six.
                </p>
                <p>
                    More advantage isn’t always better. A 6:1 needs 6 m of rope pulled for every
                    metre the load rises, and it needs resetting more often. And the team feels only
                    a sixth of what the rope puts on the load. If the load snags on an edge, a team
                    that feels a moderate pull can be putting six times that into the rope, the
                    anchor and the casualty. That’s a reason to use no more advantage than the job
                    needs, and to keep a close watch on the load; your team’s manual will say how it
                    handles this.
                </p>
            </Section>

            <Section title="The T method">
                <p>
                    The T method works out the advantage of any pulley system, simple, compound, or
                    otherwise, by following the tension through it. <em>T</em> stands for tension:
                    the pull the team puts on the rope. It goes like this:
                </p>
                <ol className="flex list-decimal flex-col gap-2 pl-5">
                    <li>
                        Call the team’s pull on the haul line 1<em>T</em>.
                    </li>
                    <li>
                        A rope keeps its tension round every pulley, so label every part of that
                        rope 1<em>T</em> too, until it ends: at an anchor, at a knot, or at a rope
                        grab.
                    </li>
                    <li>
                        Wherever ropes meet, at a pulley’s sling or a rope grab, add up what pulls
                        on it. That’s what it passes on.
                    </li>
                    <li>
                        Carry on, rope by rope, until you reach the load. Whatever reaches the load
                        is the mechanical advantage.
                    </li>
                </ol>
                <p>
                    Step through it on the Z-rig in Figure 5. The parts of rope are labelled as each
                    step adds them, with the newest in amber.
                </p>
                <ZRigTMethodFigure />
                <p>
                    The same steps work for the 6:1 (Figure 6). It just has two ropes to follow, and
                    the second one starts where the first one’s pulley pulls.
                </p>
                <SixToOneTMethodFigure />
                <p>
                    The T method also shows what each anchor holds: add up the parts of rope pulling
                    on it. In the Z-rig, the anchor pulley has 1<em>T</em> on each side, so the
                    anchor holds 2<em>T</em>, and the team’s 1<em>T</em> makes up the rest of the 3
                    <em>T</em> load. A pulley system makes the team’s job easier, but not the
                    anchor’s: between them, the anchor and the team still hold the whole load. If
                    the team pulls away from the anchor instead, through a redirect, the anchor
                    holds their pull as well.
                </p>
                <Why>
                    <p>
                        Each step is the rule from Part 1: anything held still, or moving steadily,
                        has its pulls balanced. A pulley with 1<em>T</em> on each side is pulled
                        with 2<em>T</em>, so its sling must pull back with 2<em>T</em>. A rope grab
                        pulled one way by the travelling pulley’s 2<em>T</em> and the main line’s 1
                        <em>T</em> must be pulled back the other way by 3<em>T</em>, and only the
                        main line below it can do that.
                    </p>
                    <p>
                        Adding the <em>T</em>s like this only works when the parts of rope run in
                        the same line, as they nearly do in most haul systems. Where they spread out
                        at an angle, they add the way the legs in Part 1 did, and give a little
                        less.
                    </p>
                </Why>
            </Section>

            <Section title="Friction">
                <p>
                    Real pulleys aren’t perfect. A little of the pull goes into turning the wheel on
                    its axle and bending the rope round it, so a rope running round a pulley pulls a
                    little less on the far side. How much a pulley passes on is called its{" "}
                    <em>efficiency</em>. A good rescue pulley, with a large wheel on bearings,
                    passes on around 90% or more. A rope running round a karabiner instead passes on
                    only about half.
                </p>
                <p>
                    In the T method, friction means each part of the rope carries a little less than
                    the one before it, working back from the team. Try it in Figure 7.
                </p>
                <FrictionFigure />
                <p>
                    With every pulley passing on {Math.round(GOOD * 100)}%, a Z-rig is a{" "}
                    {ratio(Math.round(zGood * 10) / 10)}, and the losses build up in bigger systems:
                    the 6:1 comes out at about{" "}
                    {ratio(Math.round(pullsOf(SIX_TO_ONE, GOOD).advantage * 10) / 10)}. That still
                    takes 6 m of rope for each metre the load rises; it’s the force you get for it
                    that’s less.
                </p>
                <p>
                    Friction always works against the way the rope runs. Hauling, the team has to
                    pull harder. Letting the load back down, as when lowering it onto the progress
                    capture before a reset, the friction helps them hold it.
                </p>
                <Why>
                    <p>
                        Work back from the team. The haul line carries 1<em>T</em>. The travelling
                        pulley passes on {Math.round(GOOD * 100)}% of that, so the next part carries{" "}
                        {GOOD}
                        <em>T</em>, and the anchor pulley passes on {Math.round(GOOD * 100)}% of
                        that, {(GOOD * GOOD).toFixed(2)}
                        <em>T</em>. The rope grab adds the travelling pulley’s two parts to the main
                        line’s, so the load gets:
                    </p>
                    <Eq
                        tex={r`1 + ${GOOD} + ${(GOOD * GOOD).toFixed(2)} = ${zGood.toFixed(2)}\,T`}
                    />
                    <p>
                        The pulley nearest the team matters most, because its loss carries on into
                        every part of the rope after it. With a karabiner in place of the travelling
                        pulley, the Z-rig gives about{" "}
                        {ratio(Math.round(zKarabinerTravelling * 10) / 10)}; with it at the anchor
                        instead, about {ratio(Math.round(zKarabinerAnchor * 10) / 10)}.
                    </p>
                </Why>
            </Section>

            <Section title="To remember">
                <Table
                    head={[
                        "System",
                        "Rope pulled per metre the load moves",
                        `Team pulls, for a ${LOAD} kg load`,
                        `With ${Math.round(GOOD * 100)}% pulleys`,
                    ]}
                    rows={SYSTEMS.map(({ name, sys }) => {
                        const ideal = pullsOf(sys).advantage;
                        const real = pullsOf(sys, GOOD).advantage;
                        return [
                            name,
                            `${Math.round(1 / loadPerMetre(sys))} m`,
                            `${Math.round(LOAD / ideal)} kg`,
                            `${Math.round(LOAD / real)} kg (${ratio(Math.round(real * 10) / 10)})`,
                        ];
                    })}
                />
                <ul className="flex list-disc flex-col gap-2 pl-5">
                    <li>Whatever a pulley system gains in force, the team pays for in rope.</li>
                    <li>Systems on systems multiply.</li>
                    <li>
                        The T method: 1<em>T</em> on the haul line, the same all along a rope, add
                        up where ropes meet.
                    </li>
                    <li>The anchor and the team between them still hold the whole load.</li>
                </ul>
            </Section>

            <Section title="What’s left out">
                <ul className="flex list-disc flex-col gap-2 pl-5">
                    <li>
                        Every part of a rope runs in one line. Parts spread at an angle give a
                        little less advantage, and pull on their anchors in new directions; Part 1’s
                        angles tell you how much.
                    </li>
                    <li>
                        Ropes don’t stretch. Real ones do, so the first part of each pull goes into
                        stretching the rope before the load moves, and more so the more rope there
                        is in the system.
                    </li>
                    <li>
                        Friction is only in the pulleys, and every pulley passes on the same share.
                        Real edges, rope grabs and progress capture devices add friction of their
                        own, and how much a pulley passes on depends on its size, its bearings and
                        the rope.
                    </li>
                    <li>
                        Everything moves steadily. Starting the load moving, or a jerk on the rope,
                        takes extra force.
                    </li>
                    <li>The ropes’ and pulleys’ own weight is left out.</li>
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
    [
        "Mechanical advantage",
        "how many times harder a pulley system pulls on the load than the team pulls on the rope, written as a ratio such as 3:1.",
    ],
    ["Main line", "the rope that holds the load."],
    ["Haul line", "the part of the rope the team pulls on."],
    [
        "Travelling pulley",
        "a pulley that moves as the team hauls, rather than staying on the anchor.",
    ],
    [
        "Rope grab",
        "a prusik or mechanical device that grips a rope when pulled, so a pulley can be clipped to the rope partway along.",
    ],
    [
        "Progress capture",
        "a device that lets the rope run one way but grips it if it runs back, so the load stays put while the team resets.",
    ],
    ["Reset", "sliding the rope grab back down the main line once the pulleys have nearly met."],
    ["Simple system", "a pulley system made from one rope, such as a 2:1 or a Z-rig."],
    ["Compound system", "one pulley system pulling on the haul line of another."],
    [
        "Efficiency",
        "the share of a rope’s tension a pulley passes on, the rest going into friction.",
    ],
    ["Work", "a force times how far it moves something."],
];
