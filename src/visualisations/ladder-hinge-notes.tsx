import { HOLD_HEIGHT } from "./ladder-hinge-held";

/** How the ladder hinge page works out what it shows, and what it leaves out. */
export function LadderHingeNotes() {
    return (
        <section className="flex flex-col gap-4 rounded-xl border border-border bg-surface/50 p-4 text-sm leading-relaxed text-ink-muted lg:p-6">
            <h2 className="text-base font-medium text-ink">How this is calculated</h2>

            <Part title="The setup">
                <p>
                    Everything is in two dimensions, seen side on. The ladder’s foot sits in the
                    corner between the ground and the wall, and the ladder pivots there. It can lean
                    back no further than resting against the wall’s top edge. The stretcher is a
                    rigid 2 m bar. Its weight acts at its middle. The rope runs from an anchor above
                    and behind the wall to one end of the stretcher, passing over the wall’s top
                    edge when it has to. A short attachment ties the stretcher’s other end to a
                    point on the ladder. The ladder (10 cm) and stretcher (8 cm) have a thickness
                    only where they touch each other.
                </p>
            </Part>

            <Part title="Where everything settles">
                <p>
                    With the ladder left to find its own angle, everything settles where its
                    potential energy is lowest. The rope and attachment can’t stretch but can go
                    slack. The ground, the wall and the ladder can’t be passed through. The page
                    searches a coarse grid of positions and refines the best ones. It then checks
                    each candidate really balances: ropes only pull, surfaces only push, and every
                    force and torque cancels.
                </p>
                <p>
                    When the stretcher would cross the ladder, it rests on it instead, with its end
                    held against the ladder by the attachment. If the attachment would have to push
                    to hold it there, the end slides along the ladder until it doesn’t.
                </p>
            </Part>

            <Part title="Forces">
                <p>
                    Once the position is known, balancing the forces and torques on the stretcher
                    gives the rope’s and the attachment’s pull (T₁ and T₂) and the push of whatever
                    it rests on (N). Balancing the ladder then gives the force on its foot (R). The
                    foot isn’t fixed: the ground can push it up and the wall can push it out, but
                    nothing holds it down, and only the ground’s grip (a friction coefficient of
                    0.5, for rubber feet) stops it sliding away from the wall. Where the balance
                    would need more, the page warns that the foot would lift or slide.
                </p>
            </Part>

            <Part title="The ground team">
                <p>
                    With the ladder angle set to “Underrun”, a ground team holds the ladder at
                    whichever angle keeps the stretcher level. Level, resting on the ladder with the
                    attachment taut, the stretcher’s position follows from the ladder’s angle alone,
                    so the rope’s length fixes the angle. The team takes hold once that angle is
                    below “Team Underruns below” in More settings (at most 60°); until then the
                    ladder finds its own angle, as with “Auto”. They take hold where the ladder has
                    settled by itself, then bring it round to level over the next 7.5°, holding it
                    part of the way between the two angles. Where the stretcher can’t be held level
                    (still up by the wall top), the page says why and shows it settled at the angle
                    that would have levelled it. Once the ladder is down and the rope slack, the
                    stretcher stays where it landed.
                </p>
                <p>
                    The team is assumed to push straight up (or pull straight down) at shoulder
                    height, {HOLD_HEIGHT} m up, or at the ladder’s tip if that’s lower, supplying
                    whatever torque the ladder needs to stay at its angle. Where and how they hold
                    it changes only how hard they push and the force on the foot, not the
                    stretcher’s position. Steeper than 60° their grip is almost directly above the
                    foot, so a vertical push barely turns the ladder and would lift its foot or drag
                    it out first.
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
                        Apart from the ladder’s foot on the ground, there’s no friction anywhere: at
                        the foot’s pivot, over the wall’s edge, or where the stretcher touches the
                        ladder, ground or wall.
                    </li>
                    <li>
                        The rope and attachment are weightless and don’t stretch. The ladder and
                        stretcher are rigid and uniform, so the patient’s weight is treated as
                        spread evenly along the stretcher.
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
                        Where the ground team holds the ladder is a guess, and it sets the size of
                        their force.
                    </li>
                    <li>
                        Known rough edges: a couple of rare settings where the ladder’s torques
                        don’t quite balance, a flicker between arrangements at a few rope lengths,
                        and some settings that take tens of milliseconds to work out.
                    </li>
                </ul>
            </Part>
        </section>
    );
}

/** One titled part of a notes card. */
export function Part(props: { title: string; children: React.ReactNode }) {
    return (
        <div className="flex flex-col gap-2">
            <h3 className="font-medium text-ink-soft">{props.title}</h3>
            {props.children}
        </div>
    );
}
