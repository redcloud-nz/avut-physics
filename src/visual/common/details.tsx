import { Label } from "@/components/diagram/svg";
import type { Vector2 } from "@/lib/vector2";

/*
 * Pieces for pages' details: further reading for those who want it, such as the maths behind an idea. Details are
 * typeset once on the server, so they're never part of a page's figure.
 */

export const r = String.raw;

/** TeX in an arrow's colour, to tie a quantity to its arrow in the figure. */
export const ink = (color: string, tex: string) => r`\textcolor{${color}}{${tex}}`;

/** A letter in the text, in its arrow's colour. */
export function Var(props: { color: string; children: React.ReactNode }) {
    return <em style={{ color: props.color }}>{props.children}</em>;
}

/** A section of a page's details, under a heading. */
export function Section(props: { title: React.ReactNode; children: React.ReactNode }) {
    return (
        <section className="flex flex-col gap-2">
            <h2 className="font-semibold text-slate-100">{props.title}</h2>
            {props.children}
        </section>
    );
}

/** A letter in a drawing, in italics like the maths. */
export function Letter(props: { at: Vector2; color: string; children: React.ReactNode }) {
    return (
        <Label at={props.at} color={props.color}>
            <tspan fontStyle="italic" fontSize={16}>
                {props.children}
            </tspan>
        </Label>
    );
}
