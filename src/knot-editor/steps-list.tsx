"use client";

/**
 * The list on the left: the knot, then each step as its number and the start of its instructions. Choosing one shows
 * its picture. The heading's + adds a step after the one shown, as Insert > Step does. The step shown can be duplicated
 * (the copy keeps its number, as the same step shown twice), moved up or down, or deleted; numbers are only ever typed,
 * never counted again.
 */
import { ArrowDown, ArrowUp, Copy, Trash2 } from "lucide-react";
import type { Dispatch, ReactNode } from "react";

import { Button } from "@/components/ui/button";

import { deleteStep, duplicateStep, moveStep } from "./edits";
import type { KnotFile } from "./format";
import { ListHeading } from "./list-heading";
import type { EditorAction, PictureId } from "./state";

/** How much of a step's instructions the list shows. */
const PREVIEW = 40;

const preview = (text: string) => {
    const line = text.trim().replace(/\s+/g, " ");
    return line.length > PREVIEW ? `${line.slice(0, PREVIEW).trimEnd()}…` : line;
};

export function StepsList(props: {
    file: KnotFile;
    shown: PictureId;
    dispatch: Dispatch<EditorAction>;
    /** Insert > Step: a step after the one shown. */
    addStep: () => void;
}) {
    const { file, shown, dispatch } = props;
    const show = (picture: PictureId) => dispatch({ type: "show", picture });
    const item = (id: PictureId, label: ReactNode) => (
        <button
            key={id}
            type="button"
            className={`block w-full rounded px-2 py-0.5 text-left ${
                shown === id ? "bg-surface-raised text-highlight" : "text-ink hover:bg-surface"
            }`}
            onClick={() => show(id)}
        >
            {label}
        </button>
    );
    const k = typeof shown === "number" ? shown : undefined;
    const tool = (label: string, icon: ReactNode, disabled: boolean, run: () => void) => (
        <Button
            size="icon-sm"
            variant="ghost"
            aria-label={label}
            title={label}
            disabled={disabled}
            onClick={run}
        >
            {icon}
        </Button>
    );
    return (
        <nav aria-label="Knot and steps">
            {item("knot", "Knot")}
            <ListHeading label="Steps" add="Add a step" onAdd={props.addStep} />
            {file.steps.map((step, j) =>
                item(
                    j,
                    <>
                        <span className="font-mono">{step.number}</span>
                        <span className="ml-2 text-ink-muted">
                            {preview(step.instructions) || "No instructions"}
                        </span>
                    </>,
                ),
            )}
            {file.steps.length === 0 && (
                <p className="px-2 text-xs text-ink-muted">None yet: Insert &gt; Step adds one.</p>
            )}
            {k !== undefined && (
                <div className="mt-2 flex gap-1 px-1">
                    {tool("Duplicate step", <Copy />, false, () =>
                        dispatch({
                            type: "edit-file",
                            edit: (f) => duplicateStep(f, k),
                            show: k + 1,
                        }),
                    )}
                    {tool("Move step up", <ArrowUp />, k === 0, () =>
                        dispatch({
                            type: "edit-file",
                            edit: (f) => moveStep(f, k, -1),
                            show: k - 1,
                        }),
                    )}
                    {tool("Move step down", <ArrowDown />, k === file.steps.length - 1, () =>
                        dispatch({
                            type: "edit-file",
                            edit: (f) => moveStep(f, k, 1),
                            show: k + 1,
                        }),
                    )}
                    {tool("Delete step", <Trash2 />, false, () =>
                        dispatch({
                            type: "edit-file",
                            edit: (f) => deleteStep(f, k),
                            show: k > 0 ? k - 1 : file.steps.length > 1 ? 0 : "knot",
                        }),
                    )}
                </div>
            )}
        </nav>
    );
}
