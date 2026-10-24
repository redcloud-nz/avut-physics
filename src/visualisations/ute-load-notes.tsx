import { NotesCard, Part } from "@/components/notes";

import {
    BALL_PAST_BUMPER,
    BULLBAR_DEPTH,
    CAB,
    DIESEL,
    NEAR,
    TAILGATE,
    TARE_FUEL,
} from "./ute-load-solver";
import { FITOUTS, UTES, type Ute } from "./ute-load-vehicles";

/** The ute with the least room on its front axle when empty, by the assumed share. */
const TIGHTEST = UTES.reduce((a, b) =>
    b.frontAxle - b.tare * b.unladenFrontShare < a.frontAxle - a.tare * a.unladenFrontShare ? b : a,
);

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
        <NotesCard>
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
                    Every position is measured back from the centre of the front axle. Each ute’s
                    wheelbase, overhangs and tub length come from its figures below. Everything else
                    sits at the same place in every ute, because dual cabs are laid out much alike.
                    These positions are estimates from a typical dual cab’s layout, not
                    measurements, and are good to perhaps 0.2 m. Moving 100 kg by 0.2 m shifts about
                    6 kg from one axle to the other.
                </p>
                <ul className="flex list-disc flex-col gap-1.5 pl-5">
                    <li>
                        Crew: the first two sit in the front seats, at {CAB.frontSeat} m, and the
                        rest in the back seats, at {CAB.rearSeat} m, roughly where a seated person’s
                        hips are. Each weighs 100 kg to start with, counting PPE and personal gear.
                    </li>
                    <li>
                        Bullbar, winch, recovery points, spotlights and snorkel: together,{" "}
                        {BULLBAR_DEPTH} m behind the front bumper. The snorkel really sits further
                        back, but it’s light.
                    </li>
                    <li>Bash plates: at {CAB.underbody} m, under the engine.</li>
                    <li>
                        Light bar, radios, sirens and aerials: together at {CAB.roof} m, about over
                        the front seats.
                    </li>
                    <li>
                        The tub: its floor ends {TAILGATE} m in from the rear bumper and runs
                        forward for the tub’s length. The canopy and drawers sit at its middle, as
                        if spread evenly along it. Cargo sits at one point along it, set by “Cargo’s
                        position”, from the tub’s front wall (0%) to the tailgate (100%).
                    </li>
                    <li>
                        Fuel: the tank sits at {CAB.fuelTank} m, between the axles behind the cab.
                        The tare already counts {TARE_FUEL} L, so the “Fuel” setting adds the rest,
                        as diesel at {DIESEL} kg/L. Below {TARE_FUEL} L it takes a little off.
                    </li>
                    <li>
                        The tow ball: {BALL_PAST_BUMPER} m past the rear bumper. Tow bars vary, and
                        one that reaches further back puts more on the rear axle and takes more off
                        the front.
                    </li>
                </ul>
            </Part>

            <Part title="The “Rescue” fit-out">
                <p>
                    This is an itemised estimate for one emergency-service ute, taking the middle of
                    each item’s likely range:
                </p>
                <ul className="flex list-disc flex-col gap-1.5 pl-5">
                    <li>
                        Front, {FITOUTS.rescue.front} kg: a steel bullbar (55–65 kg, from the
                        maker’s weight less the factory bumper it replaces), a winch (30–35 kg),
                        recovery points (4–8 kg), spotlights (2–5 kg) and a snorkel (3–5 kg).
                    </li>
                    <li>
                        Cab and roof, {FITOUTS.rescue.cab} kg: a full-size light bar (10–20 kg),
                        radios (5–10 kg), sirens (2–4 kg) and aerials (2–4 kg).
                    </li>
                    <li>
                        Tub, {FITOUTS.rescue.tub} kg: a fibreglass canopy (90–130 kg) and a twin
                        drawer system (107–118 kg, from the maker’s weights).
                    </li>
                    <li>Underbody, {FITOUTS.rescue.underbody} kg: bash plates (25–40 kg).</li>
                </ul>
                <p>
                    All told, that’s 335 to 444 kg; the middle figure is{" "}
                    {Object.values(FITOUTS.rescue).reduce((a, b) => a + b, 0)} kg. A different
                    canopy, drawers or bullbar can easily change it by 100 kg.
                </p>
            </Part>

            <Part title="Where the figures come from">
                <p>
                    The ratings, masses and dimensions come from spec listings by CarExpert and
                    carsales (Redbook), linked below for each ute. Most are for Australian models.
                    Where New Zealand figures were also found, they matched. The makers’ own spec
                    sheets mostly couldn’t be found online. Some figures had to be worked out or
                    assumed:
                </p>
                <ul className="flex list-disc flex-col gap-1.5 pl-5">
                    <li>
                        How the empty ute’s weight splits between its axles. No maker publishes
                        this, and no weighbridge readings were found. Every diesel ute here assumes
                        58% on the front, a typical share for a front-engined dual cab rather than a
                        measurement of any of them. The Shark 6 assumes 55%, as its battery sits
                        under the floor. Each percentage point moves about 21 kg between the axles
                        of a 2.1 tonne ute, so this matters most for the front axle. It matters most
                        of all for the {TIGHTEST.label}, with the least room on its front axle: at{" "}
                        {Math.round(TIGHTEST.unladenFrontShare * 100)}% it carries{" "}
                        {Math.round(TIGHTEST.tare * TIGHTEST.unladenFrontShare)} kg of its{" "}
                        {TIGHTEST.frontAxle} kg rating empty, so whether a fit-out overloads it
                        rests on that guess. It can be changed under “More settings”.
                    </li>
                    <li>
                        Tare, where only the kerb mass (with a full tank) was published: the kerb
                        mass less the fuel above {TARE_FUEL} L, at {DIESEL} kg/L.
                    </li>
                    <li>
                        Axle ratings. The listings call these “axle weights”. For most utes the
                        front and rear figures add up to well over the GVM, as ratings do. The Shark
                        6’s add up to exactly its GVM, so they may be a split of the GVM rather than
                        ratings.
                    </li>
                    <li>
                        Tow ball limits, where none was published: a tenth of the braked towing
                        capacity.
                    </li>
                    <li>
                        Tub lengths and overhangs, where only some were published: worked out from
                        the overall length, or taken from similar utes.
                    </li>
                </ul>
            </Part>

            <Part title="Assumptions and shortcuts">
                <ul className="flex list-disc flex-col gap-1.5 pl-5">
                    <li>
                        It’s static: the ute standing still on level ground. Braking, cornering and
                        slopes all move weight between the axles.
                    </li>
                    <li>
                        Ratings change between variants, years and markets, and a GVM upgrade or a
                        different tow bar changes them again. The plate on the vehicle is the
                        authority. A weighbridge that weighs each axle gives the real loads.
                    </li>
                    <li>Tyres and wheels have load ratings of their own, not checked here.</li>
                    <li>
                        Nothing is off to one side. Real loads rarely sit on the centreline, which
                        loads one wheel more than the other.
                    </li>
                    <li>
                        A bar turns amber from {NEAR * 100}% of its rating, and red past it.
                        “Heaviest trailer at full GVM” is the GCM less the GVM, but no more than the
                        braked towing capacity.
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
                                <tr key={f.key} className="border-b border-border">
                                    <td className="py-1 pr-4">{f.label}</td>
                                    <td className="py-1 font-mono text-ink-soft">
                                        {f.format(u)}
                                        {u.estimated.includes(f.key) && (
                                            <span className="text-warning/80"> est.</span>
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
                            <a href={s.url} className="text-link hover:text-highlight">
                                {s.label}
                            </a>
                        </li>
                    ))}
                </ul>
            </Part>
        </NotesCard>
    );
}
