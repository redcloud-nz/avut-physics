import { NotesCard, Part } from "@/components/notes";

import { SLING_STIFFNESS } from "./multi-point-anchor-solver";

/** How the multi-point anchor page works out what it shows, and what it leaves out. */
export function MultiPointAnchorNotes() {
    return (
        <NotesCard>
            <Part title="The setup">
                <p>
                    Everything is in two dimensions, seen face on: the anchors are points on a rock
                    face (or a wall, or a beam), and the load hangs from a master point below them.
                    There are two or three anchors, A, B and C from left to right, set apart and
                    raised or lowered relative to A under “More settings”. Two anchors start 1.2 m
                    apart with the master point 0.6 m below; three start 0.5 m apart with it 0.75 m
                    below, and switching between them goes back to those. The load pulls on the
                    master point with its weight, swung to one side by “Load direction”, as when the
                    main line runs off at an angle or the load moves across below.
                </p>
                <p>
                    Both rigs are built on the same anchors and reach the same point: the cross,
                    “Master point below lowest anchor” under the lowest anchor, in line below the
                    anchors’ centre. A pre-equalised rig can be tied for a load that pulls off to
                    one side, “Pre-equalised legs tied for load direction”, which moves its cross
                    out from the centre in that direction. A sliding rig sets itself to whichever
                    way the load pulls, so it isn’t tied for a direction: its cross stays straight
                    below.
                </p>
                <ul className="flex list-disc flex-col gap-1.5 pl-5">
                    <li>
                        <span className="text-ink-soft">Pre-equalised:</span> each anchor has its
                        own leg to the master point, tied off so every leg is just snug with the
                        master point at the cross. The legs can’t change length (other than
                        stretching), so when the load swings, the master point stays nearly where it
                        is and the legs share the load unevenly. Swing it far enough and a leg goes
                        slack.
                    </li>
                    <li>
                        <span className="text-ink-soft">Sliding:</span> one sling whose strands run
                        freely through the master point karabiner, so every strand carries the same
                        tension. With two anchors it’s a sliding X: one strand to each. With three,
                        it’s tied off at the two outer anchors and runs through a karabiner on the
                        middle one, with both loops clipped into the master point, so the middle
                        anchor has two strands and takes twice what each outer one does. The sling
                        is just long enough to reach the cross. When the load swings, the master
                        point slides along the sling until the strands balance it again.
                    </li>
                </ul>
            </Part>

            <Part title="Where the master point settles">
                <p>
                    The master point settles where its potential energy is lowest: the load’s, plus
                    the energy stored in the slings as they stretch. Once it has settled, each leg’s
                    pull follows from how far it has stretched, and the pulls balance the load. Each
                    anchor’s figure is its leg’s pull as a share of the load. They add to more than
                    100% whenever the legs spread apart, because part of each leg’s pull is spent
                    pulling against the others sideways. Two legs 120° apart each take the whole
                    load.
                </p>
            </Part>

            <Part title="Stretch">
                <p>
                    The slings stretch in proportion to their pull: by their own length at{" "}
                    {SLING_STIFFNESS / 1000} kN, so about 10% at 10 kN or 2% under a 200 kg load,
                    roughly like nylon tape. This matters most for a pre-equalised rig on three
                    anchors: the legs share the load according to how much each has to stretch for
                    the master point to move, so a shorter leg, which is stiffer, takes more. The
                    shares don’t depend on how stretchy the slings are, only on all three being
                    alike. Stretch also closes the angle between the legs a little as the load comes
                    on, which eases the anchors slightly at wide angles.
                </p>
            </Part>

            <Part title="Assumptions and shortcuts">
                <ul className="flex list-disc flex-col gap-1.5 pl-5">
                    <li>
                        It’s static: the load is steady, and the page shows where things come to
                        rest. There’s no shock loading, such as when an anchor fails and a sliding
                        rig drops onto the others.
                    </li>
                    <li>
                        There’s no friction. Real karabiners grip a sliding sling, so a sliding rig
                        shares less evenly than shown, and doesn’t fully follow the load as it
                        swings.
                    </li>
                    <li>
                        The anchors and the load are all in one plane. Real anchors are rarely lined
                        up like that.
                    </li>
                    <li>
                        Pre-equalised legs are tied exactly snug, with no slack. In practice one leg
                        is often a little slack or tight, which shifts the load onto the others much
                        as swinging the load does.
                    </li>
                    <li>
                        The slings stretch evenly and in proportion to their pull, and are all of
                        the same material. Knots, mixed materials and the karabiner itself are left
                        out.
                    </li>
                </ul>
            </Part>
        </NotesCard>
    );
}
