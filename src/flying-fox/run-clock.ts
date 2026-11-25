/**
 * The run's clock, shared by the 3D scene (which moves it on each frame while it's playing) and the controls (which
 * play, pause and scrub it, and show where it's got to).
 */
export class RunClock {
    t = 0;
    playing = false;
    private listeners = new Set<() => void>();

    constructor(readonly length: number) {}

    /** Told whenever it's played, paused or scrubbed, and as it moves while playing. */
    subscribe(listener: () => void) {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    }

    private changed() {
        for (const l of this.listeners) l();
    }

    play() {
        // From the start again, once it's run to its end.
        if (this.t >= this.length) this.t = 0;
        this.playing = true;
        this.changed();
    }

    pause() {
        this.playing = false;
        this.changed();
    }

    seek(t: number) {
        this.t = Math.min(Math.max(t, 0), this.length);
        this.changed();
    }

    /** On by `dt` seconds while playing, stopping at the end. */
    advance(dt: number) {
        if (!this.playing) return;
        // A long gap between frames (a hidden tab) doesn't jump the run on.
        this.t = Math.min(this.t + Math.min(dt, 0.1), this.length);
        if (this.t >= this.length) this.playing = false;
        this.changed();
    }
}
