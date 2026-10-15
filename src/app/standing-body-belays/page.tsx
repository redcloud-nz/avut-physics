import type { Metadata } from "next";
import Link from "next/link";
import { Eq, M } from "@/components/tex";
import { SURFACES } from "@/visualisations/body-belay-surfaces";
import { DEFAULTS, hauling, holding, lowering } from "@/writeups/standing-body-belays-figures";
import { BelayerForcesDiagram } from "@/writeups/belayer-forces-diagram";
import { SetupDiagram } from "@/writeups/setup-diagram";
import { StretcherWeightGraph, TRAINING } from "@/writeups/stretcher-weight-graph";

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

/** A training pair (a heavy belayer, a light mock casualty) and a real one (a heavy casualty and their gear). */
const TRAINING_PAIR = { belayer: 90, stretcher: 70 };
const REAL_PAIR = { belayer: 70, stretcher: 120 };

/** The belayers' and stretchers' weights (kg) in the table of safety factors by weight. */
const TABLE_BELAYERS = [60, 70, 80, 90, 100];
const TABLE_STRETCHERS = [70, 90, 110, 130];

/**
 * The heaviest stretcher (kg, to the nearest 1, from 40 kg) the common case's belayers hold still with at least
 * `safety`, with the footing's friction coefficient `grip`.
 */
function heaviestAt(safety: number, grip: number = DEFAULTS.grip) {
  let m = 39;
  while (grip / holding({ stretcherMass: m + 1 }).gripNeeded >= safety) m++;
  return m;
}

