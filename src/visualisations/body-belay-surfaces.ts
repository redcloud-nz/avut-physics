/**
 * The surfaces the belayers might stand on, each with the friction coefficient between it and rubber-soled boots,
 * dry and wet. These are rough, middle-of-the-range figures: the real value varies a lot with the boots' tread
 * and wear, the surface's finish and age, and what's on it.
 *
 * Painted and chequer-plate steel follow slip-tester measurements: English & Marletta, "An Investigation of Surface
 * Slip Resistance on Structural Steel" (CPWR, 1995), and Vidal, "Comparison of Slip Resistance of Tread Plate and
 * Smooth Steel with Various Finishes Using a Variable Incidence Tribometer" (AAFS, 2010). Smooth painted steel
 * measured 0.7 to 0.9 dry and 0.14 to 0.26 wet with glossy paints, and higher with primers; these take the low end
 * dry and allow for less glossy paint wet. The rest are estimates.
 */
export const SURFACES = [
    { key: "concrete", label: "Concrete", dry: 0.8, wet: 0.6 },
    { key: "asphalt", label: "Asphalt", dry: 0.75, wet: 0.55 },
    { key: "rock", label: "Rough rock", dry: 0.8, wet: 0.55 },
    { key: "dirt", label: "Packed dirt", dry: 0.65, wet: 0.35 },
    { key: "gravel", label: "Loose gravel", dry: 0.5, wet: 0.45 },
    { key: "grass", label: "Grass", dry: 0.45, wet: 0.25 },
    { key: "timber", label: "Timber decking", dry: 0.6, wet: 0.35 },
    { key: "chequer", label: "Chequer-plate steel", dry: 0.75, wet: 0.6 },
    { key: "painted-steel", label: "Painted steel", dry: 0.7, wet: 0.3 },
] as const;

type Surface = (typeof SURFACES)[number];
export type Footing = `${Surface["key"]}-${"dry" | "wet"}`;

/** A footing's surface, whether it's wet, and its friction coefficient. */
export function footingFor(f: Footing): {
    surface: Surface;
    wet: boolean;
    grip: number;
    label: string;
} {
    const wet = f.endsWith("-wet");
    const surface = SURFACES.find((s) => `${s.key}-${wet ? "wet" : "dry"}` === f)!;
    return {
        surface,
        wet,
        grip: wet ? surface.wet : surface.dry,
        label: `${wet ? "wet" : "dry"} ${surface.label.toLowerCase()}`,
    };
}

/**
 * What the ropes might run over at the wall's edge, each with the friction coefficient between it and a nylon
 * rescue rope. Like the footings', these are rough, middle-of-the-range figures.
 */
export const EDGES = [
    { key: "frictionless", label: "Frictionless (ideal)", friction: 0 },
    { key: "roller", label: "Edge roller", friction: 0.03 },
    { key: "steel", label: "Painted steel container rail", friction: 0.2 },
    { key: "rusty-steel", label: "Rusty steel edge", friction: 0.35 },
    { key: "protector", label: "Edge protector", friction: 0.3 },
    { key: "timber", label: "Timber", friction: 0.35 },
    { key: "concrete", label: "Concrete or rock", friction: 0.55 },
] as const;

export type Edge = (typeof EDGES)[number]["key"];

export const edgeFor = (e: Edge) => EDGES.find((x) => x.key === e)!;
