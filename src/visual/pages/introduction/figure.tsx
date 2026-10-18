import { ChevronDown, Hand, MoveHorizontal } from "lucide-react";

/** One way of getting around: what to do, beside a picture of it, and what it does. */
function Control(props: {
    icon: React.ReactNode;
    action: React.ReactNode;
    children: React.ReactNode;
}) {
    return (
        <li className="flex items-start gap-3 rounded-lg bg-slate-900/60 px-3 py-2.5">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-slate-800 text-sky-300">
                {props.icon}
            </span>
            <div className="flex flex-col">
                <span className="font-medium text-slate-100">{props.action}</span>
                <span className="text-sm text-slate-400">{props.children}</span>
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
            <Control
                icon={<span className="h-1.5 w-5 rounded-full bg-sky-300" />}
                action="Tap the pill"
            >
                When the pill between the buttons is lit, there’s more on that page, like the maths.
                Try it here.
            </Control>
            <Control icon={<ChevronDown className="size-4" />} action="Tap the name at the top">
                The contents, to jump to any page.
            </Control>
        </ul>
    );
}
