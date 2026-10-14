import type { Metadata } from "next";
import Link from "next/link";
import { Eq, M } from "@/components/tex";
import { SURFACES } from "@/visualisations/body-belay-surfaces";
import { DEFAULTS, hauling, holding, lowering } from "@/writeups/standing-body-belays-figures";

const TITLE = "Standing Body Belays";
const DESCRIPTION =
  "Why a standing body belay can’t safely hold a stretcher’s weight, why it seems to work in training, and what to use instead.";

export const metadata: Metadata = { title: TITLE, description: DESCRIPTION };

const r = String.raw;

/** A safety factor, to two places. */
const sf = (x: number) => x.toFixed(2);
/** A force in newtons, to the nearest 10. */
const newtons = (x: number) => `${Math.round(x / 10) * 10} N`;
const kg = (newtons: number) => `${Math.round(newtons / 9.81)} kg`;
const degrees = (radians: number) => `${Math.round((radians * 180) / Math.PI)}°`;

/** Training pairs (belayer heavier than the stretcher) and real ones (a casualty and their gear). */
const MASS_PAIRS = [
  { belayer: 90, stretcher: 70, note: "Training: a heavy belayer, a light mock casualty" },
  { belayer: 80, stretcher: 70, note: "Training" },
  { belayer: 80, stretcher: 80, note: "Belayer and stretcher the same" },
  { belayer: 80, stretcher: 90, note: "The page’s defaults" },
  { belayer: 70, stretcher: 90, note: "A lighter belayer" },
  { belayer: 70, stretcher: 120, note: "A heavy casualty, with blankets and lashings" },
  { belayer: 60, stretcher: 120, note: "A light belayer, a heavy casualty" },
];

