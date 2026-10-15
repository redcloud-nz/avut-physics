import { Part } from "./ladder-hinge-notes";
import { CAB, DIESEL, TARE_FUEL } from "./ute-load-solver";
import type { Ute } from "./ute-load-vehicles";

const FIGURES: { key: keyof Ute; label: string; format: (u: Ute) => string }[] = [
    { key: "tare", label: "Tare", format: (u) => `${u.tare} kg` },
    { key: "gvm", label: "GVM", format: (u) => `${u.gvm} kg` },
    { key: "gcm", label: "GCM", format: (u) => `${u.gcm} kg` },
    { key: "frontAxle", label: "Front axle rating", format: (u) => `${u.frontAxle} kg` },
    { key: "rearAxle", label: "Rear axle rating", format: (u) => `${u.rearAxle} kg` },
    { key: "towing", label: "Braked towing", format: (u) => `${u.towing} kg` },
    { key: "towBall", label: "Tow ball", format: (u) => `${u.towBall} kg` },
    {
        key: "unladenFrontShare",
        label: "Empty, on front axle",
        format: (u) => `${Math.round(u.unladenFrontShare * 100)}%`,
    },
    { key: "wheelbase", label: "Wheelbase", format: (u) => `${u.wheelbase.toFixed(3)} m` },
    {
        key: "frontOverhang",
        label: "Front overhang",
        format: (u) => `${u.frontOverhang.toFixed(3)} m`,
    },
    {
        key: "rearOverhang",
        label: "Rear overhang",
        format: (u) => `${u.rearOverhang.toFixed(3)} m`,
    },
    { key: "tubLength", label: "Tub floor", format: (u) => `${u.tubLength.toFixed(3)} m` },
    { key: "fuelTank", label: "Fuel tank", format: (u) => `${u.fuelTank} L` },
];

/** How the ute load page works out what it shows, and where its figures come from. */
export function UteLoadNotes(props: { ute: Ute }) {
    const u = props.ute;
    return (
        <section className="flex flex-col gap-4 rounded-xl border border-slate-800 bg-slate-900/50 p-4 text-sm leading-relaxed text-slate-400 lg:p-6">
            <h2 className="text-base font-medium text-slate-200">How this is calculated</h2>

            <Part title="The ratings">
                <p>
                    Every ute has a set of mass limits on its compliance plate. The gross vehicle
                    mass (GVM) is the most the ute may weigh, loaded. Each axle has its own rating
                    too, and the two add up to more than the GVM, so each axle can take some extra
                    load but not all of it. The gross combination mass (GCM) is the most the ute and
                    its trailer may weigh together, and the braked towing capacity is the heaviest
                    trailer it may pull. The tow ball has a limit of its own. The weight a trailer
                    puts on the tow ball counts against the ute’s GVM, not the trailer’s.
                </p>
                <p>
                    The tare is the empty ute with only about {TARE_FUEL} L of fuel. Everything
                    else, the rest of the fuel, crew, fit-out and cargo, comes out of the difference
                    between tare and GVM, the payload. A brochure’s payload is for a bare ute,
                    before any fit-out.
                </p>
            </Part>

            <Part title="Sharing the weight between the axles">
                <p>
                    Seen side on, the ute is a beam resting on its two axles. Each load presses on
                    both, in proportion to how close it is to each: a load halfway between them puts
                    half its weight on each, and a load over an axle puts all of it on that axle.
                    Taking moments about the front axle gives the rear axle’s share of each load;
                    the front carries the rest.
                </p>
                <p>
                    A load behind the rear axle is like a weight on the end of a see-saw. It puts
                    more than its own weight on the rear axle, and lifts the difference off the
                    front. A tow ball 1.4 m behind a 3.1 m wheelbase puts about 1.45 times its
                    download on the rear axle. That takes weight off the front wheels, which do the
                    steering and much of the braking, and in 4WD it takes grip from the front
                    wheels. In a dual cab, much of the tub is behind the rear axle too, so a canopy,
                    drawers and heavy cargo near the tailgate work the same way.
                </p>
            </Part>

            <Part title="Where the loads sit">
                <p>
                    Cabs are much alike, so every ute here uses the same positions, measured back
                    from the front axle: the front seats at {CAB.frontSeat} m, the rear seats at{" "}
                    {CAB.rearSeat} m, the roof light bar, radios and sirens at {CAB.roof} m, bash
                    plates at {CAB.underbody} m and the fuel tank at {CAB.fuelTank} m. The first two
                    crew sit in the front. Bullbar and winch sit just behind the front bumper. The
                    canopy and drawers sit at the middle of the tub, and the tub and tow ball come
                    from each ute’s overhangs and tub length. These positions are estimates, good to
                    perhaps 0.2 m.
                </p>
                <p>
                    The “Rescue” fit-out is a typical emergency-service ute: a steel bullbar and
                    winch with recovery points, spotlights and a snorkel (105 kg); a roof light bar,
                    radios, sirens and aerials (28 kg); a fibreglass canopy and twin drawer system
                    (222 kg); and bash plates (32 kg). Fuel is diesel at {DIESEL} kg/L.
                </p>
            </Part>

            <Part title="Assumptions and shortcuts">
                <ul className="flex list-disc flex-col gap-1.5 pl-5">
                    <li>
                        It’s static: the ute standing still on level ground. Braking, cornering and
                        slopes all move weight between the axles.
                    </li>
                    <li>
                        The makers don’t publish how an empty ute’s weight splits between its axles.
                        Where no weighbridge figure was found, the split is an estimate, and it can
                        be changed under “More settings”. A weighbridge that weighs each axle gives
                        the real figure.
                    </li>
                    <li>
                        Ratings change between variants, years and markets, and a GVM upgrade or a
                        different tow bar changes them again. The plate on the vehicle is the
                        authority.
                    </li>
                    <li>Tyres and wheels have load ratings of their own, not checked here.</li>
                    <li>
                        Nothing is off to one side. Real loads rarely sit on the centreline, which
                        loads one wheel more than the other.
                    </li>
                </ul>
            </Part>

            <Part title={`Figures for the ${u.label}`}>
                <p>
                    {u.variant}. Figures marked “est.” aren’t published and are worked out or
                    assumed.
                </p>
                <div className="overflow-x-auto">
                    <table className="w-full max-w-md text-left">
                        <tbody>
                            {FIGURES.map((f) => (
                                <tr key={f.key} className="border-b border-slate-800">
                                    <td className="py-1 pr-4">{f.label}</td>
                                    <td className="py-1 font-mono text-slate-300">
                                        {f.format(u)}
                                        {u.estimated.includes(f.key) && (
                                            <span className="text-amber-400/80"> est.</span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <ul className="flex list-disc flex-col gap-1 pl-5">
                    {u.sources.map((s) => (
                        <li key={s.url}>
                            <a href={s.url} className="text-sky-400 hover:text-sky-300">
                                {s.label}
                            </a>
                        </li>
                    ))}
                </ul>
            </Part>
        </section>
    );
}