/** A list, joined with commas and a final "and". */
const listed = (items: string[]) =>
  items.length < 2 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;

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
  const [training, real] = [TRAINING_PAIR, REAL_PAIR].map((p) => ({
    ...p,
    holding: holding({ belayerMass: p.belayer, stretcherMass: p.stretcher }).safety,
  }));
  const equal = [40, 150].map((m) => holding({ belayerMass: m, stretcherMass: m }).safety);
  const wetSteel = SURFACES.find((s) => s.key === "painted-steel")!.wet;
  const wetHold = wetSteel / hold.gripNeeded;
  const wetHolds = heaviestAt(1, wetSteel);
  const reachesTwo = heaviestAt(2);
  const slides = heaviestAt(1);
  const trainingRange = [TRAINING.from, TRAINING.to].map((m) => holding({ stretcherMass: m }).safety);
  const weightTable = TABLE_BELAYERS.map((b) =>
    TABLE_STRETCHERS.map((m) => holding({ belayerMass: b, stretcherMass: m }).safety),
  );
  const footings = SURFACES.flatMap((s) => [
    { label: `dry ${s.label.toLowerCase()}`, safety: s.dry / hold.gripNeeded },
    { label: `wet ${s.label.toLowerCase()}`, safety: s.wet / hold.gripNeeded },
  ]);
  const slipping = footings.filter((f) => f.safety < 1).map((f) => f.label);
  const best = Math.max(...footings.map((f) => f.safety));
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
          October 2026 · Online at{" "}
          <Link href="/standing-body-belays" className={LINK}>
            {SITE}/standing-body-belays
          </Link>
        </p>
      </header>

      <section className="flex flex-col gap-3 rounded-xl border border-amber-500/40 bg-amber-500/5 p-5 print:break-inside-avoid print:border-black print:bg-transparent">
        <h2 className="text-lg font-semibold text-amber-200">In short</h2>
        <ul className="flex list-disc flex-col gap-2 pl-5">
          <li>
            A belayer standing to hold a stretcher’s rope is kept from sliding towards the edge by nothing but the grip
            of their boots. How they lean or set their feet doesn’t change how much grip that takes. The figures here
            are the best case: a real belayer, shifting their feet or weight, does worse.
          </li>
          <li>
            For a common case, two {DEFAULTS.belayerMass} kg belayers on a high cube container lowering a{" "}
            {DEFAULTS.stretcherMass} kg stretcher, the safety factor (how many times over their boots could give the
            grip needed; below 1, they slide) is about {sf(low.safety)} while the rope runs over the edge, and about{" "}
            {sf(hold.safety)} once they stop to hold it. That’s on a clean, dry roof. On a wet one it’s about{" "}
            {sf(wetHold)}, and their feet slide. Even the {sf(low.safety)} relies on the edge’s friction, which good
            practice sets out to remove.
          </li>
          <li>
            It seems to work in training because the belayers are usually heavier than the mock casualty. A{" "}
            {training.belayer} kg belayer holding a {training.stretcher} kg stretcher has a safety factor of about{" "}
            {sf(training.holding)}. A {real.belayer} kg belayer holding a {real.stretcher} kg casualty and stretcher has
            about {sf(real.holding)}: their feet slide even on a dry roof.
          </li>
          <li>
            Changing where they stand, leaning harder or adding a backup belayer doesn’t get the safety factor to 2 in
            every arrangement, let alone the 10 the manual asks of the rope itself. A footing that rescuers rely on
            should have at least 2, in every arrangement it’s used in and allowing for the jerks a real lower brings.
          </li>
          <li>
            <strong className="text-slate-100">Proposal:</strong> standing body belays shouldn’t be used to lower or
            hold a stretcher. Use a hard belay, where the rope runs round a solid anchor rather than round a rescuer. A
            seated body belay, with the feet braced against something solid, is kept only as an emergency backup.
          </li>
        </ul>
      </section>

      <Section title="What the manual already says">
        <p>
          The General Rescue Manual (Ministry of Civil Defence & Emergency Management, March 2006) already points away
          from body belays for stretchers, and sets a high bar for the rope:
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
          belay, that’s two pairs of boots, and as the figures below show, their safety factor is about{" "}
          {sf(hold.safety)} at best, and well below 1 when the roof is wet. The manual doesn’t describe a standing body
          belay at all, yet it’s what teams commonly use for a two-point lower (a rope from above to the stretcher’s
          head, and a line from its foot to a team on the ground) off a roof or wall. In a two-point lower, the belayers{" "}
          <em>are</em> holding the stretcher’s weight, from the moment it goes over the edge. This note works through
          why that matters.
        </p>
      </Section>

      <Section title="The lower being looked at">
        <SetupDiagram />
        <p>
          Figure 1 shows the lower, off a high cube shipping container. Each belayer has the rope round their waist.
          Seen from above, the two ropes run from belayers {DEFAULTS.gap} m apart to the one point at the stretcher’s
          head, so they splay apart in a V. The ground team pulls steadily, about {kg(DEFAULTS.teamPull)}, to keep the
          stretcher off the wall. The roof is dry painted steel, and the ropes run over its painted steel rail.
        </p>
        <p>
          The weights are chosen to be ordinary rather than extreme. {DEFAULTS.belayerMass} kg is a typical adult
          rescuer. {DEFAULTS.stretcherMass} kg is a modest real load: an 80 kg casualty in a Ferno Model 71 basket
          stretcher. A real load is a whole adult plus the stretcher, so it’s usually heavier than any one belayer, and
          often much heavier. The section on training below shows how the figures change with the stretcher’s weight.
        </p>
        <p>
          The ladder hinge lower, where the stretcher hangs from a ladder pivoting out from the foot of the wall, loads
          its belayers in much the same way.
        </p>
      </Section>

      <Section title="Why only grip matters">
        <BelayerForcesDiagram />
        <p>
          Figure 2 shows the forces on one belayer. Two things act on them: their weight, down, and the rope’s pull at
          their waist, towards the edge and a little downwards. The only thing that can stop them is the ground under
          their boots. It pushes up on them (
          <M tex="N" />, their weight plus the rope’s downward pull), and its grip pushes back away from the edge (
          <M tex="F" />, which must match the rope’s pull towards the edge). The grip boots can give is at most{" "}
          <M tex={r`\mu_f N`} />, where <M tex={r`\mu_f`} /> is the friction coefficient between their soles and the
          ground: how hard they can be pushed sideways, for each unit they’re pressed together, before they slide. So
          with the rope’s tension <M tex="T" /> at an angle <M tex={r`\beta`} /> below level:
        </p>
        <Eq tex={r`\text{grip needed} = \frac{F}{N} = \frac{T\cos\beta}{W_b + T\sin\beta}`} />
        <Eq tex={r`\text{safety factor} = \frac{\mu_f}{\text{grip needed}}`} />
        <p>
          A safety factor of 2 means the boots could grip twice as hard as they need to; at 1, they’re on the point of
          sliding.
        </p>
        <p>
          Leaning back doesn’t appear in it. A belayer leans until their body lines up with that push from the ground,
          so they don’t topple, but how far they lean doesn’t change the push itself. Leaning less, they’re pulled over;
          leaning more, they fall back. Either way the total grip their boots must give is the same, and a wide or
          staggered stance doesn’t change it either.
        </p>
        <p>
          That makes these figures the best case. They take the belayer to stand perfectly still, leaning at just the
          right angle, with the grip shared between their boots in proportion to the weight on each. A real belayer
          rarely manages that. In a staggered stance, or while shifting their weight, one foot carries little weight but
          is still asked to grip, and that foot slides first. Sliding boots grip less than still ones, so the other foot
          must then make up the difference with less grip on offer, and it can follow. Any of these brings the real
          safety factor below the one worked out here. The figures also take it that the rope never runs through the
          belayer’s hands, which is a second way the belay can fail (see What the figures leave out).
        </p>
        <p>
          Experiments bear this out. Men pulling a handle as hard as they could, on a floor with a friction coefficient
          of about 0.48, managed on average only about a fifth of their body weight: under half what friction alone
          would allow (Chen and others, 2011). In earlier tests, men pushing until they almost slipped used only about
          half to four fifths of the grip on offer (Kroemer and Robinson, 1971). Neither was a body belay, but both
          point the same way: people give way well before the friction limit that these figures are worked out from.
        </p>
        <p>
          In the common case, each rope holds {newtons(hold.loadTension)} (about {kg(hold.loadTension)}): a little more
          than half the stretcher, because the ropes splay apart and the ground team’s pull adds to it. The ground
          pushes up on each belayer with {newtons(hold.up)} and their boots must grip with {newtons(hold.sideways)}, so
          the grip needed is {hold.gripNeeded.toFixed(2)}. Dry painted steel gives about {DEFAULTS.grip} (see Footing),
          for a safety factor of {sf(hold.safety)}.
        </p>
      </Section>

      <Section title="The edge helps only while the rope is running">
        <p>
          While the stretcher is being lowered, the rope slides over the edge, and the edge’s friction takes part of the
          load: in the common case, the rope bends {degrees(low.wrap)} over the rail, and rubs on it. Once the belayers
          stop to hold it, that friction can act either way, depending on how the rope settled, so it can’t be counted
          on. And to haul the stretcher back up, they must overcome it as well as the load.
        </p>
        <Table
          head={["", "Each belayer holds", "Safety factor"]}
          rows={[
            ["Lowering, rope running", newtons(low.tension), sf(low.safety)],
            ["Holding still (edge not counted)", newtons(hold.tension), sf(hold.safety)],
            ["Hauling back up", newtons(haul.tension), sf(haul.safety)],
          ]}
        />
        <p>
          Holding still is the case to plan for: it’s what happens when the lower stops for a snag, a call to stop, or a
          slip.
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
          Twice the friction coefficient gives twice the safety factor, so it changes a lot with the surface. The steel
          figures follow measurements with standard slip testers (English and Marletta, 1995; Vidal, 2010). Smooth
          painted steel measured 0.7 to 0.9 dry; this takes {DEFAULTS.grip}, the low end, to allow for weathered paint.
          Wet, it measured as little as 0.14 to 0.26 with glossy paints, and more with primers; this takes {wetSteel}.
          The testers use a standard rubber pad rather than boot soles, so even these are a guide. The other surfaces’
          figures are rough, middle-of-the-range estimates for rubber-soled boots. The real value varies a lot with the
          tread and its wear, the surface’s finish, and any dust, frost, oil or mud.
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
          Holding still, {listed(slipping)} are all below 1. Even the best, dry concrete or rough rock, gives only{" "}
          {sf(best)}: none reaches 2.
        </p>
      </Section>

      <Section title="Why it seems to work in training">
        <p>
          What matters is how heavy the stretcher is compared with the belayers. In training the belayers are usually
          heavier than the mock casualty, which makes it look much safer than it is with a real casualty, a stretcher,
          blankets and lashings.
        </p>
        <StretcherWeightGraph />
        <p>
          In Figure 3, on dry steel, a training load of {TRAINING.from}–{TRAINING.to} kg gives a safety factor of about{" "}
          {sf(trainingRange[1])} to {sf(trainingRange[0])}, and only loads up to about {reachesTwo} kg reach 2. A real
          casualty in a stretcher, {DEFAULTS.stretcherMass} kg or more, gives about {sf(hold.safety)} or less, and from
          about {slides + 1} kg the belayer’s feet slide even on a dry roof. On wet steel, only loads up to about{" "}
          {wetHolds} kg stay above 1.
        </p>
        <p>
          When the belayers and stretcher weigh the same, the safety factor holding still stays between about{" "}
          {sf(equal[0])} and {sf(equal[1])}, from 40 kg to 150 kg. A team that has only ever held light mock casualties
          has trained with a margin a real casualty won’t give them.
        </p>
        <p>
          For other weights, the table below gives the safety factor holding still on dry painted steel, with everything
          else as in Figure 1. Roughly, it’s the stretcher’s weight compared with the belayer’s that sets it.
        </p>
        <Table
          head={["Belayer ↓ / stretcher →", ...TABLE_STRETCHERS.map((m) => `${m} kg`)]}
          rows={TABLE_BELAYERS.map((b, i) => [`${b} kg`, ...weightTable[i].map(sf)])}
          highlight={(cell) => Number(cell) < 1}
        />
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
            belayers holding it, at a safety factor of about {sf(hold.safety)} on a dry roof and {sf(wetHold)} on a wet
            one.
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
            less. Shoulder to shoulder, the safety factor holding still is {sf(closer.safety)}; 4 m apart, it’s{" "}
            {sf(wider.safety)}.
          </li>
          <li>
            <strong className={STRONG}>Standing further back or closer to the edge.</strong> From 1.5 m back to 6 m
            back, it goes from {sf(near.safety)} to {sf(far.safety)}. Rescuers within 2 m of the edge should be tied off
            anyway, and an anchor good enough to tie off to is good enough for a hard belay.
          </li>
          <li>
            <strong className={STRONG}>Leaning harder, or a staggered stance.</strong> As above, these don’t change the
            total grip needed, and a staggered stance can make one foot slide first.
          </li>
          <li>
            <strong className={STRONG}>Sitting down, without bracing the feet.</strong> With their waist lower, the rope
            pulls them more nearly level and less downwards, so the ground pushes up less. That cancels out what sitting
            gains: holding still, a seated belayer whose feet only grip does about as well as a standing one.
          </li>
          <li>
            <strong className={STRONG}>A backup belayer.</strong> A second rescuer in front, leaning back into the
            belayer, adds their grip. If they add half as much grip as the belayer, the safety factor rises by half, to
            about {sf(hold.safety * backup)} holding still. That only just reaches 2, and only in the common case on a
            dry roof. It relies on two people’s footing and on the backup staying pressed into the belayer. With a{" "}
            {real.stretcher} kg casualty it’s about {sf(real.holding * backup)}, and on a wet roof about{" "}
            {sf(wetHold * backup)}: well short of 2, let alone the factor of 10 asked of the rope.
          </li>
          <li>
            <strong className={STRONG}>Heavier belayers.</strong> This helps, but only compared with the load. A 100 kg
            belayer holding a 120 kg casualty is back down to{" "}
            {sf(holding({ belayerMass: 100, stretcherMass: 120 }).safety)}.
          </li>
        </ul>
      </Section>

      <Section title="What does work">
        <ul className="flex list-disc flex-col gap-2 pl-5">
          <li>
            <strong className={STRONG}>A hard belay.</strong> The rope runs round a solid anchor through a Munter hitch
            (or another friction device), so the load goes into structure rather than through the rescuers’ boots. Real
            anchors should always be the first choice, and this is what the manual already asks for whenever possible.
          </li>
          <li>
            <strong className={STRONG}>Braced feet.</strong> A seated belayer whose feet are set against something solid
            (a parapet, a kerb, a beam) is held by that, not by friction, and is far stronger. It’s the only kind of
            body belay that does better than the boots’ grip, but it should still be an emergency backup only, for when
            there’s truly no anchor. It isn’t modelled here.
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
          <li>Stretcher lowers use hard belays from real anchors, which are always the first choice.</li>
          <li>
            A seated body belay, with the feet braced against something solid, is kept as an emergency backup only, for
            when there’s truly no anchor.
          </li>
          <li>
            Any belay that relies on rescuers’ footing should show a safety factor of at least 2, in every arrangement
            it’s used in and allowing for likely jerks and dynamic loads.
          </li>
          <li>
            In training, mock casualties are at least as heavy as the belayers, and preferably as heavy as a real
            casualty in a loaded stretcher, so that what teams learn matches what they’ll meet.
          </li>
        </ol>
      </Section>

      <Section title="How the figures were worked out">
        <p>Each figure comes from a static model of the lower, solved numerically:</p>
        <ul className="flex list-disc flex-col gap-2 pl-5">
          <li>
            The stretcher is a rigid 2 m bar. It settles where its weight, the ropes and the ground team’s steady pull
            balance, without passing through the wall or the ground.
          </li>
          <li>
            Each rope runs from the stretcher’s head, over the edge by the shortest path, to its belayer’s waist 1 m up.
            Seen from above, the two ropes form a V; the wider it opens, the more each rope carries.
          </li>
          <li>
            While the rope slides over the edge, the edge takes part of its tension. By the capstan rule, the belayer
            holds <M tex={r`e^{-\mu_e\theta}`} /> of the tension on the stretcher’s side, where <M tex={r`\mu_e`} /> is
            the friction coefficient between the rope and the edge and <M tex={r`\theta`} /> is how far the rope turns
            over it, in radians.
          </li>
          <li>
            Each belayer is a straight, rigid body from their feet to their head, leaning back until it lines up with
            the push from the ground. The grip needed and the safety factor then follow as above.
          </li>
        </ul>
        <p>
          To explore further, an interactive version of the same model, where any of the settings can be changed, is at{" "}
          <Link href="/body-belay" className={LINK}>
            {SITE}/body-belay
          </Link>
          .
        </p>
      </Section>

      <Section title="What the figures leave out">
        <p>
          The model is simplified and static. Almost everything it leaves out makes things worse for the belayers. The
          one exception is the edge’s friction while holding still, which isn’t counted because it can act either way:
        </p>
        <ul className="flex list-disc flex-col gap-2 pl-5">
          <li>
            It’s static. A jerk, such as the stretcher dropping as it goes over the edge or a belayer slipping, briefly
            loads the rope far more.
          </li>
          <li>The two belayers share the load evenly. In practice one usually takes more.</li>
          <li>
            The ground is level and clean. A patch of grit, frost or oil under one boot is enough to bring the safety
            factor down.
          </li>
          <li>
            Each belayer is a straight body from their feet to their head, with the rope round their waist 1 m up.
          </li>
          <li>
            They stand perfectly still, with the grip shared perfectly between their boots (see Why only grip matters).
          </li>
          <li>
            Their brake hands never let the rope run. In a body belay the rope is held by its friction round the
            belayer’s waist and by their grip on it. Under a heavy load it can run through before their feet slide,
            dropping the stretcher instead. That’s a second way the belay can fail, not extra margin.
          </li>
          <li>The rope and line don’t stretch, and the rope’s strength over the edge isn’t modelled.</li>
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
    "Body belay",
    "a belay where the rope runs round the belayer’s body, usually their waist, and is held by its friction there and by their brake hand. Also called a waist belay. A standing body belay is one done standing up.",
  ],
  ["Brake hand", "the belayer’s hand that grips the rope to stop it running."],
  [
    "Capstan rule",
    "how much of a rope’s pull a curved surface takes when the rope slides round it. It grows with how far the rope turns and how much it rubs.",
  ],
  [
    "Edge protection, edge roller",
    "a pad or roller over an edge, so the rope runs over it rather than rubbing on the edge.",
  ],
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
    "Ladder hinge lower",
    "a lower where the stretcher hangs from a ladder that pivots out from the foot of the wall, with a rope from above holding one end.",
  ],
  [
    "Munter hitch",
    "a friction hitch tied round a carabiner, which lets one rescuer control a heavy load on a rope running through it.",
  ],
  ["Newton (N)", "a unit of force. The weight of 1 kg is about 10 N."],
  ["Radian", "a measure of angle. A full turn is about 6.28 radians, so one radian is about 57°."],
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

/** The write-up's sources, in the order of their authors' names. */
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
    cite: "Kroemer, K. H. E. and Robinson, D. E. (1971).",
    title:
      "Horizontal Static Forces Exerted by Men Standing in Common Working Positions on Surfaces of Various Tractions",
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
    title:
      "Comparison of Slip Resistance of Tread Plate and Smooth Steel with Various Finishes Using a Variable Incidence Tribometer",
    from: "Proceedings of the American Academy of Forensic Sciences, C22.",
    url: "https://www.aafs.org/sites/default/files/media/documents/AAFS-2010-C22.pdf",
  },
];

/** The site's address, written out so it can be read on paper. */
const SITE = "physics.avut.nz";

const LINK = "text-sky-400 underline-offset-2 hover:text-sky-300 hover:underline print:underline";
const STRONG = "text-slate-100";

function Section(props: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xl font-semibold text-slate-100 print:break-after-avoid">{props.title}</h2>
      {props.children}
    </section>
  );
}

/** A table of figures; `highlight` picks out the cells to mark, such as safety factors below 1. */
function Table(props: { head: string[]; rows: string[][]; highlight?: (cell: string, column: number) => boolean }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-800 print:break-inside-avoid print:border-black">
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
