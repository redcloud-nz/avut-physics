import { Part } from "./ladder-hinge-notes";

/** How the four-point lower page works out what it shows, and what it leaves out. */
export function FourPointLowerNotes() {
    return (
        <section className="flex flex-col gap-4 rounded-xl border border-slate-800 bg-slate-900/50 p-4 text-sm leading-relaxed text-slate-400 lg:p-6">
            <h2 className="text-base font-medium text-slate-200">How this is calculated</h2>

            <Part title="The setup">
                <p>
                    A stretcher 2 m long and 0.6 m wide is lowered level down a long slot, such as a
                    hole in a floor or a gap between two walls. Four ropes hold it, one from each
                    corner. Each runs up to its own belay on the floor beside the slot, passing over
                    the slot’s edge when it has to. The belays stand at the corners of a rectangle:
                    a head belay and a foot belay on each side, “Head to foot belays” apart along
                    the slot, each “Belay setback from the edge” back from it and “Belay height”
                    above the floor. The stretcher hangs centred in that rectangle.
                </p>
                <p>
                    The belays are drawn as fixed points, as if each rope were tied off or run round
                    a hard belay. In practice a four-point lower is usually done with body belays.
                    The ropes’ pulls shown here are what each belayer would have to hold.
                </p>
            </Part>

            <Part title="Where everything settles">
                <p>
                    Everything is symmetric, end to end and side to side, so the four ropes carry
                    the same tension and the stretcher stays level. It settles as low as its ropes
                    let it, where its potential energy is lowest, or on the slot’s bottom once they
                    are long enough. Each rope takes the shortest path from its belay to its corner.
                    Over the slot’s edge, that’s the path that would be a straight line if the floor
                    and the slot’s side were folded out flat.
                </p>
            </Part>

            <Part title="Forces">
                <p>
                    Each rope pulls its corner along its last straight run, towards the slot’s edge
                    or its belay. Only the upward part of each pull holds the stretcher up, so the
                    four upward parts together equal its weight. The rope’s tension is a quarter of
                    the weight, made larger the further the rope leans from vertical. A two-point
                    lower’s rope holds about half the weight, so each rope here holds about half as
                    much.
                </p>
                <p>
                    The rest of each pull is sideways. Across the slot, the ropes pull each end of
                    the stretcher apart towards the slot’s edges. Along the slot, the belays are at
                    least as far apart as the stretcher is long, so the ropes pull its ends apart
                    too. These sideways pulls cancel each other out, so they don’t move the
                    stretcher, but its frame has to carry them. Where a rope wraps over the slot’s
                    edge, it presses on the edge with its tension pulling both ways round it. That’s
                    “Rope on slot’s edge”.
                </p>
            </Part>

            <Part title="Assumptions and shortcuts">
                <ul className="flex list-disc flex-col gap-1.5 pl-5">
                    <li>
                        It’s static: each picture is where the stretcher would come to rest at that
                        rope length. There’s no swinging and no speed of lowering.
                    </li>
                    <li>
                        All four ropes are paid out exactly together, so the stretcher stays level
                        and centred. With four ropes, real belayers paying out unevenly shift the
                        load: in the worst case, two diagonally opposite ropes can end up holding
                        almost all of it.
                    </li>
                    <li>There’s no friction over the slot’s edges. The edges are sharp corners.</li>
                    <li>
                        The ropes are weightless and don’t stretch. The stretcher is rigid and
                        uniform, with each rope tied right at a corner.
                    </li>
                    <li>
                        The stretcher never touches the slot’s sides. It’s narrower than the slot
                        and stays centred.
                    </li>
                </ul>
            </Part>
        </section>
    );
}
