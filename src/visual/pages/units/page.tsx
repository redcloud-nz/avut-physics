import { Eq } from "@/components/tex";
import { r, Section } from "@/visual/common/details";
import type { VisualPage } from "@/visual/pages";

import { UnitsFigure } from "./figure";

/** The prefixes in everyday use, biggest first, with what each multiplies by. */
const PREFIXES = [
    { name: "giga", symbol: "G", times: "1 000 000 000", like: "GW, a power station" },
    { name: "mega", symbol: "M", times: "1 000 000", like: "MB, a photo" },
    { name: "kilo", symbol: "k", times: "1000", like: "kN, km, kg" },
    { name: "", symbol: "", times: "1", like: "N, m, g" },
    { name: "centi", symbol: "c", times: "a hundredth", like: "cm" },
    { name: "milli", symbol: "m", times: "a thousandth", like: "mm, mL" },
    { name: "micro", symbol: "µ", times: "a millionth", like: "µm, a hair is about 70 µm" },
];

function UnitsMore() {
    return (
        <>
            <Section title="The prefixes">
                <p>
                    The same prefixes go on any unit. Most go up or down in steps of a thousand;
                    centi, a hundredth, is the odd one out, and mostly turns up in centimetres.
                </p>
                <div className="panel-scroll overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="text-ink-muted">
                            <tr>
                                <th className="py-1 pr-3 font-medium">Prefix</th>
                                <th className="py-1 pr-3 font-medium">Times</th>
                                <th className="py-1 font-medium">For example</th>
                            </tr>
                        </thead>
                        <tbody>
                            {PREFIXES.map((p) => (
                                <tr key={p.times} className="border-t border-border">
                                    <td className="py-1 pr-3 whitespace-nowrap">
                                        {p.name ? (
                                            <>
                                                {p.name} ({p.symbol})
                                            </>
                                        ) : (
                                            <span className="text-ghost">none</span>
                                        )}
                                    </td>
                                    <td className="py-1 pr-3 whitespace-nowrap tabular-nums">
                                        {p.times}
                                    </td>
                                    <td className="py-1">{p.like}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <p>
                    Capitals matter: M is mega, a million, and m is milli, a thousandth. A megametre
                    and a millimetre are a billion times apart.
                </p>
            </Section>
            <Section title="Not every one gets used">
                <p>
                    Some combinations work but nobody says them. A megagram (Mg) is a tonne, so we
                    say tonne, and a gigagram (Gg) is a thousand tonnes. Megametres (Mm) and
                    gigametres (Gm) are too big for anything on Earth: kilometres do.
                </p>
            </Section>
            <Section title="The kilogram, not the gram">
                <p>
                    Mass is the odd one: the prefixes go on the gram, but the kilogram is the unit
                    everything else is built on. A newton is the force that speeds a kilogram up by
                    1 m/s², and a litre of water has a mass of a kilogram:
                </p>
                <Eq tex={r`1\,\text{N} = 1\,\text{kg} \times 1\,\text{m/s}^2`} />
                <Eq
                    tex={r`1\,\text{L of water} = 1\,\text{kg} \qquad 1\,\text{m}^3\text{ of water} = 1\,\text{t}`}
                />
                <p>
                    So when you work things out, use kilograms, metres, seconds and newtons, and put
                    the answer into whatever prefix reads best at the end.
                </p>
            </Section>
        </>
    );
}

const page: VisualPage = {
    slug: "units",
    name: "Units",
    title: "Prefixes count in thousands",
    text: "Rather than lots of zeros, big and small amounts get a prefix on their unit. A kilonewton (kN) is 1000 newtons, and a millimetre (mm) is a thousandth of a metre.",
    Figure: UnitsFigure,
    More: UnitsMore,
};

export default page;
