/**
 * Writing a 3D knot file, apart from reading one (`knot-file.ts`) so pages that only read knots don't carry Prettier.
 */
import type { Plugin } from "prettier";
import * as babel from "prettier/plugins/babel";
import * as estree from "prettier/plugins/estree";
import { format as prettierFormat } from "prettier/standalone";

import { PRETTIER_OPTIONS } from "@/knot-editor/knot-file";
import type { JsonObject } from "@/knot-editor/versions";
import { roundTo } from "@/lib/math";
import type { Vector3 } from "@/lib/vector3";

import { FORMAT, type Knot3dFile } from "./knot-file";
import { CURRENT_VERSION } from "./versions";

/** A length rounded for the file: to a hundredth of a millimetre. */
const metres = (n: number) => roundTo(n, 5);
const point = (p: Vector3, round = metres) => [round(p.x), round(p.y), round(p.z)];
/** A direction rounded for the file. */
const direction = (n: number) => roundTo(n, 5);

/** The file as text, laid out as Prettier lays out the repo's JSON, so a saved file needs no formatting. */
export async function writeKnot3d(file: Knot3dFile): Promise<string> {
    const json: JsonObject = {
        format: FORMAT,
        version: CURRENT_VERSION,
        name: file.name,
        ...(file.from !== undefined && { from: file.from }),
        diameter: metres(file.diameter),
        minBend: metres(file.minBend),
        stiffness: roundTo(file.stiffness, 4),
        props: file.props.map(
            (p): JsonObject =>
                p.kind === "bar"
                    ? {
                          id: p.id,
                          kind: p.kind,
                          at: point(p.at),
                          along: point(p.along, direction),
                          r: metres(p.r),
                      }
                    : { id: p.id, kind: p.kind, loop: p.loop.map((q) => point(q)), r: metres(p.r) },
        ),
        rope: {
            pins: file.rope.pins.map((p) => ({
                id: p.id,
                at: point(p.at),
                ...(p.along && { along: point(p.along, direction) }),
            })),
            segments: file.rope.segments.map((s) => ({
                id: s.id,
                name: s.name,
                tension: s.tension.map((t) => roundTo(t, 4)),
            })),
        },
        ...(file.crossings && {
            crossings: file.crossings.map((c) => [c.crossing, c.over ? "over" : "under"]),
        }),
        knot: file.knot,
        stages: file.stages.map((s) => ({
            shorten: s.shorten,
            hold: s.hold,
            straight: s.straight,
            ...(s.until !== undefined && { until: roundTo(s.until, 4) }),
            reached: roundTo(s.reached, 4),
            ended: s.ended,
        })),
    };
    return prettierFormat(JSON.stringify(json), {
        parser: "json",
        plugins: [babel, estree as Plugin],
        ...PRETTIER_OPTIONS,
    });
}
