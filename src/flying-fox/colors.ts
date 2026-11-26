import { STOP_BLOCK } from "@/rigging/hardware";

/** The flying fox's colours: its ropes and materials (`C`), and the colour sets of its hardware. */

/** The ropes and lines, and their colours. */
export const C = {
    hawser: "var(--tower-steel)",
    returnLine: "var(--knot-green)",
    brakeLine: "var(--knot-yellow)",
    joining: "var(--knot-blue)",
    shockCord: "var(--rig-white)",
    staticBrake: "var(--knot-red)",
    dropper: "var(--rig-maroon)",
    guy: "var(--knot-orange)",
    backstay: "var(--rig-black)",
    fibre: "var(--fox-fibre)",
    hessian: "var(--fox-hessian)",
    picket: "var(--fox-picket)",
    cap: "var(--knot-yellow)",
    steel: "var(--tower-steel)",
    brass: "var(--fox-brass)",
    /** Shackles' painted screw pins. */
    pin: "var(--fox-shackle-pin)",
    trolley: "var(--knot-red)",
    nylon: "var(--fox-nylon)",
    tirfor: "var(--fox-tirfor)",
    oval: "var(--fox-carabiner-oval)",
    tree: "var(--tower-log)",
    spar: "var(--fox-spar)",
    grate: "var(--fox-grate)",
    pulley: "var(--fox-pulley)",
    sheave: "var(--fox-sheave)",
};

/** The Tirfor's colours: its alloy body, steel pin and handle, yellow release lever, black grips and labels. */
export const TIRFOR_COLORS = {
    body: "var(--fox-tirfor)",
    steel: "var(--tower-steel)",
    lever: "var(--fox-tirfor-lever)",
    grip: "var(--rig-black)",
    label: "var(--rig-black)",
};

/** The trolleys' and pulleys' colours. */
export const TROLLEY_COLORS = {
    plates: "var(--knot-red)",
    sheave: "var(--fox-sheave)",
    steel: "var(--tower-steel)",
    bumper: "var(--rig-black)",
};

/** The size of the stop blocks' eyes, which the joining rope's tied into. */
export const STOP_BLOCK_EYE = STOP_BLOCK.eye.size;

/** The stop blocks' colours: the nylon body, steel eye bolts and brass bolts. */
export const STOP_BLOCK_COLORS = {
    body: "var(--fox-nylon)",
    steel: "var(--tower-steel)",
    brass: "var(--fox-brass)",
};

/** The colours of the flying fox's wire rope and its fittings (see `rigging/wire-ends`). */
export const WIRE = { steel: "var(--tower-steel)", wire: "var(--tower-steel)" };

export const PULLEY_COLORS = {
    plates: "var(--fox-pulley)",
    sheave: "var(--fox-sheave)",
    steel: "var(--tower-steel)",
    carabiner: "var(--fox-carabiner-oval)",
};
