import { G } from "@/lib/constants";

import { BLOCKS_X, loaded, RIDER, STATIC_X, TROLLEY_X } from "./fox";

/**
 * A rider's run down hawser A: the trolley rolling along the hawser as it sags under them, the rider swinging on the
 * dropper below it, the trolley meeting the dynamic brake's block and dragging it down the span (lifting the chain
 * weight), and the chain pulling it back until the rider rolls to rest. Worked out ahead of time, step by step, so it
 * can be played and scrubbed.
 *
 * Shortcuts: the hawser takes its shape at once for a load hanging straight down (its own swaying and the rider's
 * swing pulling it sideways are left out); the rider is a point at their harness's tie-in; the trolley rolls with a
 * steady rolling resistance; the block, brake line and lifted chain move with the trolley as one, the stabiliser
 * stopping them where they started on the way back.
 */

/** What the run is worked out from. All but the rider's mass are estimates. */
export type RunSetup = {
    /** The rider, with their harness and dropper (kg). */
    mass: number;
    /** The trolley and its carabiners (kg). */
    trolley: number;
    /** How far below the trolley the rider swings, to their harness's tie-in (m). */
    length: number;
    /** The trolley's rolling resistance, as a share of the load on its wheels. */
    rolling: number;
    /** The rider's drag area, seated: drag coefficient times frontal area (m²). */
    dragArea: number;
    /**
     * The chain weight: not one chain but several hanging together, branching into more lower down, so the further
     * it's lifted the more chain comes off the ground with each metre. Its hanging mass with the block pushed `d`
     * along is `hanging + perMetre d + growth d² / 2` (kg); each metre lifted then weighs `perMetre + growth d`.
     */
    chain: { hanging: number; perMetre: number; growth: number };
    /** The block, joining rope and brake line, dragged along with the trolley once it meets the block (kg). */
    brake: number;
    /**
     * Friction where the dropper hangs from the trolley, against the rider swinging relative to it: torque per turning
     * speed (N m s). It barely slows the rider's own swing, but stops the light trolley shuddering to and fro under them.
     */
    swingDamping: number;
};

/** How fast the chain weight's metres grow heavier as it's lifted (kg/m²): see `RUN.chain`, tuned in `run.test.ts`. */
export const CHAIN_GROWTH = 8.3;

export const RUN: RunSetup = {
    // A typical heavy rider, short of the heaviest the book allows (`RIDER.mass`).
    mass: 100,
    trolley: 1.5,
    length: RIDER.harness,
    rolling: 0.02,
    dragArea: 0.5,
    // About six light chains, a metre of each hanging at rest; how fast more joins in is set so the heaviest rider
    // (120 kg) stops just short of the static brakes.
    chain: { hanging: 6, perMetre: 6, growth: CHAIN_GROWTH },
    brake: 6,
    swingDamping: 100,
};

/** Air's density (kg/m³). */
const AIR = 1.2;

/** When the rider steps off the platform (s), and how long their weight takes to come onto the hawser. */
export const STEP_OFF = 2;
export const LOAD_ON = 0.5;

/** Where the trolley starts, at the launch. */
export const TROLLEY_START = TROLLEY_X.a;

/** Where the trolley's bumper meets block A, the trolley's middle this far along the span. */
export const HIT_X = TROLLEY_X.b;

/** How much chain hangs with the block pushed `d` along (kg), and how much each metre lifted then weighs (kg/m). */
export function chainAt({ hanging, perMetre, growth }: RunSetup["chain"], d: number) {
    return { mass: hanging + perMetre * d + (growth * d * d) / 2, perMetre: perMetre + growth * d };
}

/** One moment of the run. */
export type RunSample = {
    /** Seconds since the run started, the rider standing on the platform. */
    t: number;
    /** How much of the rider's weight is on the hawser: none on the platform, all once they've stepped off. */
    load: number;
    /** Where the trolley is along the span, and its height (m). */
    x: number;
    y: number;
    /** The rider's swing from straight down, positive forwards, down the span (radians). */
    swing: number;
    /** How far block A's been pushed down the span (m). */
    pushed: number;
    /** The trolley's speed along the wire (m/s). */
    speed: number;
};

/** A run, sampled `rate` times a second, and what happened along it. */
export type Run = {
    samples: RunSample[];
    rate: number;
    /** Its fastest, and where. */
    top: { speed: number; x: number };
    /** Furthest the block was pushed (m). */
    pushed: number;
    /** How far short of the static brakes the trolley got, at its furthest (m). */
    shortOfStatic: number;
    /** Whether the trolley reached the static brakes (it shouldn't). */
    reachedStatic: boolean;
    /** Where the rider came to rest. */
    rest: number;
};

