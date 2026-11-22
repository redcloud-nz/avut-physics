import { LoaderCircle } from "lucide-react";

/**
 * What the 3D view shows while it loads: its code is fetched only when it's first shown, and then WebGL has to start
 * and build the tower before the first frame.
 */
export default function Loading3D() {
    return (
        <div
            role="status"
            className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-sm text-ink-muted"
        >
            <LoaderCircle className="size-8 animate-spin text-action" aria-hidden />
            Loading the 3D view…
        </div>
    );
}