export default function Page() {
  const low = lowering();
  const hold = holding();
  const haul = hauling();
  const roller = lowering({ edgeFriction: 0.03 });
  const closer = holding({ gap: 0 });
  const wider = holding({ gap: 4 });
  const near = holding({ belayerBack: 1.5 });
  const far = holding({ belayerBack: 6 });
  const backup = 1.5;
  const masses = MASS_PAIRS.map((p) => ({
    ...p,
    holding: holding({ belayerMass: p.belayer, stretcherMass: p.stretcher }).safety,
    lowering: lowering({ belayerMass: p.belayer, stretcherMass: p.stretcher }).safety,
  }));
  const equal = [40, 150].map((m) => holding({ belayerMass: m, stretcherMass: m }).safety);
  const real = masses.find((m) => m.belayer === 70 && m.stretcher === 120)!;
  const training = masses[0];
  const standard = { lowering: lowering({ wallHeight: 2.59 }), holding: holding({ wallHeight: 2.59 }) };
  const taller = { lowering: lowering({ wallHeight: 4 }), holding: holding({ wallHeight: 4 }) };

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 pt-4 pb-16 text-base leading-relaxed text-slate-300 print:max-w-none print:px-0 print:text-[11pt] print:**:text-black">
      <Link href="/" className="text-sm text-sky-400 hover:text-sky-300 print:hidden">
        ← Physics Visualisations
      </Link>

      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-50">{TITLE}</h1>
        <p className="text-lg text-slate-400">{DESCRIPTION}</p>
        <p className="text-sm text-slate-500">
          October 2026 · Worked out with the{" "}
          <Link href="/body-belay" className={LINK}>
            body-belayed two-point lower
          </Link>{" "}
          page, where every figure here can be checked
        </p>
      </header>

      <section className="flex flex-col gap-3 rounded-xl border border-amber-500/40 bg-amber-500/5 p-5 print:border-black print:bg-transparent">
        <h2 className="text-lg font-semibold text-amber-200">In short</h2>
        <ul className="flex list-disc flex-col gap-2 pl-5">
          <li>
            A belayer standing to hold a stretcher’s rope is kept from sliding towards the edge by nothing but the grip
            of their boots. How they stand, lean or set their feet doesn’t change how much grip that takes.
          </li>
          <li>
            For a common case, two {DEFAULTS.belayerMass} kg belayers on a high cube container lowering a{" "}
            {DEFAULTS.stretcherMass} kg stretcher, it takes about all the grip their boots have. The safety factor is
            about {sf(low.safety)} while the rope runs over the edge, and about {sf(hold.safety)} once they stop to hold
            it: right at the point where their feet slide. Even the {sf(low.safety)} relies on the edge’s friction,
            which good practice sets out to remove.
          </li>
          <li>
            It seems to work in training because the belayers are usually heavier than the mock casualty. A{" "}
            {training.belayer} kg belayer holding a {training.stretcher} kg stretcher has a safety factor of about{" "}
            {sf(training.holding)}. A {real.belayer} kg belayer holding a {real.stretcher} kg casualty and stretcher has
            about {sf(real.holding)}.
          </li>
          <li>
            Changing where they stand, leaning harder or adding a backup belayer only shifts it a little. None of them
            comes near the safety factor of 10 the manual asks of the rope itself.
          </li>
          <li>
            <strong className="text-slate-100">Proposal:</strong> standing body belays shouldn’t be used to lower or
            hold a stretcher. Use a hard belay. Where there truly isn’t one, the belayer sits with their feet braced
            against something solid, so their footing isn’t what holds them.
          </li>
        </ul>
      </section>

      <Section title="What the manual already says">
        <p>
          The General Rescue Manual (March 2006) already points away from body belays for stretchers, and sets a high
          bar for the rope:
        </p>
        <ul className="flex list-disc flex-col gap-2 pl-5">
          <li>
            Its body belay (10.7) is a <em>seated</em> one, on stable ground, and “should never be used if there is any
            risk of a rescuer/rescuers being required to hold the whole weight of the stretcher.”
          </li>
          <li>
            For the two-point lower (10.11), “as the weight is taken by two points a hard belays should be used rather
            than a waist belay whenever possible.”
          </li>
          <li>
            The hazard tables for the lowers list, against losing rope control, “Use hard belays whenever possible.”
          </li>
          <li>
            And for the rope itself (5.9), the safe working load is “consistent with the factor of safety recommended
            for the conditions under which the rope is to be used (the breaking force divided by 10).”
          </li>
        </ul>
        <p>
          A rope rated to hold ten times its load is only as safe as whatever holds its other end. In a standing body
          belay, that’s two pairs of boots, and as the figures below show, their safety factor is about 1. The manual
          doesn’t describe a standing body belay at all, yet it’s what teams commonly use for a two-point lower off a
          roof or wall. In a two-point lower, the belayers <em>are</em> holding the stretcher’s weight, from the moment
          it goes over the edge. This note works through why that matters.
        </p>
      </Section>

      <Section title="The lower being looked at">
        <p>
          A high cube shipping container, {DEFAULTS.wallHeight} m tall. Two belayers stand side by side on top,{" "}
          {DEFAULTS.belayerBack} m back from the edge and {DEFAULTS.gap} m apart, each with a rope round their waist.
          Both ropes run over the edge to the head of a 2 m stretcher. A line from its foot runs to a ground team{" "}
          {DEFAULTS.teamDistance} m out, pulling steadily ({DEFAULTS.teamPull} N, about {kg(DEFAULTS.teamPull)}) to keep
          it off the wall. The stretcher and casualty weigh {DEFAULTS.stretcherMass} kg; each belayer weighs{" "}
          {DEFAULTS.belayerMass} kg. The roof is dry painted steel, and the ropes run over its painted steel rail.
        </p>
        <p>
          The weights are chosen to be ordinary rather than extreme. {DEFAULTS.belayerMass} kg is a typical adult
          rescuer. {DEFAULTS.stretcherMass} kg is a modest real load: an 80 kg casualty in a Ferno Model 71 basket
          stretcher. A real load is a whole adult plus the stretcher, so it’s usually heavier than any one belayer, and
          often much heavier. The section on training below shows how the figures change for lighter and heavier
          belayers and loads.
        </p>
        <p>
          The figures are for the moment just after the stretcher has gone over the edge, when the ropes carry the most.
          The{" "}
          <Link href="/body-belay" className={LINK}>
            body belay page
          </Link>{" "}
          shows this lower, and its settings can be changed to match any case below. The ladder hinge lower loads its
          belayers in much the same way.
        </p>
      </Section>

      <Section title="Why only grip matters">
        <p>
          Two things act on a belayer: their weight, down, and the rope’s pull at their waist, towards the edge and a
          little downwards. The only thing that can stop them is the ground under their boots. It pushes up on them (
          <M tex="N" />, their weight plus the rope’s downward pull), and its grip pushes back away from the edge (
          <M tex="F" />, which must match the rope’s pull towards the edge). The grip boots can give is at most{" "}
          <M tex={r`\mu_f N`} />, where <M tex={r`\mu_f`} /> is the friction coefficient between their soles and the
          ground. So with the rope’s tension <M tex="T" /> at an angle <M tex={r`\beta`} /> below level:
        </p>
        <Eq
          tex={r`\text{grip needed} = \frac{F}{N} = \frac{T\cos\beta}{W_b + T\sin\beta} \qquad \text{safety factor} = \frac{\mu_f}{\text{grip needed}}`}
        />
        <p>
          Leaning back doesn’t appear in it. A belayer leans until their body lines up with that push from the ground,
          so they don’t topple, but how far they lean doesn’t change the push itself. Leaning less, they’re pulled over;
          leaning more, they fall back. Either way the grip their boots must give is the same. A wide or staggered
          stance makes them steadier against toppling, not against sliding.
        </p>
        <p>
          In the common case, each rope holds {newtons(hold.loadTension)} (about {kg(hold.loadTension)}): a little more
          than half the stretcher, because the ropes splay apart and the ground team’s pull adds to it. The ground
          pushes up on each belayer with {newtons(hold.up)} and must grip with {newtons(hold.sideways)}, so they need a
          grip of {hold.gripNeeded.toFixed(2)}. Dry painted steel gives about {DEFAULTS.grip}, for a safety factor of{" "}
          {sf(hold.safety)}.
        </p>
      </Section>

      <Section title="The edge helps only while the rope is running">
        <p>
          While the stretcher is being lowered, the rope slides over the edge, and the edge’s friction takes part of the
          load (in the common case, the rope turns {degrees(low.wrap)} over a rail with a friction coefficient of about{" "}
          {DEFAULTS.edgeFriction}). Once the belayers stop to hold it, that friction can act either way, depending on
          how the rope settled, so it can’t be counted on. And to haul the stretcher back up, they must overcome it as
          well as the load.
        </p>
        <Table
          head={["", "Each belayer holds", "Grip needed", "Safety factor"]}
          rows={[
            ["Lowering, rope running", newtons(low.tension), low.gripNeeded.toFixed(2), sf(low.safety)],
            ["Holding still (edge not counted)", newtons(hold.tension), hold.gripNeeded.toFixed(2), sf(hold.safety)],
            ["Hauling back up", newtons(haul.tension), haul.gripNeeded.toFixed(2), sf(haul.safety)],
          ]}
        />
        <p>
          Holding still is the case to plan for: it’s what happens when the lower stops for a snag, a change of command,
          or a slip.
        </p>
        <p>
          Nor should the extra margin while lowering be counted on. Rope rescue practice sets out to <em>minimise</em>{" "}
          edge friction, with edge protection or an edge roller, because it wears and cuts the rope, makes the lower
          jerky and harder to control, and changes as the rope settles. A system that is only safe while the rope drags
          over a bare steel edge is relying on the very thing we try to remove. Over an edge roller, the safety factor
          while lowering is {sf(roller.safety)}, little better than holding still.
        </p>
      </Section>

      <Section title="Footing">
        <p>
          The safety factor is directly proportional to the boots’ grip, so it changes with the surface. These friction
          coefficients for rubber-soled boots are rough, middle-of-the-range figures; the real value varies a lot with
          the tread and its wear, the surface’s finish, and any dust, frost, oil or mud.
        </p>
        <Table
          head={["Surface", "Dry: holding / lowering", "Wet: holding / lowering"]}
          rows={SURFACES.map((s) => [
            s.label,
            `${sf(s.dry / hold.gripNeeded)} / ${sf(s.dry / low.gripNeeded)}`,
            `${sf(s.wet / hold.gripNeeded)} / ${sf(s.wet / low.gripNeeded)}`,
          ])}
          highlight={(cell) => Number(cell.split(" / ")[0]) < 1}
        />
        <p>
          Even dry concrete or rough rock, the best of them, gives a safety factor of only about{" "}
          {sf(0.8 / hold.gripNeeded)} holding still. Wet steel, wet grass or wet timber gives well under 1.
        </p>
      </Section>

      <Section title="Why it seems to work in training">
        <p>
          What matters is how heavy the stretcher is compared with the belayers. In training the belayers are usually
          heavier than the mock casualty, which makes it look much safer than it is with a real casualty, a stretcher,
          blankets and lashings.
        </p>
        <Table
          head={["Belayer", "Stretcher", "", "Holding", "Lowering"]}
          rows={masses.map((m) => [`${m.belayer} kg`, `${m.stretcher} kg`, m.note, sf(m.holding), sf(m.lowering)])}
          highlight={(cell, column) => column >= 3 && Number(cell) < 1}
        />
        <p>
          When the belayers and stretcher weigh the same, the safety factor holding still stays between about{" "}
          {sf(equal[0])} and {sf(equal[1])}, from 40 kg to 150 kg. A team that has only ever held light mock casualties
          has trained with a margin a real casualty won’t give them.
        </p>
      </Section>

      <Section title="How teams make it work on containers">
        <p>
          Teams that routinely lower from shipping containers (2.59 m standard, 2.89 m high cube) rarely hold the
          stretcher still. The lower is more of a slowed drop: the belayers let the rope run over the edge, and by the
          time the stretcher’s head is clear of it, the ground team already has hold of its foot. The belayers carry the
          load for only a few seconds, and only while the rope is running.
        </p>
        <p>
          The figures bear that out. The ones above are for the moment just over the edge, and the height barely changes
          them: on a standard container the safety factor is {sf(standard.lowering.safety)} while the rope runs and{" "}
          {sf(standard.holding.safety)} holding still, and on a 4 m wall {sf(taller.lowering.safety)} and{" "}
          {sf(taller.holding.safety)}. It works because the rope keeps moving and the ground team takes over quickly,
          not because the belayers could hold it.
        </p>
        <p>That leaves the lower resting on things nobody controls at the moment it matters most:</p>
        <ul className="flex list-disc flex-col gap-2 pl-5">
          <li>
            The lower mustn’t stop. A lashing or the stretcher’s rail catching on the lip, or a call to stop, leaves the
            belayers holding it, at a safety factor of about 1.
          </li>
          <li>
            The rope must drag over the edge. The margin while lowering comes from the edge’s friction, which edge
            protection and rollers are there to remove.
          </li>
          <li>
            Once boots start to slide, they keep sliding. Sliding friction is lower than the grip that held them, so a
            belayer who starts to slip doesn’t stop by themselves.
          </li>
          <li>
            It doesn’t carry over to anything taller. From a roof or a higher wall, the belayers carry the stretcher for
            the whole lower.
          </li>
        </ul>
      </Section>

      <Section title="What doesn’t fix it">
        <ul className="flex list-disc flex-col gap-2 pl-5">
          <li>
            <strong className={STRONG}>Standing closer together.</strong> The ropes splay less, so each carries a little
            less. Side by side, the safety factor holding still is {sf(closer.safety)}; 4 m apart, it’s{" "}
            {sf(wider.safety)}.
          </li>
          <li>
            <strong className={STRONG}>Standing further back or closer to the edge.</strong> From 1.5 m back to 6 m
            back, it goes from {sf(near.safety)} to {sf(far.safety)}. (Rescuers within 2 m of the edge should be tied
            off anyway.)
          </li>
          <li>
            <strong className={STRONG}>Leaning harder, or a staggered stance.</strong> As above, these change whether
            they topple, not whether they slide.
          </li>
          <li>
            <strong className={STRONG}>Sitting down, without bracing the feet.</strong> With their waist lower, the rope
            pulls them more nearly level and less downwards, so the ground pushes up less. That cancels out what sitting
            gains: holding still, a seated belayer whose feet only grip does about as well as a standing one (a safety
            factor of about 1.0).
          </li>
          <li>
            <strong className={STRONG}>A backup belayer.</strong> A second rescuer in front, leaning back into the
            belayer, adds their grip. If they add half as much as the belayer, the safety factor rises by half, to about{" "}
            {sf(hold.safety * backup)} holding still. That’s better, but it relies on two people’s footing and on the
            backup staying pressed into the belayer, and it’s still a long way short of the factor of 10 asked of the
            rope.
          </li>
          <li>
            <strong className={STRONG}>Heavier belayers.</strong> This helps, but only compared with the load. A 100 kg
            belayer holding a 120 kg casualty is back to {sf(holding({ belayerMass: 100, stretcherMass: 120 }).safety)}.
          </li>
        </ul>
      </Section>

      <Section title="What does work">
        <ul className="flex list-disc flex-col gap-2 pl-5">
          <li>
            <strong className={STRONG}>A hard belay.</strong> The rope runs to an anchor, or round one with friction and
            a catch, so the load goes into structure rather than through the rescuers’ boots. This is what the manual
            already asks for whenever possible.
          </li>
          <li>
            <strong className={STRONG}>Braced feet.</strong> A seated belayer whose feet are set against something solid
            (a parapet, a kerb, a beam) is held by that, not by friction, and is far stronger. It’s the only kind of
            body belay that does better than the boots’ grip. It isn’t modelled here.
          </li>
          <li>
            <strong className={STRONG}>Edge protection or an edge roller,</strong> whatever the belay. A container’s
            roof edge is much tighter than the rope bends safely round.
          </li>
        </ul>
      </Section>

      <Section title="Proposal">
        <ol className="flex list-decimal flex-col gap-2 pl-5">
          <li>Standing body belays aren’t used to lower or hold a stretcher.</li>
          <li>
            Stretcher lowers use hard belays. Where there truly is no hard belay point, the belayers sit with their feet
            braced against something solid.
          </li>
          <li>
            In training, mock casualties are at least as heavy as the belayers, and preferably as heavy as a real
            casualty in a loaded stretcher, so that what teams learn matches what they’ll meet.
          </li>
        </ol>
      </Section>

      <Section title="What the figures leave out">
        <p>
          The figures come from a simplified, static model, described in full on the{" "}
          <Link href="/body-belay" className={LINK}>
            body belay page
          </Link>
          . Most of what it leaves out makes things worse for the belayers, not better:
        </p>
        <ul className="flex list-disc flex-col gap-2 pl-5">
          <li>
            It’s static. A jerk, such as the stretcher dropping as it goes over the edge or a belayer slipping, briefly
            loads the rope far more.
          </li>
          <li>The two belayers share the load evenly. In practice one usually takes more.</li>
          <li>
            The ground is level and the friction figures are averages. A patch of grit, frost or oil under one boot is
            enough to bring the safety factor down.
          </li>
          <li>
            Each belayer is a straight body from their feet to their head, with the rope round their waist 1 m up. Their
            brake hands are taken to hold the rope fast.
          </li>
          <li>The rope and line don’t stretch, and the rope’s strength over the edge isn’t modelled.</li>
        </ul>
      </Section>
    </main>
  );
}

const LINK = "text-sky-400 underline-offset-2 hover:text-sky-300 hover:underline print:underline";
const STRONG = "text-slate-100";

function Section(props: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 print:break-inside-avoid-page">
      <h2 className="text-xl font-semibold text-slate-100">{props.title}</h2>
      {props.children}
    </section>
  );
}

/** A table of figures; `highlight` picks out the cells to mark, such as safety factors below 1. */
function Table(props: { head: string[]; rows: string[][]; highlight?: (cell: string, column: number) => boolean }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-800 print:border-black">
      <table className="w-full text-left text-sm tabular-nums">
        <thead className="bg-slate-900 text-slate-400 print:bg-transparent">
          <tr>
            {props.head.map((h, i) => (
              <th key={i} className="px-3 py-2 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {props.rows.map((row, i) => (
            <tr key={i} className="border-t border-slate-800 print:border-slate-400">
              {row.map((cell, j) => (
                <td
                  key={j}
                  className={
                    j > 0 && props.highlight?.(cell, j)
                      ? "px-3 py-2 font-medium text-rose-300 print:underline"
                      : "px-3 py-2"
                  }
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
