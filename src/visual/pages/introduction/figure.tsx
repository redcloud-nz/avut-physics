import { ChevronDown, Hand, MoveHorizontal } from "lucide-react";

/** One way of getting around: what to do, beside a picture of it, and what it does. */
function Control(props: {
    icon: React.ReactNode;
    action: React.ReactNode;
    children: React.ReactNode;
}) {
    return (
        <li className="flex items-start gap-3 rounded-lg bg-surface/60 px-3 py-2.5">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-raised text-highlight">
                {props.icon}
            </span>
            <div className="flex flex-col">
                <span className="font-medium text-ink-strong">{props.action}</span>
                <span className="text-sm text-ink-muted">{props.children}</span>
            </div>
        </li>
    );
}

export function ControlsFigure() {
    return (
        <ul className="my-auto flex flex-col gap-2">
            <Control
                icon={<MoveHorizontal className="size-4" />}
                action="Swipe sideways, or Next and Back"
            >
                Move between pages. The arrow keys work too.
            </Control>
            <Control icon={<Hand className="size-4" />} action="Slide or drag">
                Each page’s picture changes as you move its slider, or drag its arrows.
            </Control>
            <Control icon={<span className="font-semibold">?</span>} action="Tap the ?">
                More on the page, like the maths (it’s faded where there’s none). It’s between the
                buttons, or at the top on a wide screen. Try it here.
            </Control>
            <Control icon={<ChevronDown className="size-4" />} action="Tap the name at the top">
                The contents, to jump to any page. On a wide screen they’re down the left.
            </Control>
        </ul>
    );
}
