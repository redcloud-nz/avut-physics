import { clamp } from "@/lib/math";
import type { OrbitCamera } from "@/lib/orbit-camera";
import { boundsOf, vec3, type Vector3 } from "@/lib/vector3";

import type { Fit } from "./use-flat-view";

/**
 * What a scene's views can lock onto (targets), framed in 3D and in the flat views, and where the 3D view can stand and
 * look round from (stances).
 */

/**
 * What the views can lock onto, up the site from the tree to the log: the box round all of each thing (`lo` to `hi`),
 * its middle, which the views turn and zoom about, and how far from it the 3D view starts (metres), far enough to see
 * all of the box.
 */
export type Target = {
    slug: string;
    label: string;
    lo: Vector3;
    hi: Vector3;
    centre: Vector3;
    distance: number;
    /** Where its view's middle may be panned to while locked onto it (see `Focus.pan`); none, it stays put. */
    pan?: { lo: Vector3; hi: Vector3 };
};

/** A target round `points`: centred in the box they span, and far enough out to see all of the box. */
export function framing(slug: string, label: string, points: Vector3[]): Target {
    const { lo, hi } = boundsOf(points);
    // The 3D view's 30° high, so a ball this big just fits it from about 3.9 times its radius out: a little further,
    // to leave some room round it.
    const r = hi.sub(lo).len() / 2;
    return {
        slug,
        label,
        lo,
        hi,
        centre: lo.lerp(hi, 0.5),
        distance: Math.max(4.2 * r, 1.5),
    };
}

/** `target`, its view's middle free to be panned within the box `box` gives round its centre. */
export const panned = (target: Target, box: (centre: Vector3) => [Vector3, Vector3]): Target => {
    const [lo, hi] = box(target.centre);
    return { ...target, pan: { lo, hi } };
};

/** Somewhere to stand on the site and look round from in 3D: where the eye is, and what it looks at first. */
export type NamedStance = {
    slug: string;
    label: string;
    at: Vector3;
    lookAt: Vector3;
    /** How wide it takes in to start with (degrees high), if not the usual. */
    fov?: number;
};

/** `p` kept inside the box from `lo` to `hi`: where a target's view may be panned. */
export const inBox = ({ lo, hi }: { lo: Vector3; hi: Vector3 }, p: Vector3) =>
    vec3(clamp(p.x, lo.x, hi.x), clamp(p.y, lo.y, hi.y), clamp(p.z, lo.z, hi.z));

/**
 * What a flat view shows of `target`: the box round it as seen from `cam`, with some room round it, and never smaller
 * than a few metres across, so a small part still has some of what's round it.
 */
export function targetFit(target: Target, cam: OrbitCamera): Fit {
    const [lo, hi] = [target.lo, target.hi];
    let [x, y] = [0, 0];
    for (const cx of [lo.x, hi.x])
        for (const cy of [lo.y, hi.y])
            for (const cz of [lo.z, hi.z]) {
                const d = vec3(cx, cy, cz).sub(target.centre);
                x = Math.max(x, Math.abs(d.dot(cam.right)));
                y = Math.max(y, Math.abs(d.dot(cam.up)));
            }
    return {
        centre: target.centre,
        width: Math.max(3 * x, 3),
        height: Math.max(3 * y, 3),
    };
}

/** `target` kept inside the view's fit box, so the middle of the view never leaves the site. */
export function inFit(cam: OrbitCamera, fit: Fit, target: Vector3): Vector3 {
    const d = target.sub(fit.centre);
    const [x, y] = [d.dot(cam.right), d.dot(cam.up)];
    const [cx, cy] = [
        clamp(x, -fit.width / 2, fit.width / 2),
        clamp(y, -fit.height / 2, fit.height / 2),
    ];
    return target.add(cam.right.scale(cx - x)).add(cam.up.scale(cy - y));
}
