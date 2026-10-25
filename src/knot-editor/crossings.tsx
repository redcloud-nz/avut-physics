/**
 * Marks on the drawing at each crossing and each pass across a prop. An unset one gets a red dot; one to check, or
 * too close to another for its over stretch, gets an amber ring. With View > Crossings on, every crossing also gets a
 * small dot and a letter (A, B…, as the old editor had), and every pass a dot, so they can be named.
 *
 * Each mark is also where a click sets or swaps that crossing or pass: they carry `data-hit` and `data-ref` (the
 * index into `pictureCrossings`' lists) for the canvas. Sizes are in screen pixels, turned into diameters by `px`.
 */

import type { Vector2 } from "@/lib/vector2";

import type { MatchStatus } from "./crossing-geometry";

const HIT = 7;
const DOT = 4;
const RING = 6.5;
const SMALL = 2.5;

/** A crossing's letter: A to Z, then AA, AB… */
export function crossingLetter(k: number): string {
    const letter = String.fromCharCode(65 + (k % 26));
    return k < 26 ? letter : crossingLetter(Math.floor(k / 26) - 1) + letter;
}

/** What one mark shows. */
export type Mark = { at: Vector2; status: MatchStatus; tooClose: boolean; letter?: string };

function MarkDrawing(props: {
    mark: Mark;
    hit: "crossing" | "pass";
    index: number;
    shown: boolean;
    px: number;
}) {
    const { mark, px } = props;
    const { x, y } = mark.at;
    const warn = mark.status === "to-check" || mark.tooClose;
    return (
        <g data-hit={props.hit} data-ref={props.index} className="cursor-pointer">
            <circle cx={x} cy={y} r={HIT * px} fill="transparent" />
            {mark.status === "unset" ? (
                <circle
                    cx={x}
                    cy={y}
                    r={DOT * px}
                    fill="var(--danger)"
                    stroke="var(--knot-outline)"
                    strokeWidth={1 * px}
                />
            ) : warn ? (
                <circle
                    cx={x}
                    cy={y}
                    r={RING * px}
                    fill="none"
                    stroke="var(--warning)"
                    strokeWidth={2.5 * px}
                />
            ) : (
                props.shown && (
                    <circle
                        cx={x}
                        cy={y}
                        r={SMALL * px}
                        fill="var(--highlight)"
                        stroke="var(--knot-outline)"
                        strokeWidth={1 * px}
                    />
                )
            )}
            {props.shown && mark.letter && (
                <text
                    x={x + 7 * px}
                    y={y - 7 * px}
                    fontSize={11 * px}
                    fill="var(--highlight)"
                    stroke="var(--halo)"
                    strokeWidth={3 * px}
                    paintOrder="stroke"
                    pointerEvents="none"
                >
                    {mark.letter}
                </text>
            )}
        </g>
    );
}

/** Every crossing's and pass's mark. `shown` is View > Crossings. */
export function CrossingMarks(props: {
    crossings: Mark[];
    passes: Mark[];
    shown: boolean;
    px: number;
}) {
    const { shown, px } = props;
    return (
        <g>
            {props.passes.map((mark, k) => (
                <MarkDrawing key={`p${k}`} mark={mark} hit="pass" index={k} shown={shown} px={px} />
            ))}
            {props.crossings.map((mark, k) => (
                <MarkDrawing
                    key={`c${k}`}
                    mark={mark}
                    hit="crossing"
                    index={k}
                    shown={shown}
                    px={px}
                />
            ))}
        </g>
    );
}
