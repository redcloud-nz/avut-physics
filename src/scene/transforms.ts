import type { Vector3 } from "@/lib/vector3";

import "./pieces";

import type { Piece } from "./pieces";

/** Pieces moved, turned and recoloured as a whole. */

export const colored = <T extends Piece>(pieces: T[], color: string): T[] =>
    pieces.map((p) => ({ ...p, color }));

/** `pieces` moved by `d`. */
export function moved(pieces: Piece[], d: Vector3): Piece[] {
    return pieces.map((p) =>
        p.kind === "rod"
            ? { ...p, a: p.a.add(d), b: p.b.add(d) }
            : {
                  ...p,
                  points: p.points.map((q) => q.add(d)),
                  ...(p.kind === "face" &&
                      p.holes && { holes: p.holes.map((h) => h.map((q) => q.add(d))) }),
              },
    );
}

/** Where a rigid part of a moving rig is: turned by `angle` about `axis` (through its own origin), then moved to `at`. */
export type Pose = { at: Vector3; axis: Vector3; angle: number };

/** `pieces`, built about the origin, put in `pose`. */
export function posed(pieces: Piece[], { at, axis, angle }: Pose): Piece[] {
    const point = (q: Vector3) => q.turned(axis, angle).add(at);
    const dir = (q: Vector3) => q.turned(axis, angle);
    return pieces.map((p) => {
        if (p.kind === "rod") return { ...p, a: point(p.a), b: point(p.b) };
        if (p.kind === "face")
            return {
                ...p,
                points: p.points.map(point),
                ...(p.holes && { holes: p.holes.map((h) => h.map(point)) }),
            };
        return {
            ...p,
            points: p.points.map(point),
            ...(p.tape && {
                tape: {
                    ...p.tape,
                    across: dir(p.tape.across),
                    ...(p.tape.profile && {
                        profile: p.tape.profile.map((q) => ({
                            ...q,
                            ...(q.across && { across: dir(q.across) }),
                        })),
                    }),
                },
            }),
        };
    });
}
