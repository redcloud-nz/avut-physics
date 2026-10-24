/**
 * How a loaded ute's weight shares between its axles, and how close each total comes to its rating.
 *
 * Seen side on, the ute is a beam resting on two supports, its axles. Positions run along the ute in metres,
 * measured back from the front axle's centre (negative ahead of it), so the rear axle is at the wheelbase. Loads
 * and ratings are masses in kilograms, as compliance plates give them: an axle's "load" is the mass whose weight
 * it carries. The beam is statically determinate: taking moments about the front axle gives the rear axle's
 * share of each load, and the front takes the rest. A tow ball behind the rear axle puts more than its own load
 * on the rear axle and lifts the difference off the front.
 */

export type Load = {
    label: string;
    /** kg */
    mass: number;
    /** Metres back from the front axle's centre (negative: ahead of it). */
    x: number;
};

export type Setup = {
    wheelbase: number;
    /** The ute as weighed empty (kg), and the share of that on its front axle. */
    unladen: number;
    unladenFrontShare: number;
    /** Everything added to the empty ute, tow ball download excepted. */
    loads: Load[];
    /** The trailer's whole mass (kg), and how far behind the rear axle its tow ball sits (m). */
    trailer: number;
    /** The share of the trailer's mass carried on the tow ball. */
    ballShare: number;
    ballBehindRearAxle: number;
};

export type Ratings = {
    /** Gross vehicle mass: the most the ute may weigh, tow ball download included. */
    gvm: number;
    /** Gross combination mass: the most the ute and trailer may weigh together. */
    gcm: number;
    frontAxle: number;
    rearAxle: number;
    /** Braked towing capacity and the most the tow ball may carry. */
    towing: number;
    towBall: number;
};

export type Check = {
    key: "gvm" | "gcm" | "frontAxle" | "rearAxle" | "towing" | "towBall";
    value: number;
    limit: number;
};

export type Loaded = {
    front: number;
    rear: number;
    /** Front plus rear: what the ute weighs on a weighbridge, tow ball download included. */
    gross: number;
    ball: number;
    /** The ute's gross plus what the trailer's own axles carry. */
    combined: number;
    /** How much of the ball's download lands on the rear axle, and what it lifts off the front. */
    ballOnRear: number;
    ballOffFront: number;
    /** The front axle's share of the gross. */
    frontShare: number;
};

/**
 * Where things sit in a typical dual cab, in metres back from the front axle. Cabs are much alike, so the seats,
 * roof load, underbody plates and fuel tank sit at the same distances in every ute. These are estimates, not
 * measurements.
 */
export const CAB = {
    frontSeat: 1.3,
    rearSeat: 2.15,
    roof: 1.2,
    underbody: 0.3,
    fuelTank: 2.5,
} as const;

/** A rating counts as nearly reached from this share of it. */
export const NEAR = 0.9;

/** Diesel's density (kg/L). */
export const DIESEL = 0.84;
/** Tare is weighed with about this much fuel in the tank (L). */
export const TARE_FUEL = 10;

/** How far a bullbar's and winch's mass sits back from the front bumper. */
export const BULLBAR_DEPTH = 0.2;
/** The tub's floor ends this far short of the rear bumper; the tow ball sits this far past it. */
export const TAILGATE = 0.15;
export const BALL_PAST_BUMPER = 0.1;

/** Where the front fit-out, the tub and the tow ball sit in a ute of these dimensions. */
export function layoutFor(u: {
    wheelbase: number;
    frontOverhang: number;
    rearOverhang: number;
    tubLength: number;
}) {
    const rearBumper = u.wheelbase + u.rearOverhang;
    const tubEnd = rearBumper - TAILGATE;
    return {
        frontBumper: -u.frontOverhang,
        rearBumper,
        frontFitout: BULLBAR_DEPTH - u.frontOverhang,
        tubStart: tubEnd - u.tubLength,
        tubEnd,
        ball: rearBumper + BALL_PAST_BUMPER,
    };
}

export type LoadResult = { kind: "loaded"; l: Loaded } | { kind: "none"; reason: string };

/** Each load's share on the rear axle, by moments about the front axle. Loads behind the rear axle put more than their own mass on it. */
export const rearShare = (x: number, wheelbase: number) => x / wheelbase;

export function solveLoads(s: Setup): LoadResult {
    if (!(s.wheelbase > 0))
        return { kind: "none", reason: "The wheelbase must be longer than zero." };
    if (!(s.unladenFrontShare >= 0 && s.unladenFrontShare <= 1))
        return {
            kind: "none",
            reason: "The empty ute's share on its front axle must be between 0 and 1.",
        };
    if (!(s.unladen >= 0 && s.trailer >= 0 && s.loads.every((l) => l.mass >= 0)))
        return { kind: "none", reason: "Masses can't be less than zero." };
    if (!(s.ballShare >= 0 && s.ballShare <= 1))
        return {
            kind: "none",
            reason: "The tow ball's share of the trailer must be between 0 and 1.",
        };
    const ball = s.trailer * s.ballShare;
    const ballX = s.wheelbase + s.ballBehindRearAxle;
    let rear = s.unladen * (1 - s.unladenFrontShare);
    let front = s.unladen * s.unladenFrontShare;
    for (const l of [...s.loads, { label: "tow ball", mass: ball, x: ballX }]) {
        const r = l.mass * rearShare(l.x, s.wheelbase);
        rear += r;
        front += l.mass - r;
    }
    if (front <= 0)
        return {
            kind: "none",
            reason: "The front wheels would lift off the ground: the loads behind the rear axle outweigh the ute in front of it.",
        };
    if (rear <= 0)
        return {
            kind: "none",
            reason: "The rear wheels would lift off the ground: the loads ahead of the front axle outweigh the ute behind it.",
        };
    const ballOnRear = ball * rearShare(ballX, s.wheelbase);
    const gross = front + rear;
    return {
        kind: "loaded",
        l: {
            front,
            rear,
            gross,
            ball,
            combined: gross + s.trailer - ball,
            ballOnRear,
            ballOffFront: ballOnRear - ball,
            frontShare: front / gross,
        },
    };
}

/** Each rating against what it limits, in a fixed order. */
export function checksFor(s: Setup, l: Loaded, r: Ratings): Check[] {
    return [
        { key: "gvm", value: l.gross, limit: r.gvm },
        { key: "frontAxle", value: l.front, limit: r.frontAxle },
        { key: "rearAxle", value: l.rear, limit: r.rearAxle },
        { key: "gcm", value: l.combined, limit: r.gcm },
        { key: "towing", value: s.trailer, limit: r.towing },
        { key: "towBall", value: l.ball, limit: r.towBall },
    ];
}