/**
 * Where the trolley rides with a load of `mass`: its height along the span, tabulated, with its slope and curvature.
 * Hawser A is solved again for the load at each point (about 0.04 ms each).
 */
export function loadedPath(mass: number, from = 0.6, to = STATIC_X + 0.5, step = 0.05) {
    const n = Math.round((to - from) / step);
    const ys = Array.from({ length: n + 1 }, (_, i) => loaded(from + i * step, mass, 2).load!.y);
    const at = (x: number) => {
        const u = Math.min(Math.max((x - from) / step, 1), n - 2);
        const i = Math.floor(u);
        const f = u - i;
        // Catmull–Rom through the table, and its first and second derivatives.
        const [p0, p1, p2, p3] = [ys[i - 1], ys[i], ys[i + 1], ys[i + 2]];
        const a = -0.5 * p0 + 1.5 * p1 - 1.5 * p2 + 0.5 * p3;
        const b = p0 - 2.5 * p1 + 2 * p2 - 0.5 * p3;
        const c = -0.5 * p0 + 0.5 * p2;
        return {
            y: ((a * f + b) * f + c) * f + p1,
            slope: ((3 * a * f + 2 * b) * f + c) / step,
            bend: (6 * a * f + 2 * b) / (step * step),
        };
    };
    return { from, to, at };
}

/**
 * The run for `setup`, from rest at the launch until the rider's come to rest (or `limit` seconds), worked out in
 * steps of `dt` and sampled `rate` times a second.
 */
