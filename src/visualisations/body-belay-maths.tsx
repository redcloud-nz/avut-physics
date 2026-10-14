import { Eq, M } from "@/components/tex";
import { PAST_EDGE, WAIST_HEIGHT } from "./body-belay-solver";
import { Part } from "./ladder-hinge-notes";
import { TEAM_REACH } from "./two-point-lower-solver";

const r = String.raw;

/** The body belay page's maths, step by step, as the solver works it out. Rendered on the server. */
export function BodyBelayMaths() {
  return (
    <section className="flex flex-col gap-4 rounded-xl border border-slate-800 bg-slate-900/50 p-4 text-sm leading-relaxed text-slate-400 lg:p-6">
      <h2 className="text-base font-medium text-slate-200">The maths</h2>
      <p>
        Coordinates: <M tex="x" /> out from the wall’s face, <M tex="y" /> up from the ground, <M tex="z" /> sideways
        along the wall, with the stretcher in the plane <M tex="z = 0" />. The wall is <M tex="H" /> high, the belayers
        stand <M tex="d" /> back from its face and <M tex="s" /> apart. The working below is for the belayer on the{" "}
        <M tex="z > 0" /> side; the other is their mirror image.
      </p>

      <Part title="The belayer’s waist">
        <p>
          Leaning back by <M tex={r`\lambda`} />, away from the horizontal direction <M tex={r`\hat{\mathbf f}`} /> of
          their rope’s pull, with the rope round their waist <M tex={`h = ${WAIST_HEIGHT}`} /> m up their body:
        </p>
        <Eq
          tex={r`\mathbf w = \left(-d - h\sin\lambda\, f_x,\;\; H + h\cos\lambda,\;\; \tfrac{s}{2} - h\sin\lambda\, f_z\right)`}
        />
      </Part>

      <Part title="The ropes">
        <p>
          Seen side on, each rope is paid out {PAST_EDGE} m past the edge, and its sideways run makes it longer. The
          ropes meet at the stretcher’s end at an angle <M tex={r`\alpha`} />:
        </p>
        <Eq
          tex={r`\ell = \sqrt{(w_y - H)^2 + w_x^2} + ${PAST_EDGE} \qquad L = \sqrt{\ell^2 + w_z^2} \qquad \alpha = 2\arcsin\frac{|w_z|}{L}`}
        />
      </Part>

      <Part title="The stretcher">
        <p>
          Seen side on, the two ropes act as one of length <M tex={r`\ell`} /> to the waists. The stretcher, weight{" "}
          <M tex="W" />, settles where its potential energy is lowest, with the team’s steady pull <M tex="T_2" />{" "}
          adding energy for each metre of line <M tex={r`\ell_2`} /> still out between them and the stretcher, until its
          end is within <M tex={`r = ${TEAM_REACH}`} /> m of them and they hold it there:
        </p>
        <Eq
          tex={r`\min\; U = W\,y_G + T_2\max(\ell_2, r) \quad\text{such that}\quad \text{rope path} \le \ell,\;\; \text{nothing passes through the wall or ground}`}
        />
        <p>
          Balancing the forces and torques on it then gives the ropes’ combined pull <M tex={r`\mathbf t_1`} />, along
          their last run, and the push <M tex={r`\mathbf N_i`} /> of anything it rests on:
        </p>
        <Eq
          tex={r`\mathbf W + \mathbf t_1 + \mathbf t_2 + \sum_i \mathbf N_i = \mathbf 0 \qquad \sum \mathbf r \times \mathbf F = 0`}
        />
        <p>Each rope pulls partly sideways, so each carries more than half:</p>
        <Eq tex={r`T_s = \frac{|\mathbf t_1|}{2\cos(\alpha/2)}`} />
      </Part>

      <Part title="Over the edge">
        <p>
          Unfolded flat about the edge, the rope is a straight line, so it crosses the edge at the same fraction of its
          length sideways as side on, where <M tex={r`\ell_e`} /> is the side-on run from the waist to the edge:
        </p>
        <Eq tex={r`\mathbf c = \left(0,\;\; H,\;\; w_z\,\frac{\ell - \ell_e}{\ell}\right)`} />
        <p>
          With <M tex={r`\hat{\mathbf u}_1`} /> along the rope from the waist to <M tex={r`\mathbf c`} /> and{" "}
          <M tex={r`\hat{\mathbf u}_2`} /> on from <M tex={r`\mathbf c`} /> to the stretcher, the rope turns through{" "}
          <M tex={r`\theta`} /> there. Sliding over an edge with friction coefficient <M tex={r`\mu_e`} />, the capstan
          rule gives the tension the belayer holds, and the edge takes the rest:
        </p>
        <Eq
          tex={r`\cos\theta = \hat{\mathbf u}_1\cdot\hat{\mathbf u}_2 \qquad T_1 = T_s\,e^{-\mu_e\theta} \qquad \mathbf E = T_s\,\hat{\mathbf u}_2 - T_1\,\hat{\mathbf u}_1`}
        />
      </Part>

      <Part title="The belayer’s footing">
        <p>
          The rope pulls their waist with <M tex={r`\mathbf P = T_1\,\hat{\mathbf u}_1`} />. Taking their weight{" "}
          <M tex="W_b" /> at the waist too, the ground balances both:
        </p>
        <Eq tex={r`\mathbf R = W_b\,\hat{\mathbf y} - \mathbf P \qquad N = R_y \qquad F = \sqrt{R_x^2 + R_z^2}`} />
        <p>
          Their body is a strut, so it must line up with <M tex={r`\mathbf R`} />, leaning away from the pull:
        </p>
        <Eq tex={r`\tan\lambda = \frac{F}{N} \qquad \hat{\mathbf f} = -\frac{(R_x,\, R_z)}{F}`} />
        <p>
          But <M tex={r`\mathbf R`} /> depends on where the waist is, through the rope’s direction{" "}
          <M tex={r`\hat{\mathbf u}_1`} /> and the wrap <M tex={r`\theta`} />. (While the rope wraps the edge, the
          stretcher doesn’t move: its end stays {PAST_EDGE} m past the edge.) So the page solves for the lean where the
          two agree,
        </p>
        <Eq tex={r`g(\lambda) = \arctan\frac{F(\lambda)}{N(\lambda)} - \lambda = 0`} />
        <p>
          by bracketing the root and closing in with regula falsi (the Illinois variant), to within{" "}
          <M tex={r`10^{-3}`} /> rad.
        </p>
      </Part>

      <Part title="Grip and safety factor">
        <p>
          The grip needed is the friction coefficient that just stops their feet sliding. With footing of friction
          coefficient <M tex={r`\mu_f`} />, they hold when it’s enough, and the safety factor is the friction their feet
          can take over the friction they need:
        </p>
        <Eq
          tex={r`\mu_{\text{req}} = \frac{F}{N} = \tan\lambda \qquad \text{holds if } \mu_{\text{req}} \le \mu_f \qquad \text{SF} = \frac{\mu_f N}{F} = \frac{\mu_f}{\mu_{\text{req}}}`}
        />
      </Part>
    </section>
  );
}
