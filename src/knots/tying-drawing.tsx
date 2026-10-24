import { tyingView, type TyingStep } from "./figure-eight-tying";
import { RopeDrawing } from "./rope-drawing";
import { centreline } from "./rope-path";
import { TyingArrow } from "./tying-arrow";

type View = { x: number; y: number; w: number; h: number };

/** The view every step of a knot's tying shares, so the rope stays put as the steps change. */
export function stepsView(steps: TyingStep[]): View {
    return tyingView(
        steps.flatMap((step) => [
            centreline(step.path).points,
            ...step.arrows.map((arrow) => arrow.points),
        ]),
    );
}

/** A knot finished: its last step without arrows, with the view fitted to it alone. */
export function finished(steps: TyingStep[]): { step: TyingStep; view: View } {
    const step = { ...steps[steps.length - 1], arrows: [] };
    return { step, view: stepsView([step]) };
}

/**
 * One step of tying a knot: the rope, with arrows where the step shows the next move. `turned` lays it on its side, a
 * quarter turn clockwise, so the end that was at the top is on the right. It's described by the step unless given
 * a `label`, and hidden from screen readers when the label is null (where it's only decoration).
 */
export function TyingDrawing(props: {
    step: TyingStep;
    view: View;
    turned?: boolean;
    label?: string | null;
    className?: string;
}) {
    const { step, view, turned, label = `${step.label}: ${step.caption}` } = props;
    // Turning maps (x, y) to (-y, x), so the view's x span becomes its y span, and its y span its x span the other way.
    const box = turned
        ? [-(view.y + view.h), view.x, view.h, view.w]
        : [view.x, view.y, view.w, view.h];
    return (
        <svg
            viewBox={box.join(" ")}
            className={props.className}
            {...(label === null ? { "aria-hidden": true } : { role: "img", "aria-label": label })}
        >
            <g transform={turned ? "rotate(90)" : undefined}>
                {/* Arrows go behind the rope unless they're marked in front, so one passing through a loop shows going
                    under it. */}
                {step.arrows.map(
                    (arrow, i) => !arrow.front && <TyingArrow key={i} points={arrow.points} />,
                )}
                <RopeDrawing path={step.path} />
                {step.arrows.map(
                    (arrow, i) => arrow.front && <TyingArrow key={i} points={arrow.points} />,
                )}
            </g>
        </svg>
    );
}
