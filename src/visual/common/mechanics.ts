/*
 * The maths behind the visual introduction's pages on slopes, levers and falls. Forces are in kilonewtons and
 * distances in metres, with gravity rounded to 10 m/s² as the series does, so 100 kg weighs 1 kN.
 */

/** Gravity, rounded as on Weight (the rest of the site uses `G`, 9.81, from `@/lib/constants`). */
export const g = 10;

/** On a slope `angle` radians from flat, the shares of a load's weight along the slope and into it. */
export const slopeParts = (angle: number) => ({
    along: Math.sin(angle),
    into: Math.cos(angle),
});

/**
 * The rope's pull, as a share of the load's weight, to drag it steadily up a slope (`hauling`) or let it steadily
 * down, where the surface grips with friction `mu` times how hard the load presses into it. Lowering, a load that
 * the surface would hold by itself needs no rope at all.
 */
export function slopePull(angle: number, mu: number, hauling: boolean) {
    const { along, into } = slopeParts(angle);
    return hauling ? along + mu * into : Math.max(0, along - mu * into);
}

/**
 * A lever on a pivot, the load `a` from it and your push `b` from it on the other side: how hard you push for each
 * unit of load, so the two turn it equally hard each way.
 */
export const leverPush = (a: number, b: number) => a / b;

/** How fast something is going after falling `fall` metres, in m/s. */
export const fallSpeed = (fall: number) => Math.sqrt(2 * g * fall);

/**
 * The force stopping a falling `weight` (kN) that's fallen `fall` metres, if it's brought to a stop evenly over
 * `stop` metres. The stop takes away the work gravity did over the whole fall and the stop, so it's the weight
 * times (fall + stop) / stop.
 */
export const stoppingForce = (weight: number, fall: number, stop: number) =>
    (weight * (fall + stop)) / stop;

/**
 * A falling `weight` (kN) caught by `length` metres of rope after falling `fall` metres, where the rope stretches by
 * `stretch` of its length for each kilonewton (as a spring: twice the pull, twice the stretch). At the bottom, the
 * rope's stretch has taken up all the work gravity did: weight × (fall + x) = ½ k x², with k = 1 / (stretch × length).
 */
export function ropeCatch(weight: number, fall: number, length: number, stretch: number) {
    const k = 1 / (stretch * length);
    const x = (weight + Math.sqrt(weight * weight + 2 * k * weight * fall)) / k;
    return { force: k * x, stretched: x };
}
