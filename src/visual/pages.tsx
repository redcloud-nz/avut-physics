import {
    AccelerationFigure,
    AddingFigure,
    ArrowsFigure,
    ForceFigure,
    MassFigure,
    SplitFigure,
    VelocityFigure,
} from "./basics";
import {
    FrictionFigure,
    RedirectFigure,
    RedirectHaulFigure,
    SideLoadFigure,
    SixToOneFigure,
    SixToOneTMethodFigure,
    TagLineFigure,
    TwoLegsFigure,
    TwoToOneFigure,
    WeightFigure,
    ZRigFigure,
    ZRigTMethodFigure,
} from "./figures";
import { ControlsFigure } from "./intro";
import { IntroductionMore, SplittingArrowsMore } from "./more";

/*
 * The pages of A Visual Introduction to Rescue Physics, in order. Each is one idea: a headline, a sentence or two, and
 * a figure, and on some pages more for those who want it.
 */

export { SERIES } from "./series";

export type VisualPage = {
    slug: string;
    /** A word or two, for the list of pages. */
    name: string;
    title: string;
    text: React.ReactNode;
    Figure: () => React.ReactNode;
    /** Further reading, such as the maths, in a drawer that swipes up from under the page. */
    More?: () => React.ReactNode;
};

export const PAGES: VisualPage[] = [
    {
        slug: "introduction",
        name: "Introduction",
        title: "One idea per page",
        text: "Each page has one idea: a sentence or two, and a picture to play with. Here’s how to get around.",
        Figure: ControlsFigure,
        More: IntroductionMore,
    },
    {
        slug: "velocity",
        name: "Velocity",
        title: "Velocity is how fast, and which way",
        text: "Something moving at 2 metres per second (2 m/s) goes another 2 m every second. The marks are where it was after each second: evenly spaced, because its velocity doesn’t change.",
        Figure: VelocityFigure,
    },
    {
        slug: "acceleration",
        name: "Acceleration",
        title: "Acceleration is how fast velocity changes",
        text: "This box speeds up by 2 m/s every second. Its velocity (the arrows) grows steadily, so each second it goes further than the one before.",
        Figure: AccelerationFigure,
    },
    {
        slug: "mass",
        name: "Mass",
        title: "Mass is how much there is, not how heavy it is",
        text: "Mass is measured in kilograms (kg), and it’s the same everywhere. On the Moon, or floating in space, a 100 kg load is still 100 kg: just as hard to get moving, but lighter or weightless.",
        Figure: MassFigure,
    },
    {
        slug: "force",
        name: "Force",
        title: "A force is a push or a pull",
        text: "Forces are measured in newtons (N). One newton speeds 1 kg up by 1 m/s every second, so on smooth ice, 100 N does that to a 100 kg load.",
        Figure: ForceFigure,
    },
    {
        slug: "weight",
        name: "Weight",
        title: "100 kg weighs about 1 kN",
        text: "Weight is the force of gravity on a mass. Gravity speeds falling things up by about 10 m/s every second, so it pulls on every kilogram with about 10 N.",
        Figure: WeightFigure,
    },
    {
        slug: "arrows",
        name: "Arrows",
        title: "We draw forces as arrows",
        text: "A force has a size and a direction, and so does an arrow. The longer it is, the harder the pull, and it points the way it pulls.",
        Figure: ArrowsFigure,
    },
    {
        slug: "adding-arrows",
        name: "Adding arrows",
        title: "Arrows add tip to tail",
        text: "To add up forces, draw each arrow from the tip of the one before. The arrow from the start to the last tip is all of them together, whichever order you add them in.",
        Figure: AddingFigure,
    },
    {
        slug: "splitting-arrows",
        name: "Splitting arrows",
        title: "Any arrow splits into two",
        text: (
            <>
                Any pull can be split into a horizontal part, written <em>x</em>, and a vertical
                part, written <em>y</em>. Level and upright pulls are much easier to reason about
                than slanting ones, and tip to tail the two parts pull just the same as the arrow.
            </>
        ),
        Figure: SplitFigure,
        More: SplittingArrowsMore,
    },
    {
        slug: "tag-line",
        name: "Tag lines",
        title: "A sideways pull makes the rope pull harder",
        text: "Pull a load out with a tag line and the rope leans over until the pulls balance. Now it holds more than the load weighs.",
        Figure: TagLineFigure,
    },
    {
        slug: "two-legs",
        name: "Two legs",
        title: "Wider legs, harder pull",
        text: "Two legs each take half the load only when they hang side by side. At 120° apart, each holds the whole load.",
        Figure: TwoLegsFigure,
    },
    {
        slug: "side-load",
        name: "Side loading",
        title: "Pull to one side, and the far anchor takes it",
        text: "With pre-equalised legs, a main line pulling right loads the left anchor. Past 30°, the right leg goes slack.",
        Figure: SideLoadFigure,
    },
    {
        slug: "redirect",
        name: "Redirects",
        title: "A redirect feels both parts of the rope",
        text: "The tighter the rope turns, the harder it pulls on the redirect. Doubled right back, it pulls with twice the rope’s tension.",
        Figure: RedirectFigure,
    },
    {
        slug: "pulley-on-the-anchor",
        name: "Pulley on the anchor",
        title: "A pulley on the anchor only turns the rope",
        text: "The team still pulls with the whole load, and the load moves as far as the rope does. The anchor holds both parts.",
        Figure: RedirectHaulFigure,
    },
    {
        slug: "2-to-1",
        name: "2:1",
        title: "A pulley on the load halves the pull",
        text: "Two parts of the rope share the load. The price: the team pulls in 2 m of rope for every metre the load moves.",
        Figure: TwoToOneFigure,
    },
    {
        slug: "z-rig",
        name: "Z-rig",
        title: "The Z-rig: 3:1",
        text: "The main line doubles back round a travelling pulley on a rope grab (green). Three parts of rope pull the load, so the team pulls a third.",
        Figure: ZRigFigure,
    },
    {
        slug: "compound",
        name: "Compound systems",
        title: "Systems on systems multiply",
        text: "A 2:1 pulling on the Z-rig’s haul line doubles the team’s pull, and the Z-rig triples that: 6:1.",
        Figure: SixToOneFigure,
    },
    {
        slug: "t-method",
        name: "The T method",
        title: "The T method",
        text: "Call the team’s pull 1T. A rope keeps its T round every pulley. Where ropes meet, add them up. What reaches the load is the advantage.",
        Figure: ZRigTMethodFigure,
    },
    {
        slug: "t-method-compound",
        name: "The T method on a compound",
        title: "The T method works on anything",
        text: "The same steps on the 6:1, where counting rope parts gets it wrong.",
        Figure: SixToOneTMethodFigure,
    },
    {
        slug: "friction",
        name: "Friction",
        title: "Friction eats the advantage",
        text: "Every pulley passes on a little less than it gets. Good pulleys pass on about 90%; a karabiner, about half.",
        Figure: FrictionFigure,
    },
];