export function simulateRun(
    setup: RunSetup = RUN,
    { dt = 1 / 600, rate = 60, limit = 90 } = {},
): Run {
    const { mass: m, length: L } = setup;
    const path = loadedPath(m + setup.trolley);
    const staticX = STATIC_X - (HIT_X - BLOCKS_X);

    /**
     * The accelerations of the trolley's place along the span `x` and the rider's swing `a`, from Lagrange's
     * equations for the trolley (a point on the path) and the rider (a point `L` below it).
     */
    const accelerate = (x: number, a: number, vx: number, va: number, onBlock: boolean) => {
        const { y, slope: yp, bend: ypp } = path.at(x);
        const [sa, ca] = [Math.sin(a), Math.cos(a)];
        const pushed = onBlock ? Math.max(x - HIT_X, 0) : 0;
        // What moves with the trolley: itself, and the brake and the lifted chain once it's on the block.
        const lifted = chainAt(setup.chain, pushed);
        const mt = setup.trolley + (onBlock ? setup.brake + lifted.mass : 0);
        // Mass matrix and the forces on each coordinate (generalised).
        const M11 = (mt + m) * (1 + yp * yp);
        const M12 = m * L * (ca + yp * sa);
        const M22 = m * L * L;
        // Velocities and the parts of the accelerations from the curves (the path's bend, the swing's turn).
        const rv = { x: vx + L * ca * va, y: yp * vx + L * sa * va };
        const th = { x: 0, y: ypp * vx * vx };
        const rh = { x: -L * sa * va * va, y: ypp * vx * vx + L * ca * va * va };
        // The forces on the trolley and the rider.
        const along = Math.hypot(1, yp);
        const speed = Math.abs(vx) * along;
        const ux = 1 / along;
        const uy = yp / along;
        // Rolling resistance against the trolley's motion (eased in at a walking pace, so it settles smoothly).
        const roll = setup.rolling * (m + mt) * G * ux * Math.tanh(vx / 0.02);
        // The chain's pull back up the span: the weight hanging, and lifting it off the pile as it goes.
        const chain = onBlock ? lifted.mass * G + (vx > 0 ? lifted.perMetre * vx * vx : 0) : 0;
        const ft = { x: -(roll + chain) * ux, y: -(roll + chain) * uy - mt * G };
        const drag = 0.5 * AIR * setup.dragArea * Math.hypot(rv.x, rv.y);
        const fr = { x: -drag * rv.x, y: -drag * rv.y - m * G };
        // Each point's force less its mass times the curves' part, onto the coordinates (Jᵀ).
        const gt = { x: ft.x - mt * th.x, y: ft.y - mt * th.y };
        const gr = { x: fr.x - m * rh.x, y: fr.y - m * rh.y };
        const Q1 = gt.x + yp * gt.y + gr.x + yp * gr.y;
        // Friction at the pivot, against the swing relative to the trolley (which turns as the wire's slope does).
        const turning = va - (ypp * vx) / (1 + yp * yp);
        const Q2 = L * ca * gr.x + L * sa * gr.y - setup.swingDamping * turning;
        const det = M11 * M22 - M12 * M12;
        return {
            ax: (Q1 * M22 - Q2 * M12) / det,
            aa: (M11 * Q2 - M12 * Q1) / det,
            y,
            speed,
            M: [M11, M12, M22] as const,
        };
    };

    let [x, a, vx, va] = [TROLLEY_X.a, 0, 0, 0];
    let onBlock = false;
    // On the platform, clipped in, then stepping off: the rider's weight comes onto the hawser while the trolley's held
    // at the launch, and once it's all on, it's let go.
    const samples: RunSample[] = [];
    const start = x;
    for (let i = 0; i < (STEP_OFF + LOAD_ON) * rate; i++) {
        const t = i / rate;
        const u = Math.min(Math.max((t - STEP_OFF) / LOAD_ON, 0), 1);
        const load = u * u * (3 - 2 * u);
        const y = loaded(start, setup.trolley + m * load, 2).load!.y;
        samples.push({ t, load, x: start, y, swing: 0, pushed: 0, speed: 0 });
    }
    const held = samples.length / rate;
    let t = 0;
    let pushedMost = 0;
    let reachedStatic = false;
    let top = { speed: 0, x };
    const every = Math.round(1 / rate / dt);
    let still = 0;
    for (let k = 0; t <= limit; k++, t += dt) {
        const now = accelerate(x, a, vx, va, onBlock);
        if (k % every === 0)
            samples.push({
                t: held + t,
                load: 1,
                x,
                y: now.y,
                swing: a,
                pushed: onBlock ? Math.max(x - HIT_X, 0) : 0,
                speed: now.speed,
            });
        if (now.speed > top.speed) top = { speed: now.speed, x };
        // Settled: barely moving for a second.
        still = now.speed < 0.01 && Math.abs(va) < 0.01 ? still + dt : 0;
        if (still > 1 && k % every === 0) break;

        // A step (RK4).
        const f = (s: number[]) => {
            const r = accelerate(s[0], s[1], s[2], s[3], onBlock);
            return [s[2], s[3], r.ax, r.aa];
        };
        const s0 = [x, a, vx, va];
        const k1 = f(s0);
        const k2 = f(s0.map((v, i) => v + (dt / 2) * k1[i]));
        const k3 = f(s0.map((v, i) => v + (dt / 2) * k2[i]));
        const k4 = f(s0.map((v, i) => v + dt * k3[i]));
        [x, a, vx, va] = s0.map((v, i) => v + (dt / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]));

        if (!onBlock && x >= HIT_X && vx > 0) {
            // Meeting the block: a knock that sets the brake moving with the trolley. The block's push acts on the
            // trolley's place alone, so the rider's swing keeps its momentum.
            const before = accelerate(x, a, vx, va, false).M;
            onBlock = true;
            const after = accelerate(x, a, vx, va, true).M;
            const p1 = before[0] * vx + before[1] * va;
            const p2 = before[1] * vx + before[2] * va;
            const det = after[0] * after[2] - after[1] * after[1];
            [vx, va] = [
                (p1 * after[2] - p2 * after[1]) / det,
                (after[0] * p2 - after[1] * p1) / det,
            ];
        } else if (onBlock && x < HIT_X) {
            // Back where the block started: the stabiliser holds it there and the trolley rolls on without it.
            onBlock = false;
        }
        pushedMost = Math.max(pushedMost, onBlock ? x - HIT_X : 0);
        if (x >= staticX) {
            reachedStatic = true;
            vx = Math.min(vx, 0);
        }
    }
    return {
        samples,
        rate,
        top,
        pushed: pushedMost,
        shortOfStatic: staticX - (HIT_X + pushedMost),
        reachedStatic,
        rest: x,
    };
}

/** The run's state at `t` seconds, between its samples. */
export function sampleAt(run: Run, t: number): RunSample {
    const { samples } = run;
    const u = Math.min(Math.max(t * run.rate, 0), samples.length - 1);
    const i = Math.min(Math.floor(u), samples.length - 2);
    if (i < 0) return samples[0];
    const f = u - i;
    const [p, q] = [samples[i], samples[i + 1]];
    const mix = (k: keyof RunSample) => p[k] + (q[k] - p[k]) * f;
    return {
        t,
        load: mix("load"),
        x: mix("x"),
        y: mix("y"),
        swing: mix("swing"),
        pushed: mix("pushed"),
        speed: mix("speed"),
    };
}

/** How long a run lasts (s). */
export const runLength = (run: Run) => (run.samples.length - 1) / run.rate;
