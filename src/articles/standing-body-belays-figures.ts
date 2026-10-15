import { G } from "@/lib/constants";
import { solveBelay, type Belayed } from "@/visualisations/body-belay-solver";
import { SURFACES } from "@/visualisations/body-belay-surfaces";

/*
 * The article's figures, worked out by the body belay page's own solver, so they always match what the page
 * shows for the same settings.
 */

/** The body belay page's defaults, in its units (masses in kg). */
export const DEFAULTS = {
  /** A high cube shipping container. */
  wallHeight: 2.89,
  belayerBack: 3,
  gap: 2,
  belayerMass: 80,
  /** An 80 kg casualty in a Ferno Model 71 (13.5 kg with straps and footplate), with a blanket and lashings. */
  stretcherMass: 95,
  /** Dry painted steel, a shipping container's roof. */
  grip: SURFACES.find((s) => s.key === "painted-steel")!.dry,
  /** A painted steel container rail. */
  edgeFriction: 0.2,
  teamDistance: 4,
  teamPull: 200,
};

export type Case = Partial<typeof DEFAULTS>;

/** The solver's whole arrangement, stretcher and belayers, for the page's defaults changed by `c`. */
export function arrangement(c: Case = {}): Belayed {
  const i = { ...DEFAULTS, ...c };
  const r = solveBelay({
    wallHeight: i.wallHeight,
    belayerBack: i.belayerBack,
    gap: i.gap,
    belayerWeight: i.belayerMass * G,
    grip: i.grip,
    edgeFriction: i.edgeFriction,
    teamDistance: i.teamDistance,
    teamPull: i.teamPull,
    barLength: 2,
    barWeight: i.stretcherMass * G,
  });
  if (r.kind === "none") throw new Error(`The body belay solver found no arrangement for ${JSON.stringify(c)}`);
  return r;
}

/** One belayer's load, for the page's defaults changed by `c`. */
export function belay(c: Case = {}) {
  const b = arrangement(c);
  return {
    /** Each rope's tension at the stretcher (N). */
    loadTension: b.loadTension,
    /** Each rope's tension at the belayer (N). */
    tension: b.tension,
    /** The ground's push up on each belayer's feet (N). */
    up: b.b.ground.y,
    /** The friction each belayer's feet must supply (N). */
    sideways: Math.hypot(b.b.ground.x, b.b.ground.z),
    gripNeeded: b.b.gripNeeded,
    /** How far each belayer leans back from upright (radians). */
    lean: b.b.lean,
    /** The footing's safety factor with this grip (the page's default unless given). */
    safety: b.b.safety,
    ropeAngle: b.ropeAngle,
    wrap: b.wrap,
  };
}

/** One belayer's load holding the stretcher still, with the edge's friction not counted, since it can act either way. */
export const holding = (c: Case = {}) => belay({ ...c, edgeFriction: 0 });
