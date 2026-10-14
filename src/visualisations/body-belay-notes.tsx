import { PAST_EDGE, WAIST_HEIGHT } from "./body-belay-solver";
import { Part } from "./ladder-hinge-notes";
import { TEAM_HEIGHT, TEAM_REACH } from "./two-point-lower-solver";

/** How the body belay page works out what it shows, and what it leaves out. */
export function BodyBelayNotes() {
  return (
    <section className="flex flex-col gap-4 rounded-xl border border-slate-800 bg-slate-900/50 p-4 text-sm leading-relaxed text-slate-400 lg:p-6">
      <h2 className="text-base font-medium text-slate-200">How this is calculated</h2>

      <Part title="The setup">
        <p>
          This is the two-point lower with the anchor taken away. Instead, two belayers stand side by side on the wall
          top, “Belayers’ setback” back from its face and “Gap between belayers” apart. Each holds their own rope round
          their waist, {WAIST_HEIGHT} m up from their feet. Both ropes are tied to the same end of the stretcher and run
          over the wall’s edge to them. The line from the stretcher’s other end runs to a ground team {TEAM_HEIGHT} m
          up, out in front, who pull it steadily with the “Ground team’s pull”. Once the stretcher’s end comes within{" "}
          {TEAM_REACH} m of them, they hold it there.
        </p>
        <p>
          The ropes’ length is fixed at the moment the stretcher has just gone over the edge. Seen side on, each rope is{" "}
          {PAST_EDGE} m longer than the straight run from the belayers’ waists to the edge. That’s when the ropes are
          under the most tension: the further the stretcher is lowered, the less they carry. The run to the edge depends
          on how far they lean, so the length is worked out together with their lean.
        </p>
      </Part>

      <Part title="The ropes">
        <p>
          The belayers stand either side of the stretcher, mirror images of each other. Seen from above, their ropes
          form a V from the stretcher’s end, and the wider apart they stand, the wider the V opens. Each rope takes the
          shortest path over the edge, which is a straight line if you unfold the rope flat about the edge. Their
          sideways pulls on the stretcher cancel, so only their pulls side on hold it up. A rope at an angle to the
          side-on view pulls partly sideways, so each must pull harder to give its share: each rope’s tension at the
          stretcher (T<sub>s</sub>) is half the ropes’ pull on the stretcher, divided by the cosine of half the angle
          between them. That’s the same rule as for the two legs of an anchor: at 120° apart, each rope carries the
          whole load.
        </p>
        <p>
          As the stretcher is lowered, each rope slides slowly over the wall’s edge, and the edge’s friction holds back
          part of its tension. By the capstan rule, the tension on the belayer’s side is the tension on the stretcher’s
          side times e<sup>−μθ</sup>, where μ is the friction coefficient between the rope and the edge and θ is how far
          the rope turns as it goes over it (in radians). The edge takes the difference. A painted steel container rail
          (μ about 0.2) turning the rope 60° takes about a fifth of the load; a concrete edge takes nearly half. The
          friction doesn’t move the stretcher: only how much of its pull reaches the belayers.
        </p>
      </Part>

      <Part title="The belayers">
        <p>
          Each belayer is treated as a straight, rigid body from their feet to their head, with their weight acting at
          their waist where the rope pulls. They lean back, away from their rope, until their body lines up with the
          rope’s pull and their weight added together. That combined push then runs straight down their body into their
          feet, and there’s nothing left to topple them either way. With the ropes in a V, the pull is partly towards
          the middle, so they lean partly outwards as well as back.
        </p>
        <p>
          The ground pushes back on their feet (R). Its upward part (N) is their weight plus the rope’s downward pull.
          Its sideways part (F) is friction, and it has to match the rope’s pull across the ground. The grip needed is F
          divided by N, which is also the tangent of their lean. If that is more than the footing’s friction
          coefficient, their feet slide towards the edge. The page still shows them at the lean they’d need. The
          footing’s safety factor is the footing’s friction coefficient divided by the grip needed: the friction their
          feet could take over the friction they need. Below 1, they slide. It only covers their footing, with steady
          loads; a jerk on the rope, one belayer taking more than their share, or a patch of wet or dust eats into it
          quickly.
        </p>
        <p>
          Leaning back moves their waists, which changes the ropes’ directions: how wide the V opens, how far each turns
          over the edge, and which way it pulls them. That changes the lean they need, so the page works out the lean
          and repeats until the two agree. The stretcher itself stays put: each rope runs {PAST_EDGE} m past the edge
          however they lean.
        </p>
      </Part>

      <Part title="Where the stretcher settles">
        <p>
          As on the two-point lower page, the stretcher settles where its potential energy is lowest, counting its
          weight and the team’s steady pull. The ropes can’t stretch, and nothing passes through the ground or the wall.
          The page then balances the forces and torques on the stretcher to get the ropes’ pull on it, the line’s pull
          (T₂) and the push of whatever it rests on (N).
        </p>
      </Part>

      <Part title="Assumptions and shortcuts">
        <ul className="flex list-disc flex-col gap-1.5 pl-5">
          <li>
            It’s static: each picture is where things would come to rest. There’s no swinging, no speed of lowering, no
            jerk if the stretcher drops, and no history.
          </li>
          <li>
            The belayers keep their bodies straight from feet to head. A real belayer sits, crouches or braces a foot
            against something, and can bend at the hips and knees. Any of these changes how much grip they need.
          </li>
          <li>
            Each footing’s friction coefficient is a rough, middle-of-the-range figure for rubber-soled boots. The real
            value varies a lot with the boots’ tread and wear, the surface’s finish, and dust, frost, oil or mud on it,
            and the ground is taken as level.
          </li>
          <li>
            Each rope holds fast round its belayer’s waist. How hard their brake hands have to grip isn’t modelled.
          </li>
          <li>
            The edge’s friction only helps while the rope is sliding towards the stretcher. Once the belayers stop
            lowering, it can act either way, depending on how the rope settled: their side can be anything from e
            <sup>−μθ</sup> to e<sup>μθ</sup> times the stretcher’s side. If they pull the stretcher back up, it works
            against them instead: they’d need e<sup>μθ</sup> times the stretcher’s side, not e<sup>−μθ</sup>. A
            frictionless edge is the safe case to plan for.
          </li>
          <li>
            The edge is treated as a sharp corner the rope bends round, with one friction coefficient. Rope on a real
            edge varies with the rope’s sheath, its speed, dirt and wear, and the figures for each edge are rough.
            Bending round a tight edge also stiffens the rope’s run over it, adding some drag the capstan rule leaves
            out.
          </li>
          <li>
            The rope’s strength isn’t modelled. A shipping container’s roof edge is a square steel tube with only a few
            millimetres’ radius, much tighter than the rope’s diameter. A rope bent that sharply loses much of its
            strength, and sliding over paint, rust or burrs wears its sheath. Use edge protection or an edge roller
            whatever the belay.
          </li>
          <li>There’s no friction where the stretcher touches the ground or the wall.</li>
          <li>The rope and line are weightless and don’t stretch, and the stretcher is rigid and uniform.</li>
          <li>
            The belayers are exactly mirror images, sharing the load evenly. In practice one usually takes more than the
            other.
          </li>
          <li>The stretcher doesn’t sway sideways or twist.</li>
        </ul>
      </Part>
    </section>
  );
}
