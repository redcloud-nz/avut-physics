import { DEFAULTS, FIGURES } from "@/articles/standing-body-belays-figures";
import { linearScale } from "@/lib/math";
import { SURFACES } from "@/visualisations/body-belay-surfaces";

/*
 * The safety factor holding still against the stretcher's weight, on dry and wet painted steel, for one belayer of
 * the article's default weight. Drawn in `currentColor` and its tints, so it prints in black on white.
 */

const STEEL = SURFACES.find((s) => s.key === "painted-steel")!;

/** The training loads shaded on the graph (kg). */
const TRAINING = FIGURES.training;

// The plot, in SVG user units: the axes' ranges and where they're drawn.
const MASS = { from: 40, to: 140 };
const SAFETY = { from: 0, to: 3 };
const W = 480;
const H = 300;
const PLOT = { left: 44, right: W - 48, top: 28, bottom: H - 44 };

const x = linearScale([MASS.from, MASS.to], [PLOT.left, PLOT.right]);
const y = linearScale([SAFETY.from, SAFETY.to], [PLOT.bottom, PLOT.top]);

const path = (points: [number, number][]) =>
    points
        .map(([kg, sf], i) => `${i ? "L" : "M"}${x(kg).toFixed(1)},${y(sf).toFixed(1)}`)
        .join(" ");

export function StretcherWeightGraph() {
    // The grip needed doesn't depend on the surface, so one solve gives both lines.
    const dry = FIGURES.graph.map((p) => [p.mass, STEEL.dry / p.gripNeeded] as [number, number]);
    const wet = FIGURES.graph.map((p) => [p.mass, STEEL.wet / p.gripNeeded] as [number, number]);
    const end = (line: [number, number][]) => line[line.length - 1];

    return (
        <figure className="flex flex-col gap-2 print:break-inside-avoid">
            <svg
                viewBox={`0 0 ${W} ${H}`}
                className="w-full text-ink-soft"
                fontSize={14}
                role="img"
                aria-labelledby="stretcher-weight-caption"
            >
                {/* Typical training loads. */}
                <rect
                    x={x(TRAINING.from)}
                    y={PLOT.top}
                    width={x(TRAINING.to) - x(TRAINING.from)}
                    height={PLOT.bottom - PLOT.top}
                    fill="currentColor"
                    opacity={0.08}
                />
                <text
                    x={(x(TRAINING.from) + x(TRAINING.to)) / 2}
                    y={PLOT.top + 18}
                    textAnchor="middle"
                    fill="currentColor"
                >
                    Training
                </text>

                {/* Below a safety factor of 1, the belayer's feet slide. */}
                <rect
                    x={PLOT.left}
                    y={y(1)}
                    width={PLOT.right - PLOT.left}
                    height={PLOT.bottom - y(1)}
                    className="text-figure-alarm print:text-black"
                    fill="currentColor"
                    opacity={0.1}
                />
                <text x={x(110)} y={y(1) + 20} textAnchor="middle" fill="currentColor">
                    Feet slide
                </text>

                {/* Gridlines and the y-axis. */}
                {[0, 0.5, 1, 1.5, 2, 2.5, 3].map((sf) => (
                    <g key={sf}>
                        <line
                            x1={PLOT.left}
                            x2={PLOT.right}
                            y1={y(sf)}
                            y2={y(sf)}
                            stroke="currentColor"
                            strokeWidth={sf === 1 ? 2 : sf === 2 ? 1.5 : 1}
                            strokeDasharray={sf === 2 ? "3 4" : undefined}
                            opacity={sf === 1 ? 0.9 : sf === 2 ? 0.7 : 0.15}
                        />
                        <text
                            x={PLOT.left - 8}
                            y={y(sf) + 5}
                            textAnchor="end"
                            fill="currentColor"
                            opacity={0.7}
                        >
                            {sf.toFixed(1)}
                        </text>
                    </g>
                ))}
                <text x={PLOT.right - 6} y={y(2) - 8} textAnchor="end" fill="currentColor">
                    Target
                </text>
                <text x={PLOT.left - 8} y={PLOT.top - 12} fill="currentColor">
                    Safety factor
                </text>

                {/* The x-axis. */}
                {[40, 60, 80, 100, 120, 140].map((kg) => (
                    <text
                        key={kg}
                        x={x(kg)}
                        y={PLOT.bottom + 18}
                        textAnchor="middle"
                        fill="currentColor"
                        opacity={0.7}
                    >
                        {kg}
                    </text>
                ))}
                <text
                    x={(PLOT.left + PLOT.right) / 2}
                    y={H - 6}
                    textAnchor="middle"
                    fill="currentColor"
                >
                    Stretcher and casualty (kg)
                </text>

                {/* The lines, each labelled at its end. */}
                <g
                    className="text-figure-accent print:text-black"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2.5}
                >
                    <path d={path(dry)} />
                    <path d={path(wet)} strokeDasharray="7 5" />
                </g>
                <g fill="currentColor">
                    <text x={x(end(dry)[0]) + 6} y={y(end(dry)[1]) + 5}>
                        Dry
                    </text>
                    <text x={x(end(wet)[0]) + 6} y={y(end(wet)[1]) + 5}>
                        Wet
                    </text>
                </g>
            </svg>
            <figcaption id="stretcher-weight-caption" className="text-sm text-ink-muted">
                <strong className="font-medium text-ink-soft">Figure 3.</strong> The safety factor
                holding still, for one {DEFAULTS.belayerMass} kg belayer, against the weight of the
                stretcher and casualty: on a painted steel container roof, dry (solid) and wet
                (dashed). Every other setting is the common case’s: a high cube container, the
                belayers {DEFAULTS.belayerBack} m back from the edge and {DEFAULTS.gap} m apart, and
                the ground team {DEFAULTS.teamDistance} m out from the wall. The dotted line at 2 is
                the least a footing should have.
            </figcaption>
        </figure>
    );
}
