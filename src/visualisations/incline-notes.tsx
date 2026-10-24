import { NotesCard, Part } from "@/components/notes";

/** How the incline page works out what it shows, and what it leaves out. */
export function InclineNotes() {
    return (
        <NotesCard>
            <Part title="The forces">
                <p>
                    The block’s weight, W = mg, pulls straight down. Split along the slope and
                    square to it, W sin θ pulls it down the slope and W cos θ presses it into the
                    slope. The slope pushes back square to itself with N = W cos θ, so nothing moves
                    into or out of the slope.
                </p>
            </Part>
            <Part title="Held or sliding">
                <p>
                    Static friction holds the block with whatever it needs, up to μs N. While W sin
                    θ is no more than that, the block stays put and friction matches W sin θ
                    exactly. That holds up to the angle whose tangent is μs: the “Slips above”
                    readout.
                </p>
                <p>
                    Steeper, the block slides, and kinetic friction pulls back with μk N. What’s
                    left over, W sin θ − μk N, speeds it up at that divided by m. A sliding block
                    never grips harder than a still one, so μk is taken as no more than μs.
                </p>
            </Part>
            <Part title="Assumptions and shortcuts">
                <ul className="flex list-disc flex-col gap-1.5 pl-5">
                    <li>
                        The block is a point at its centre: it slides but never tips over, however
                        tall it is.
                    </li>
                    <li>
                        Friction coefficients are fixed numbers, the same at any speed and any load,
                        and there’s no air resistance.
                    </li>
                    <li>
                        The block starts from rest. One already sliding would keep sliding on a
                        slope a little less steep than “Slips above”, down to the angle whose
                        tangent is μk, as kinetic friction alone can’t stop it there.
                    </li>
                </ul>
            </Part>
        </NotesCard>
    );
}
