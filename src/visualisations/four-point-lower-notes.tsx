import { Part } from "./ladder-hinge-notes";

/** How the four-point lower page works out what it shows, and what it leaves out. */
export function FourPointLowerNotes() {
    return (
        <section className="flex flex-col gap-4 rounded-xl border border-slate-800 bg-slate-900/50 p-4 text-sm leading-relaxed text-slate-400 lg:p-6">
            <h2 className="text-base font-medium text-slate-200">How this is calculated</h2>

            <Part title="The setup">
                <p>
                    A basket stretcher, 2 m long, 0.6 m wide and 0.2 m deep (about a Ferno Model
                    71), is lowered down a long slot, such as a hole in a floor or a gap between two
                    walls. Four ropes hold it, one from each corner of its top rail. Each runs to
                    its own belay on the floor beside the slot, over the slot’s edge when it has to.
                    The belays stand at the corners of a rectangle: a head belay and a foot belay on
                    each side, “Head to foot belays” apart along the slot, each “Belay setback from
                    the edge” back from it and “Belay height” above the floor.
                </p>
                <p>
                    The belays are drawn as fixed points, as if each rope were tied off or run round
                    a hard belay. In practice a four-point lower is usually done with body belays.
                    The ropes’ pulls shown here are what each belayer would have to hold.
                </p>
            </Part>

            <Part title="The lower">
                <p>
                    The stretcher starts lying on the floor along the slot, 10 cm back from its
                    edge, with every rope just snug. Each belayer has a slider, in their rope’s
                    colour: how much rope they’ve paid out since the start, or taken in (below
                    zero). The sliders are laid out like the belays, head on top and near side on
                    the left. “Start again” puts the stretcher back on the floor; changing the setup
                    does too.
                </p>
                <p>
                    Between each pair of neighbouring sliders is a link. Click it once to couple the
                    two belayers, so moving either slider pays out or takes in the same on both;
                    again to couple them the other way round, so one takes in as the other pays out;
                    and again to uncouple them. Couplings carry on along links, so coupling the near
                    side, the far side and the head pair moves all four. With those three coupled,
                    the fourth link has to agree with them, so it only couples one way: the way they
                    already move the foot pair. “All” couples all four, moving together.
                </p>
                <p>
                    Where the stretcher can’t settle any further, the belayers stop at the last
                    point where it did. Taking in against each other soon lifts it off the floor
                    between them, until the ropes are as tight as they’ll go.
                </p>
                <p>
                    One way through: couple the near side, the far side, and the head pair the other
                    way round, so the far side takes in as the near side pays out, and the stretcher
                    is drawn across the floor to the edge. Then uncouple the head pair and let the
                    feet out over the slot, then the head. Once it’s across, couple all four the
                    same way and lower.
                </p>
            </Part>

            <Part title="Where the stretcher settles">
                <p>
                    The stretcher is free to move and turn every way. It settles where its weight
                    sits lowest, as far as the ropes reach and the floor, the slot’s edges, sides
                    and bottom let it. Each rope takes the shortest path from its belay to its
                    corner: over the slot’s edge, that’s the path that would be a straight line if
                    the floor and the slot’s side were folded out flat.
                </p>
                <p>
                    The floor has no friction, so on its own nothing would keep the stretcher where
                    it is on the floor. Instead each belayer keeps a light pull on their rope, 5% of
                    the stretcher’s weight, taking up any slack. Those pulls hold it against the
                    ropes’ lengths.
                </p>
                <p>
                    Each move is worked out a couple of centimetres of rope at a time, each step
                    starting from where the last one settled. So where the stretcher could rest in
                    more than one place, it stays in the one it got to first, and where it ends up
                    depends on the order the belayers moved in, not just how much rope each has out.
                    The graph below the drawings traces the ropes’ pulls over every step of the
                    moves so far.
                </p>
            </Part>

            <Part title="Forces">
                <p>
                    Each rope pulls its corner along its last straight run, towards the slot’s edge
                    or its belay. The floor, the slot’s edge and its bottom push square to
                    themselves (and, along an edge, square to the basket’s edge resting on it).
                    Together with the stretcher’s weight, these pulls and pushes balance, and so do
                    their turning effects. Where a stretcher on the floor could share its weight
                    between the ropes and the floor in many ways, the ropes are taken as just snug
                    and the floor as carrying the rest, as evenly as balance allows.
                </p>
                <p>
                    While the stretcher rests on the floor and the edge, the ropes stay light. Once
                    its weight is past the edge, it hangs from the ropes. Hanging level near the
                    floor’s level is the hardest part of the lower: the ropes then run from its top
                    rail, 20 cm above the floor, up to the belays, so only a small part of each pull
                    lifts. How hard they pull then depends mostly on the belays: with belays at
                    waist height (about 1 m) and 2 m back, each rope holds about four-fifths of the
                    stretcher’s weight, but with belays 0.5 m up, about twice the weight. Belays
                    higher or nearer the edge make the ropes steeper and the pulls smaller. Once the
                    stretcher is down 30 cm or more, the ropes come over the edges steeply, and
                    their pulls fall towards a quarter of the weight each.
                </p>
            </Part>

            <Part title="Assumptions and shortcuts">
                <ul className="flex list-disc flex-col gap-1.5 pl-5">
                    <li>
                        It’s static: each picture is where the stretcher would come to rest with
                        that much rope out. There’s no swinging, sliding or speed of lowering.
                    </li>
                    <li>
                        The belayers pay out and take in exactly as the sliders say. With four
                        ropes, uneven paying out shifts the load: in the worst case two diagonally
                        opposite ropes can end up holding almost all of it.
                    </li>
                    <li>
                        Nothing has friction: not the floor, the slot’s edges or sides. A real
                        stretcher grips the floor somewhat, so it would stay put more easily than
                        here.
                    </li>
                    <li>
                        The ropes are weightless and don’t stretch. The stretcher is a rigid box,
                        each rope tied at a corner of its top rail, with its weight at its middle,
                        halfway up. A real basket tapers and has rounded ends. The slot’s edges are
                        sharp corners.
                    </li>
                    <li>
                        With the stretcher lying across the slot’s edge, letting its feet down tips
                        it sideways about the edge more than end to end, since the edge runs nearly
                        along it.
                    </li>
                    <li>
                        Where a corner sits right on the slot’s edge, the page sometimes settles for
                        a position that balances to within a ten-thousandth of the stretcher’s
                        weight. Very rarely, it can’t find one at all, and says so.
                    </li>
                </ul>
            </Part>
        </section>
    );
}
