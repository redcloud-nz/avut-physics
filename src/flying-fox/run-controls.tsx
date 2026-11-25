"use client";

import { Pause, Play, RotateCcw } from "lucide-react";
import { useSyncExternalStore } from "react";

import { sampleAt, type Run } from "./run";
import type { RunClock } from "./run-clock";

/** Play, pause and scrub a run, with how far in it is and how fast the rider's going. */
export default function RunControls({
    run,
    clock,
    className,
}: {
    run: Run;
    clock: RunClock;
    className: string;
}) {
    const subscribe = (l: () => void) => clock.subscribe(l);
    const t = useSyncExternalStore(
        subscribe,
        () => clock.t,
        () => 0,
    );
    const playing = useSyncExternalStore(
        subscribe,
        () => clock.playing,
        () => false,
    );
    const s = sampleAt(run, t);
    const ended = t >= clock.length;
    return (
        <div className={className}>
            <button
                type="button"
                onClick={() => (playing ? clock.pause() : clock.play())}
                aria-label={playing ? "Pause the run" : ended ? "Run it again" : "Play the run"}
                title={playing ? "Pause" : ended ? "Again" : "Play"}
                className="flex size-9 shrink-0 items-center justify-center rounded-lg text-ink-soft transition-colors hover:bg-line-faint hover:text-ink-strong [&_svg]:size-4"
            >
                {playing ? <Pause /> : ended ? <RotateCcw /> : <Play />}
            </button>
            <input
                type="range"
                min={0}
                max={clock.length}
                step={0.01}
                value={t}
                onChange={(e) => clock.seek(Number(e.target.value))}
                aria-label="How far into the run"
                className="min-w-0 flex-1 accent-ink-soft"
            />
            <span className="w-24 shrink-0 text-right text-xs text-ink-soft tabular-nums">
                {t.toFixed(1)} s · {Math.round(s.speed * 3.6)} km/h
            </span>
        </div>
    );
}
