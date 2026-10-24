import { NotesCard, Part } from "@/components/notes";

import { TEAM_HEIGHT, TEAM_REACH } from "./two-point-lower-solver";

/** How the two-point lower page works out what it shows, and what it leaves out. */
export function TwoPointLowerNotes() {
    return (
        <NotesCard>
            <Part title="The setup">
                <p>
                    Everything is in two dimensions, seen side on. The stretcher is a rigid 2 m bar.
                    Its weight acts at its middle. The rope runs from an anchor above and behind the
                    wall to one end of the stretcher, passing over the wall’s top edge when it has
                    to, just as on the ladder hinge page. A line runs from the stretcher’s other end
                    to a ground team standing out in front of the wall. They pull it with a steady
                    force, the “Ground team’s pull”, however far the line has to run, as if paying
                    it out or hauling it in to keep that pull. The team pulls from {TEAM_HEIGHT} m
                    above the ground, at “Ground team’s distance” from the wall’s face.
                </p>
            </Part>

            <Part title="Where everything settles">
                <p>
                    The stretcher settles where its potential energy is lowest. The energy includes
                    its weight’s height and the team’s pull: a steady pull acts like a weight hung
                    over a pulley at the team, so the energy rises with the line’s length times the
                    pull. The rope can’t stretch but can go slack. The ground and the wall can’t be
                    passed through. The page searches a spread of positions and refines the best
                    few, including some with an end caught on the wall’s corner. It then checks each
                    really balances, ropes only pulling and surfaces only pushing, and keeps the one
                    with the least energy.
                </p>
                <p>
                    Sometimes two resting places have almost the same energy. For example, the
                    stretcher lying across the wall top, overhanging the edge, or tipped over the
                    edge. There the picture jumps as the rope pays out, much as a real stretcher
                    would tip over.
                </p>
            </Part>

            <Part title="The ground team">
                <p>
                    Once the stretcher’s end comes within {TEAM_REACH} m of the team’s hands, they
                    stop hauling and hold it there, easing off as much as they need to, down to
                    letting the line hang slack. The rope only pays out until the stretcher lies on
                    the ground {TEAM_REACH} m short of the team. On frictionless ground, paying out
                    more would only let them drag it in.
                </p>
            </Part>

            <Part title="Forces">
                <p>
                    Once the position is known, balancing the forces and torques on the stretcher
                    gives the rope’s pull (T₁). It also gives the push of whatever it rests on (N):
                    the ground, the wall’s face, its top or its edge. The line’s pull (T₂) is the
                    team’s, along the line’s last straight run. Where the rope wraps over the wall’s
                    edge, it presses on the edge with its tension pulling both ways round it. That’s
                    “Rope on wall’s edge”.
                </p>
            </Part>

            <Part title="Assumptions and shortcuts">
                <ul className="flex list-disc flex-col gap-1.5 pl-5">
                    <li>
                        It’s static: each picture is where things would come to rest at that rope
                        length. There’s no swinging, no speed of lowering, and no history. The
                        lowest-energy position is shown, which isn’t always the one a real lower
                        would reach.
                    </li>
                    <li>
                        There’s no friction anywhere: over the wall’s edge, or where the stretcher
                        touches the ground or the wall.
                    </li>
                    <li>
                        The rope and line are weightless and don’t stretch. The stretcher is rigid
                        and uniform, so the patient’s weight is treated as spread evenly along it.
                    </li>
                    <li>
                        The wall’s top edge is a sharp corner, and the stretcher touches the ground
                        and wall at its centreline.
                    </li>
                    <li>Nothing sways sideways or twists.</li>
                    <li>
                        The rope’s length is set exactly, as if paid out through a belay that holds
                        it precisely.
                    </li>
                    <li>
                        The team’s pull is perfectly steady, from a fixed point {TEAM_HEIGHT} m up.
                        A real team moves, and a real pull varies.
                    </li>
                </ul>
            </Part>
        </NotesCard>
    );
}
