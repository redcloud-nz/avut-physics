# Review of A Visual Introduction to Rescue Physics

Reviewed 2026-10-18 by four reviewing agents: physics (pages 1–15 and `src/visual/common/`), physics (pages 16–31),
teaching and writing (all pages), and rescue practice (all pages, checked against sources on the web). A second agent
then tried to refute each finding by reading the code and redoing the working itself. Findings raised by more than one
reviewer are merged. Figures were checked by reading the code, not by looking at them in a browser.

**55 findings:** 1 error, 5 misleading, 28 minor, 21 suggestions. 1 refuted (listed at the end).

Severity: **error** is wrong, or teaches something false. **Misleading** is defensible but likely to leave a wrong impression.
**Minor** is a small inaccuracy, unclear wording or an inconsistency. **Suggestion** is worth considering.

## Errors and misleading findings

- **error**, inclines: "sin starts slowly" is the wrong way round
- **misleading**, inclines: "the rest presses it into the ground" implies the parts add to the weight
- **misleading**, safety-factors: 22 kN rating is presented as what rescue gear is built to, because of 10:1
- **misleading**, safety-factors: Says 10:1 'covers' angles, knots and shock loads, which contradicts how system safety factors are worked out
- **misleading**, the-end: Summary gives counting as the way to find advantage, without its limit
- **misleading**, the-end: Takeaway "Gear holds ten times the load" states a target as a guarantee

## By page

### introduction

- [x] **suggestion**: Introduction doesn't say what the series covers or who it's for. `src/visual/pages/introduction/page.tsx:22`. Raised by: teaching.
  - **Problem:** The first page only explains how to get around. It never says this is about the physics behind rope rescue systems, that no maths is needed, or roughly where it goes (forces → anchors → pulleys → friction → falls). Readers without a physics background benefit from that reassurance and sense of direction before velocity and acceleration.
  - **Fix:** Text: "Why rope rescue systems behave as they do, from what a force is to pulley systems and falls. No maths needed. Each page has one idea: a sentence or two, and a picture to play with. Here's how to get around."
  - **Checker:** introduction/page.tsx:22 only explains navigation. A sentence saying what the series covers and that no maths is needed would reassure readers without a physics background. Cheap to add.

### velocity

- [x] **minor**: Defines velocity as just 'how fast', leaving out direction. `src/visual/pages/velocity/page.tsx:31`. Raised by: physics, teaching.
  - **Problem:** 'Velocity is how fast something goes' is the definition of speed. The page draws velocity as an arrow, and the series goes on to say that what makes arrows apt is having 'a size and a direction' (Arrows). Leaving direction out here sets up the usual speed/velocity mix-up, and the arrow on this page goes unexplained.
  - **Teaching reviewer adds:** The headline says "Velocity is how fast something goes", which is speed. Velocity also has a direction, and the figure draws it as an arrow. Three pages later, arrows are introduced as having "a size and a direction". The velocity figure's labels say "steady speed", and Force and Shock loading use "speed". Nothing tells the reader whether speed and velocity are the same thing.
  - **Fix:** Use 'Velocity is how fast something goes, and which way', and add a few words to the text saying the arrow shows both: its length is how fast, and it points the way the thing is going.
  - **Checker:** The headline 'Velocity is how fast something goes' is the definition of speed. The page does draw a velocity arrow (common/track.tsx:82), so the reviewer is right that an arrow appears unexplained. But the motion is one-dimensional and the series brings in direction properly on Arrows, so this is a beginner simplification rather than an error. Downgraded to suggestion.

### mass

- [x] **minor**: 'Space' with zero gravity repeats the 'no gravity in space' myth. `src/visual/pages/mass/figure.tsx:16`. Raised by: physics.
  - **Problem:** The third button sets gravity to 0 under the name 'Space', and the page text says 'floating in space ... weightless'. In orbit, where people actually float, gravity is still about 90% of Earth's. They float because they're falling freely, not because gravity is gone. Zero gravity only holds far from any planet or star.
  - **Fix:** Rename the button to 'Deep space', and say 'far out in space' (or 'far from any planet') in the page text and the figure's doc comment.
  - **Checker:** PLACES has { name: 'Space', gravity: 0 }, and mass/page.tsx line 9 says 'floating in space ... weightless'. Gravity in low Earth orbit is still about 90% of surface gravity, and astronauts float because they're in free fall. The wording backs up a common misconception. It's minor, since 'deep space' makes zero gravity a fair approximation.

### weight

- [x] **minor**: The weight arrow's head is cut off at the top of the mass slider. `src/visual/pages/weight/figure.tsx:43`. Raised by: physics.
  - **Problem:** The arrow ends at box.y + side + 0.55·mass = 110 + (18 + 3√m) + 0.55m. At 300 kg that is 110 + 70 + 165 = 345, beyond the viewBox height of 330. From about 280 kg up, the arrowhead (and the 'it points the way the force acts' cue) is clipped, just where the figure is showing the biggest weight.
  - **Fix:** Use arrow = mass \* 0.48, raise box.y to about 95, or widen the viewBox to 0 0 300 350. Check the 'Weight' tag still fits at both ends of the slider.
  - **Checker:** The arrow ends at box.y + side + 0.55·mass. At 300 kg that's 110 + 18 + 52 + 165 = 345, beyond the 330 viewBox height, and the default SVG overflow is hidden. The head starts to be clipped from about 275 kg.

### units

- [x] **minor**: 'A newton is a kilogram speeded up by 1 m/s²' equates a force with a mass. `src/visual/pages/units/page.tsx:71`. Raised by: physics.
  - **Problem:** As written, the sentence says a newton is a kilogram. The Force page gets it right: a newton is the force that speeds 1 kg up by 1 m/s².
  - **Fix:** Write 'A newton is the force that speeds a kilogram up by 1 m/s²', to match the Force page.
  - **Checker:** units/page.tsx:71 reads 'A newton is a kilogram speeded up by 1 m/s²', which equates a force with a mass. force/page.tsx:30 has the correct wording: 'just enough force to speed 1 kg up by 1 m/s²'.

### adding-arrows

- [x] **minor**: The 'together' arrow and the dashed tip-to-tail copies run off the grid. `src/visual/pages/adding-arrows/figure.tsx:33`. Raised by: physics.
  - **Problem:** DragGrid clamps each tip to 12..288 (±4.6 kN from the bolt at 150), but nothing limits the sum. Two arrows dragged towards the same corner give a resultant of up to ±9.2 kN, which ends near 426 drawing units in a 0..300 viewBox. The resultant's arrowhead and the dashed copies are then clipped out of the picture while the readout still shows the value. The same happens on the equilibrium page (equilibrium/figure.tsx:32-34), where the 'holds it still' arrow and the closing side of the triangle disappear. That hides the very thing those pages are teaching.
  - **Fix:** Have DragGrid take an optional constraint, so the adding-arrows and equilibrium pages can reject (or pull back) a drag that puts the sum, or any dashed tip (ORIGIN+a+b, or ORIGIN−(a+b) on Equilibrium), outside about 12..288. Or cap each tip at about 2.3 kN from the bolt so the sum always fits.
  - **Checker:** DragGrid (common/grid.tsx) clamps each tip to 12..288, so each arrow can be up to 138 units (4.6 kN) from the bolt on each axis. Nothing limits the sum, which can reach 276 units from the origin, about 426 in a 0..300 viewBox. The SVG class sets no overflow-visible, so the 'together' arrow, the dashed copies and the closing side on equilibrium/figure.tsx get clipped while the readouts keep showing values.

### equilibrium

- [x] **minor**: Equilibrium is defined as staying still, but the pulley pages also apply it to steady hauling. `src/visual/pages/equilibrium/page.tsx:8`. Raised by: teaching.
  - **Problem:** The headline and text say "When nothing moves…" and "Something that stays still is in equilibrium". Later, the pulley pages (2-to-1's drawer: "While it's held still, or moving steadily, those balance"), the friction table and the surface-friction haul and lower numbers all apply balance to a load that is moving. A beginner told "when nothing moves" may think the pulley numbers only hold while the load is stopped. The Force page has already set up the reason: force changes velocity, so steady velocity means no overall force.
  - **Fix:** Add: "The same goes for something moving steadily: if its velocity isn't changing, nothing overall is pushing it (as on Force)."
  - **Checker:** equilibrium/page.tsx defines equilibrium only as 'stays still'. The 2:1 drawer ('or moving steadily'), the friction table and surface-friction haul/lower all apply balance to a load moving at steady speed. Force has already set up that force changes velocity, so one sentence closes the gap.

### splitting-arrows

- [x] **minor**: Names for the parts drift: horizontal/level/sideways, vertical/upright/up. `src/visual/pages/splitting-arrows/page.tsx:96`. Raised by: teaching.
  - **Problem:** Splitting arrows calls the parts "horizontal" and "vertical". The next page's headline says "Level and upright parts", and the figures and later pages say "sideways" and "up" ("x, each anchor", "sideways part"). Varying the names makes a beginner wonder whether they mean different things. Separately, "x" is a sideways force on these pages but becomes the rope's stretch (a distance) in the Rope stretch drawer (rope-stretch/page.tsx line 29).
  - **Fix:** Use 'sideways' and 'up' throughout: Splitting arrows text "a sideways part x and an up part y. Sideways and up forces are much easier to reason about…"; Pulling sideways title "Sideways and up parts make a slanting pull". In rope-stretch line 29, write "the stretch" without the letter x, or use s.
  - **Checker:** Splitting arrows uses 'horizontal'/'vertical' (line 96-97) and 'Level and upright forces' (line 98). Pulling sideways' headline is 'Level and upright parts'. The figures and later pages use 'sideways'/'up' ('x, each anchor', 'sideways part'). Rope-stretch's drawer uses x for the stretch (line 29), clashing with x as the sideways force.

### pulling-sideways

- [x] **minor**: 'more than the load weighs' is false at the slider's starting value of 0. `src/visual/pages/pulling-sideways/page.tsx:121`. Raised by: physics.
  - **Problem:** The tag-line slider goes down to 0 kN. There T = hypot(0, 2.4) = 2.4 kN, exactly the load's weight, while the page text says T is 'more than the load weighs'.
  - **Fix:** Write 'more than the load weighs whenever the tag line pulls' (or 'more than the load weighs, as soon as the tag line pulls at all').
  - **Checker:** The slider has min={0}, and at 0 T = hypot(0, 2.4) = 2.4 kN, which equals the weight. The page text says T is 'more than the load weighs' with no condition. It's an edge case, since the slider starts at 1.8.
- [x] **suggestion**: The angle arc at the anchor has no plumb line or name. `src/visual/pages/pulling-sideways/figure.tsx:50`. Raised by: physics.
  - **Problem:** The AngleArc runs from the rope (90° − lean in screen degrees) to 90° (straight down). No vertical line is drawn from the anchor, so the arc measures against an invisible line, and the angle isn't named or read out. The next pages use θ from straight up, so this is where readers should first see it.
  - **Fix:** Draw a faint dashed vertical down from the anchor, the length of the arc radius or a little more, so the arc has a visible reference. Labelling it θ is optional, and worth doing only if Two anchors picks the label up.
  - **Checker:** The AngleArc (figure.tsx:50) runs from the rope to straight down, but no vertical line is drawn from the anchor, so the arc measures against an invisible line. The page text never discusses the angle, so naming it θ here is optional. A faint plumb line is the useful part.
- [x] **suggestion**: The tag line in the worked example pulls far harder than a real one. `/Users/awestphal/projects/avut-project/avut-physics/src/visual/pages/pulling-sideways/page.tsx:88`. Raised by: practice.
  - **Problem:** The example has a 2.4 kN load (240 kg, more than the series' 200 kg rescue load) with a tag line pulling 1.8 kN, about 180 kg sideways. Real tag lines are hand-held and pull a few hundred newtons. Also, tag lines are usually pulled from below, so their pull has a downward part that adds to the main line's load. The page only shows a level pull, which understates the main line.
  - **Fix:** After the example, add: 'A real tag line pulls much less than this, but usually from below, so it adds to the main line's load as well as pulling it sideways.'
  - **Checker:** The 2.4/1.8/3 kN numbers are a worked 3-4-5 triangle to show Pythagoras, not a claim about real tag lines, so it isn't really wrong. The point that tag lines often pull from below, adding to the main line's load, is a worthwhile note, and the page only shows a level pull.

### two-anchors

- [x] **minor**: Calling cos θ and sin θ 'shares' suggests they add up to the whole pull. `src/visual/pages/two-anchors/page.tsx:240`. Raised by: physics, teaching.
  - **Problem:** 'cos θ is the share of a rope's pull that goes up, and sin θ the share that goes sideways' reads as a split of a whole. At 60° the 'shares' are 0.5 and 0.87, which add to 1.37. The text then says 'most of its pull goes into the sideways part' using 0.87, which again reads as a split of one total. Pulling sideways took care to explain that the parts add to more than the pull because they're at right angles. This wording undoes that for readers without a physics background.
  - **Teaching reviewer adds:** The More says "cos θ is the share of a rope's pull that goes up, and sin θ the share that goes sideways." A "share" reads as a portion of a whole, so a reader expects the two to add to 100%. They don't: at 45° each is 0.71, together 1.41. Lines 255-257 also say "Wider than that [120°] … most of its pull goes into the sideways part". In fact the sideways part is already the bigger one past 90° apart; at 120° it is 0.87 against 0.5.
  - **Fix:** Write 'cos θ is how big the up part is, as a fraction of the rope's pull, and sin θ how big the sideways part is', and add 'they're at right angles, so the two don't add up to 1'. Rephrase 'most of its pull goes into the sideways part' as 'its sideways part is bigger than its up part'.
  - **Checker:** Line 240 calls cos θ and sin θ the 'share' of the pull that goes up and sideways. That reads as a split of one whole, and at 60° the two come to 1.37. Lines 254-256 then say 'most of its pull goes into the sideways part' using sin 60° = 0.87, which repeats that reading. Pulling sideways explained that the parts add to more than the pull, so this wording works against it.
- [x] **minor**: 'so with the ropes 120° apart' does not follow from the sentence before it. `src/visual/pages/two-anchors/page.tsx:273`. Raised by: physics, teaching.
  - **Problem:** 'A leaning pull is bigger than its up part alone, so with the ropes 120° apart each anchor holds the whole load.' The first clause only shows that each anchor holds more than half. The 120° figure comes from cos 60° = ½, which this text never mentions (it's in the drawer). A reader may take the 'so' as reasoning they've missed.
  - **Teaching reviewer adds:** "A leaning pull is bigger than its up part alone, so with the ropes 120° apart each anchor holds the whole load." The first clause explains why each anchor holds more than half. Nothing in the main text explains why 120° in particular gives the whole load; that reasoning (cos 60° = ½) is only in the drawer.
  - **Fix:** Split it: 'A leaning pull is bigger than its up part alone, so each anchor holds more than half. With the ropes 120° apart, each holds the whole load; any wider, more than the whole load.'
  - **Checker:** The page text (line 273) goes from 'a leaning pull is bigger than its up part alone' straight to '120° apart each anchor holds the whole load'. The first clause only shows that each anchor holds more than half. The 120° figure comes from cos 60° = ½, which is only in the drawer.
- [x] **suggestion**: No working guidance on anchor angles. `/Users/awestphal/projects/avut-project/avut-physics/src/visual/pages/two-anchors/page.tsx:270`. Raised by: practice.
  - **Problem:** The physics is right (each anchor holds the whole load at 120°), and the figure turns pink past that and lets the slider go to 140°. But it never gives the rule rescuers are taught: keep the angle between the legs under about 90° (each leg then holds about 71%), and treat 120° as the most you'd ever accept.
  - **Fix:** Add one sentence to the text or the More drawer: 'In practice, keep the ropes under about 90° apart where you can (each then holds about 71%), and treat 120° as the widest you'd accept.'
  - **Checker:** The physics on the page is right, but it never gives the working rule. At 90° each leg holds 1/(2cos45°) ≈ 71%, so the suggested figure is correct.

### pulling-off-centre

- [x] **minor**: Total held by the anchors is stated as 2.5 kN; it works out to 2.55 kN. `src/visual/pages/pulling-off-centre/page.tsx:184`. Raised by: physics.
  - **Problem:** Recomputed with the page's own rig (anchors at ±1 m, master point at (0.2, −1.2), 2 kN load swung 15°): T_left = 1.532 kN and T_right = 1.020 kN, so together 2.552 kN. The text hard-codes 'Between them the anchors hold 2.5 kN'. That is the sum of the two rounded values shown above it (1.5 + 1.0), not the actual total, which rounds to 2.6. The individual values come from tiedOff and are correct.
  - **Fix:** Work the total out from EXAMPLE.shares too. Rounding it to 2.6 would sit oddly next to 1.5 + 1.0, so write 'a little over 2.5 kN' (or 'about 2.55 kN'), computed as (2 \* (EXAMPLE.shares[0] + EXAMPLE.shares[1])).toFixed(2).
  - **Checker:** Recomputed independently: left rope 45°, right rope atan(0.8/1.2)=33.7°, swing 15°, so α=30°, β=48.7°. T_left = 2·sin48.7°/sin78.7° = 1.532 kN, T_right = 2·0.5/0.981 = 1.020 kN, sum 2.55 kN. Line 184-185 hard-codes '2.5 kN', which is the sum of the rounded figures, while the per-anchor values come from EXAMPLE.shares.
- [x] **minor**: Main text doesn't say the master point is tied off. `src/visual/pages/pulling-off-centre/page.tsx:211`. Raised by: teaching.
  - **Problem:** The rule "the anchor most in line takes most" only holds for a pre-tied (fixed) master point, and the figure's comment and More use one ("tied off"). The headline and text just say "Off centre". Rescuers also rig sliding, self-equalising master points, where both legs carry the same tension and this rule doesn't apply. Reading the main text alone, someone could apply it to a sliding X.
  - **Fix:** Text: "With the master point tied off, the anchor whose rope lines up best with the load takes more. Swing the pull past one rope and the other goes slack." Optional drawer line: "A sliding master point instead moves until both ropes make the same angle with the load, so they share it equally, at the cost of a shock if one anchor fails."
  - **Checker:** The main text and headline never say the master point is tied off. Only the drawer (line 148) and the figure's code comment do. The slider 'Master point, right of the middle' implies a fixed point, but a reader won't make that connection. The reviewer's physics is a bit off, though. With a frictionless sliding X, the master point moves until both legs make equal angles with the load line, so both carry the same tension. 'Most in line takes most' then still holds, just with equal alignment. What changes is that you can't set the offset, and the 'other goes slack' behaviour differs. Downgraded to minor.
- [x] **suggestion**: Doesn't name the rig, so the lesson isn't tied to how anchors are actually built. `/Users/awestphal/projects/avut-project/avut-physics/src/visual/pages/pulling-off-centre/page.tsx:211`. Raised by: practice.
  - **Problem:** The rig here is a pre-equalised (load-sharing) anchor, tied off at the master point; the code calls it preEqualised and tiedOff. Rescue texts contrast this with self-equalising (load-distributing) rigs, which follow a swinging load but extend if one leg fails. Naming the type lets readers connect the page to the anchors they build.
  - **Fix:** Add to the More drawer: 'This anchor is tied off at the master point (pre-equalised), so it doesn't adjust as the pull swings. A self-equalising rig would follow the pull, but drops a little if one leg fails.'
  - **Checker:** The rig is tied off at the master point, so it is pre-equalised. Naming it, briefly explained, connects the page to the anchors readers build. The fix needs to explain the jargon, as AGENTS.md asks.

### redirect

- [x] **minor**: Redirect is drawn as a karabiner but treated as frictionless. `src/visual/pages/redirect/figure.tsx:14`. Raised by: teaching, practice.
  - **Problem:** The figure draws the redirect as a ring ("A rope turning round a karabiner on a redirect") and gives both parts of the rope the same pull. Neither the text nor the figure says this ignores friction. Nine pages later, Pulley friction says a karabiner passes on only about half the pull. A reader who connects the two pages finds them contradicting each other. A reader who doesn't learns that a rope keeps its full tension round a karabiner, which is wrong while the rope is running.
  - **Practice reviewer adds:** The figure's comment and its small ring stand for a karabiner. In practice redirects (or 'directionals') use a pulley, because a karabiner adds a lot of friction (the friction page itself says about half) and wears the rope. The redirect page also has no More drawer saying that a redirect's anchor must be built for the force shown, which at a tight turn approaches 2× the rope's tension and is often more than the main anchor's. Redirects are often rigged on weaker, improvised anchors.
  - **Fix:** Add a clause to the redirect text: "(This takes the rope as running freely, as round a good pulley; friction comes later.)" Or update the figure comment and drawing to a pulley wheel so it matches the Pulley on the anchor figure.
  - **Checker:** The redirect figure's comment says karabiner, and the drawing is a bare ring (circle r=7). It gives both parts the same T, and the page has no drawer or caveat. The only 'perfect pulley' note is in the next page's drawer (pulley-on-the-anchor:32-33). The physics isn't wrong for a held, static rope, where both parts can carry the same tension. Most of the redirect force (about 2T when doubled back) also survives with friction, since the parts only differ while the rope runs. So this is a missing assumption rather than a misleading result. Downgraded to minor.
- [x] **minor**: Redirect page uses "redirect" and "tension" before explaining them, and comes before the pulley page. `src/visual/pages/redirect/page.tsx:8`. Raised by: teaching.
  - **Problem:** The text never says what a redirect is. It ends with "twice the rope's tension", but "tension" has only been introduced inside the Splitting arrows drawer ("T, for tension"). The page relies on a rope pulling equally on both sides of the turn, but that idea ("A rope pulls along itself, and just as hard all along") is only explained on the next page, in the Pulley on the anchor drawer. The T method's main text ("A rope keeps its T round every pulley") also depends on it, and it never appears outside a drawer.
  - **Fix:** Don't reorder or define 'redirect'. Put the principle in the redirect text: "A rope pulls just as hard on both sides of a redirect, so the redirect feels both. The tighter it turns…". Optionally repeat "a rope pulls just as hard all along" in the Pulley on the anchor main text, since the T method rests on it.
  - **Checker:** Partly holds. The audience are rescue team members, so 'redirect' and 'tension' are familiar words and don't need defining. The real gap is that the redirect page relies on the rope pulling just as hard on both sides of the turn, and that principle is only stated in the Pulley on the anchor drawer (lines 24-29). The T method's main text then states "A rope keeps its T round every pulley" as a rule. Reordering the pages is more than this needs.
- [x] **suggestion**: Doesn't say it assumes equal tension on both sides of the redirect. `src/visual/pages/redirect/page.tsx:9`. Raised by: physics.
  - **Problem:** The figure draws both parts at the same length (T\_ = 56), and redirectShare = 2cos(angle/2) assumes the tension is the same on both sides. A rope over a bare karabiner has a lot of friction, so the load-side and team-side tensions differ noticeably (the redirect still feels roughly their sum). Rescue readers will often redirect over a karabiner, as the figure's own comment says. The project's rule is to state shortcuts openly.
  - **Fix:** Add one clause to the text, or a short More drawer: 'This assumes the rope runs freely, so both parts pull equally hard. Over a karabiner, friction makes the load side pull harder than the team side (Pulley friction comes back to this), but the redirect still feels both together.'
  - **Checker:** The redirect page has no More drawer and no caveat. The figure's own comment says the rope turns round a karabiner, and both parts are drawn equal (T\_ = 56). Pulley-on-the-anchor (line 32-33) states the perfect-pulley assumption, and Pulley friction gives a karabiner e ≈ 0.5, but both come after Redirects. With e = 0.5 the two sides differ by a factor of two, which is not small.

### pulley-on-the-anchor

- [x] **minor**: "It's still the start of every haul system" isn't true. `/Users/awestphal/projects/avut-project/avut-physics/src/visual/pages/pulley-on-the-anchor/page.tsx:75`. Raised by: practice.
  - **Problem:** The page's own 2:1 has no anchor pulley; it's tied to the anchor. Many hauls start with a rope grab on the main line rather than with an anchor pulley.
  - **Fix:** Change it to 'It's still part of most haul systems.'
  - **Checker:** Line 75, 'It's still the start of every haul system', is too absolute. The series' own 2:1 is tied to the anchor and has no anchor pulley. It is a small overstatement.

### 2-to-1

- [x] **minor**: "Advantage" and the n:1 notation are never defined in main text. `src/visual/pages/2-to-1/page.tsx:61`. Raised by: teaching.
  - **Problem:** The page is named "2:1" and its headline says "halves the pull", but nothing on a main page says what "2:1" means or what an "advantage" is. The only definition is in the drawer ("That amount is the advantage"). The Z-rig ("The Z-rig: 3:1"), Counting ("That's the advantage") and the friction readouts all use the term as if it were known. The series also never mentions "mechanical advantage" or "MA", the terms rescuers will hear in training.
  - **Fix:** 2-to-1 text: "Two parts of the rope share the load, so you pull half: a 2:1. That ratio is the system's mechanical advantage (MA). The price: you pull in 2 m of rope for every metre the load moves."
  - **Checker:** 'Advantage' is only defined in the 2:1 drawer (line 50). The Z-rig and Counting main texts use it as known, and grep finds 'mechanical advantage' and 'MA' nowhere in src/visual. Rescuers will meet those terms in training, so tying them in is worthwhile.

### z-rig

- [x] **minor**: Z-rig description leaves out the anchor pulley. `src/visual/pages/z-rig/page.tsx:9`. Raised by: physics, teaching.
  - **Problem:** "The main line doubles back round a travelling pulley on a rope grab" misses the first turn. The main line goes up round the anchor pulley, then back round the travelling pulley, which is where the Z shape comes from. Readers new to rigging may picture a single turn.
  - **Teaching reviewer adds:** In a Z-rig, only the main line is attached to the load. The travelling pulley's two parts pull on the rope grab, and the grab passes that onto the main line (this is exactly what the T method page shows: 2T + 1T at the grab). "Three parts of rope pull the load" is loose wording that two pages later becomes "count the parts that get shorter". For a reader who has just seen the 2:1, where both parts really do pull on the load's pulley, it suggests the wrong mechanism.
  - **Fix:** "The main line runs up round a pulley on the anchor, then back down round a travelling pulley on a rope grab (green) on the main line. Three parts of rope pull the load, so you pull a third."
  - **Checker:** z-rig/page.tsx:9 mentions only the travelling pulley. In a Z-rig the main line first turns round the anchor pulley, then doubles back round the travelling pulley, and those two turns make the Z. The figure shows this, but the text alone describes a single turn.
- [x] **minor**: Z-rig drawn and described with no progress capture or belay, and the page doesn't say so. `/Users/awestphal/projects/avut-project/avut-physics/src/visual/pages/z-rig/page.tsx:9`. Raised by: practice.
  - **Problem:** A field Z-rig always has a progress capture device at the anchor pulley (a prusik-minding pulley with a tandem prusik, or a rope clamp or ratchet) to hold the load while the travelling grab is reset, and in two-rope practice it has a separate belay line as well. No page in the series mentions progress capture, resetting, or the belay line (a search of src/visual finds none). The same applies to the 5:1, compound and T-method figures, which reuse Z_RIG and SIX_TO_ONE from src/articles/pulley-systems.ts. A beginner may take the drawing as a complete rig. The brief only allows leaving this out if the page says so, and it doesn't.
  - **Fix:** Add one sentence or a short More drawer to z-rig: 'A real Z-rig also has a progress capture at the anchor pulley, to hold the load while you reset the rope grab, and a separate belay line. They're left out here to keep the rope's path clear.'
  - **Checker:** A search of src/visual finds no mention of progress capture, resetting or a belay line, and the z-rig page has no More drawer. The series is about physics, so leaving these out of the drawing is a reasonable simplification. Saying so in one sentence would stop beginners taking the drawing as a complete rig. I've lowered it to minor because these readers learn rigging in training, not from this page.

### 5-to-1

- [x] **minor**: Odd/even rule stated for all systems but only holds for simple ones. `src/visual/pages/5-to-1/page.tsx:26`. Raised by: physics, teaching.
  - **Problem:** "Tied to the load, a system's advantage is an odd number; tied to the anchor, an even one." The compound 6:1 two pages later has its Z-rig rope tied to the load and an even advantage. The rule holds only for simple systems with no pure redirects counted.
  - **Teaching reviewer adds:** "Tied to the load, a system's advantage is an odd number; tied to the anchor, an even one" holds only for simple systems. The very next compound shown, the 6:1, has its rope end tied off and comes out even for a different reason. Stated without the qualifier, it reads as a general rule.
  - **Fix:** "Tied to the load, a simple system's advantage is an odd number; tied to the anchor, an even one." Optionally add: "(Compound systems, a few pages on, don't follow this.)"
  - **Checker:** 5-to-1/page.tsx:26-27 states the odd/even rule for "a system" in general. The compound 6:1 two pages later is even, and the Counting page itself says simple and compound systems behave differently, so the rule should be scoped.
- [x] **minor**: "In practice, a 5:1 is two double pulleys" overstates one way of building it. `/Users/awestphal/projects/avut-project/avut-physics/src/visual/pages/5-to-1/page.tsx:11`. Raised by: practice.
  - **Problem:** In rope rescue the double-pulley block and tackle is more often rigged as a 4:1 (tied off to the anchor's double, as with a pre-rigged 4:1), and 5:1s are usually built as complex systems from single pulleys off a Z-rig (the 'complex 5:1' in the CMC Rope Rescue Manual). In rescue, the moving block also goes on a rope grab on the main line rather than straight onto the load. Line 26-27, "Tied to the load, a system's advantage is an odd number; tied to the anchor, an even one", is only true for simple systems; the page's own 6:1 compound is tied to the load.
  - **Fix:** Change it to 'One way to build a 5:1 is with two double pulleys ...', and add that rescuers often build one from single pulleys as a complex system instead. Change the rule to 'In a simple system, tied to the load ...'.
  - **Checker:** 'In practice, a 5:1 is two double pulleys' overstates one way of building it. In rescue, a 5:1 is often a complex system built from single pulleys. 'Tied to the load, odd; tied to the anchor, even' only holds for simple systems. The series' own 6:1 compound has the main line on the load and comes out even.

### counting

- [ ] **minor**: "Simple system" used before it's defined; "2:1 ↓" never explained. `src/visual/pages/counting/page.tsx:51`. Raised by: teaching. Part done: the text now defines a simple system; the "2:1 ↓" label is still to do, as "2:1 + redirect" won't fit the picker at phone width.
  - **Problem:** The main text starts "In a simple system…", but the series only says what a simple system is in this page's drawer ("where the pulleys that move all move with the load"). Compound systems come on the next page. The figure's system picker also has an option "2:1 ↓" (counting/figure.tsx line 24) that nothing on screen explains; only the drawer mentions it in passing.
  - **Fix:** Text: "In a simple system, where every pulley that moves moves with the load, count the parts of rope that get shorter as the load comes up. That's the advantage." Rename the option to '2:1 + redirect' and update the drawer reference to match.
  - **Checker:** counting/page.tsx:51 opens 'In a simple system' with the definition only in the drawer (line 36). The figure's option '2:1 ↓' (figure.tsx:24) is only explained in the drawer (line 26).
- [x] **suggestion**: Leaves out complex systems, the third standard category. `/Users/awestphal/projects/avut-project/avut-physics/src/visual/pages/counting/page.tsx:36`. Raised by: practice.
  - **Problem:** Rope rescue texts (CMC, Rigging for Rescue) sort systems into simple, compound and complex. 'Where it goes wrong' only names compound systems as where counting fails. Complex systems (for example the complex 5:1, where a pulley moves the opposite way to the load) are just as common in the field and also need the T method.
  - **Fix:** Add to 'Where it goes wrong': 'The same goes for complex systems, which are neither simple nor compound: one pulley moves the opposite way to the load. Use the T method for those too.'
  - **Checker:** 'Complex' appears nowhere in src/visual. 'Where it goes wrong' only names compound systems as where counting fails. Complex systems such as the complex 5:1 are common and also need the T method.

### compound

- [x] **suggestion**: No warning that big advantages make it easy to overload the system. `/Users/awestphal/projects/avut-project/avut-physics/src/visual/pages/compound/page.tsx:9`. Raised by: practice.
  - **Problem:** A recognised practice point in rescue (Rigging for Rescue, the CMC manual) is that with a 6:1 or more, a few haulers can put several kN on the system without feeling it if the load snags at an edge, which can damage gear or the patient. Since the page celebrates multiplying the advantage, that trade-off is worth stating.
  - **Fix:** Add a More drawer: 'More advantage isn't always better. On a 6:1, three people pulling 0.3 kN each can put around 4–5 kN on a load that snags on an edge, and hardly feel it. Use the least advantage that does the job, and stop if hauling suddenly gets hard.'
  - **Checker:** The compound page has no More drawer and no warning about the cost of a big advantage. 'Use the least advantage that does the job' is a widely taught practice point. The suggested numbers are a bit high: 3 × 0.3 kN × 6 = 5.4 kN with no friction, and friction brings it down to roughly 4 kN.

### t-method

- [x] **suggestion**: "A rope keeps its T round every pulley" without saying "perfect". `src/visual/pages/t-method/page.tsx:9`. Raised by: physics.
  - **Problem:** The rule is stated as a fact, and Pulley friction (a few pages later) then shows that each pulley passes on only e of it. Pulley on the anchor flags its "perfect pulley" assumption; this page doesn't.
  - **Fix:** "A rope keeps its T round every (perfect) pulley." Or add a one-line More drawer pointing to Pulley friction.
  - **Checker:** Pulley on the anchor flags the perfect-pulley assumption and defers friction, so it's covered in context. But the T method page states "A rope keeps its T round every pulley" as a rule with no More drawer. Adding one word is cheap.
- [ ] **suggestion**: Some headlines are labels, not the page's idea. `src/visual/pages/t-method/page.tsx:8`. Raised by: teaching. Part done: the T method's headline now states its idea; the Z-rig and 5:1 headlines are unchanged.
  - **Problem:** The series promises "one idea per page, with the idea in the headline", and most headlines are sentences that state it. A few are only names: "The T method", "The Z-rig: 3:1" (z-rig/page.tsx line 8) and "Back and forth: 5:1" (5-to-1/page.tsx line 44).
  - **Fix:** t-method: "Follow the tension to find the advantage"; z-rig: "A Z-rig gives 3:1 from two pulleys and a grab"; 5-to-1: "Two double pulleys make a 5:1".
  - **Checker:** The series doesn't explicitly promise 'the idea in the headline': the intro says only 'Each page has one idea: a sentence or two'. Still, almost every headline is a sentence stating the idea, so 'The T method', 'The Z-rig: 3:1' and 'Back and forth: 5:1' stand out as labels. Low priority.

### friction

- [x] **minor**: "part after it pulls less than the part before it" can read backwards. `src/visual/pages/friction/page.tsx:29`. Raised by: physics.
  - **Problem:** The sentence has just said the rope runs towards you. Read in the direction the rope runs, the part "after" the pulley is the part nearer your hands, and that part pulls more, not less. The intended meaning (the load's side carries e times your side) only works if "after" means further from your hands.
  - **Fix:** "...so the part on the load's side of it pulls a little less than the part on your side."
  - **Checker:** Line 29 says the rope runs towards you, so read along the rope's run, "after" the pulley is your side. Your side pulls more (T against eT), so the sentence as written says the opposite of what's meant.
- [x] **suggestion**: Slider says "efficiency", text says "passes on". `src/visual/pages/friction/figure.tsx:30`. Raised by: teaching.
  - **Problem:** The slider is labelled "Pulley efficiency" but the page text and drawer only talk about what a pulley "passes on". The text also doesn't say the figure is a Z-rig. "Efficiency" is the word on gear specs and in courses, so it's worth linking the two.
  - **Fix:** Text: "Every pulley passes on a little less than it gets: that share is its efficiency. Good pulleys pass on about 90%; a karabiner, about half. Here's the Z-rig again."
  - **Checker:** The friction figure's slider is 'Pulley efficiency' (figure.tsx:30), but the text and drawer only say 'passes on'. 'Efficiency' is the term on gear specs and in courses. The figure is a Z-rig, which the main text never says (the drawer's table and working imply it).
- [x] **suggestion**: Edge friction isn't covered anywhere. `/Users/awestphal/projects/avut-project/avut-physics/src/visual/pages/friction/page.tsx:84`. Raised by: practice.
  - **Problem:** The series covers pulley friction and the friction of the ground on the load, but not the rope running over a cliff edge, which in real hauls often costs more than all the pulleys together and wears the rope. The only mention is 'Knots and edges' in the safety factors list.
  - **Fix:** Add a short section to the friction More drawer: 'A rope running over an edge, even a padded one, loses much more than a pulley does, and wears the rope. An edge roller, or a high directional that lifts the rope clear of the edge, gets much of it back.'
  - **Checker:** Edges come up only in the safety-factors list. Friction over an edge often costs more than the pulleys and wears the rope, and the friction page is the natural place for it.

### inclines

- [x] **error**: "sin starts slowly" is the wrong way round. `src/visual/pages/inclines/page.tsx:29`. Raised by: physics, teaching.
  - **Problem:** sin θ rises fastest at 0° (its slope there is 1, so sin θ ≈ θ) and levels off towards 90°. The page's own numbers show this: the first 10° already puts 17% on the rope, while 60° to 90° adds only 13% more (87% to 100%). cos on Two anchors really does start slowly, because it stays near 1 for small angles. sin is the mirror of that: quick at first, flat at the top. Saying "Like cos on Two anchors, sin starts slowly" teaches readers the wrong shape. Separately, "Past about 60°, the rope is holding nearly the whole load" sits oddly next to 87% at 60°.
  - **Teaching reviewer adds:** The More says "Like cos on Two anchors, sin starts slowly: a gentle slope of 10° puts only 17% of the load on the rope." It's the other way round. sin θ rises fastest at 0° (roughly in proportion: 10° gives 0.17, 20° gives 0.34) and levels off near 90°. cos is the one that changes slowly near 0°. The page's own next sentence ("Past about 60°, the rope is holding nearly the whole load") relies on sin flattening out near 90°, so the paragraph contradicts itself. A reader who checks it against Two anchors comes away with a wrong picture of the curves.
  - **Fix:** "Unlike cos on Two anchors, sin rises quickly at first and then levels off: a gentle 10° slope already puts 17% of the load on the rope, 45° puts 71%, and 60° puts 87%. Past about 60°, the rope holds most of the load, and the slope is doing little more than steering it."
  - **Checker:** inclines/page.tsx:29 says "Like cos on Two anchors, sin starts slowly". Two anchors (two-anchors/page.tsx:242) describes cos falling "slowly at first and then faster". sin does the opposite: its slope is 1 at 0° and 0 at 90°. The page's own numbers show it: 0° to 10° adds 17%, while 60° to 90° adds only 13%. So the sentence teaches the wrong shape. "Nearly the whole load" next to 87% at 60° is also loose.
- [x] **misleading**: "the rest presses it into the ground" implies the parts add to the weight. `src/visual/pages/inclines/page.tsx:47`. Raised by: teaching.
  - **Problem:** The text says part of the weight pulls down the slope "and the rest presses it into the ground". That suggests the two parts add up to 100%. The figure's readouts say otherwise: at 30°, "rope holds 50%" and "ground holds 87%", 137% in total. A beginner either thinks the figure is wrong or that the weight has somehow grown. Pulling sideways makes the right point (parts at right angles add up to more than the whole), but this page undoes it.
  - **Fix:** Change to: "Part of the load's weight pulls it down the slope, and another part presses it into the ground. They're at right angles, so as on Pulling sideways they add up to more than the weight. The rope only holds the part down the slope: half the load at 30°." Optionally relabel the readout "presses into ground".
  - **Checker:** inclines/page.tsx:47 says "Part of the load's weight pulls it down the slope, and the rest presses it into the ground". 'The rest' implies the two parts add to 100%. The figure's readouts are "rope holds" sin θ and "ground holds" cos θ (figure.tsx:33-34), which at 30° show 50% and 87%. That contradicts 'the rest' and undoes the point made on Pulling sideways.
- [x] **minor**: "The rope holds only part of the load" has no warning against rigging lighter for slopes. `/Users/awestphal/projects/avut-project/avut-physics/src/visual/pages/inclines/page.tsx:47`. Raised by: practice.
  - **Problem:** The headline and the end-page summary ("On a slope, the rope holds only part.", the-end/figure.tsx line 22) teach that at 30° the rope holds half the load. In the field, slope angles change along the route, a stretcher can come off the ground over a step or a lip, and attendants may suddenly put their weight on it. Rescue practice is to rig for the full load whatever the angle. Surface friction warns against counting on friction, but nothing warns against counting on the slope.
  - **Fix:** Add to the inclines More drawer: 'Rig as if the load might hang free: a slope can steepen, or the load can come off the ground over a step or lip, and then the rope holds all of it.'
  - **Checker:** surface-friction has a 'Don't count on it' section about friction, but inclines has nothing like it about the slope. The headline 'the rope holds only part of the load' and the end-page line could lead someone to rig lighter on a slope. In practice you rig for the full load, because the slope changes and the load can come off the ground. It is a practice point, not a physics error, so minor.
- [x] **suggestion**: "rope holds" + "ground holds" readouts add to more than 100%. `src/visual/pages/inclines/figure.tsx:33`. Raised by: physics.
  - **Problem:** At 30° the readouts show 50% and 87%. Both are right as parts of the weight that meet at a square corner, but a beginner reading "holds" will expect the two shares to add to 100% and may think something is wrong.
  - **Fix:** Relabel the second readout "ground pushes back", or add to the More drawer: "The two parts meet at a square corner, so they add like arrows, not like numbers."
  - **Checker:** Confirmed: at 30° the readouts show 50% and 87% (figure.tsx:33-34), and "holds" invites readers to expect the two to add to 100%. The More drawer mentions the square corner but doesn't say the shares don't add like numbers.

### surface-friction

- [x] **minor**: "If the grip is more than the part down the slope" mixes a ratio with a force. `src/visual/pages/surface-friction/page.tsx:39`. Raised by: physics, teaching.
  - **Problem:** "Grip" was just defined as μ, a share. Here it is compared with a force (W sin θ). What is actually compared is the most friction can give, μW cos θ.
  - **Teaching reviewer adds:** "If the grip is more than the part down the slope" compares μ, which the page defines as a share, with a force. What's meant is the friction μW cos θ against the part W sin θ. The sentence then uses "the angle whose tan is μ", but tan has never been introduced; only sin and cos have.
  - **Fix:** "If the most the ground can grip, μW cos θ, is more than the part down the slope, the load holds itself..." (or in words: "If the most friction can give is more than the part down the slope...").
  - **Checker:** "Grip" was defined a few lines earlier as μ, a share, and line 39 then compares it with a force. The meaning is recoverable, but the wording is loose.

### levers

- [x] **suggestion**: Push arrow silently capped at 2.5 kN. `src/visual/pages/levers/figure.tsx:31`. Raised by: physics.
  - **Problem:** The arrow is limited to LONGEST = 150 units (2.5 kN at 60 units per kN). With the pivot past about 1.43 m, the readout keeps rising (up to 9 kN at 1.8 m) but the arrow stops growing. FallDrawing shows an "off the scale" note in the same situation; this figure doesn't.
  - **Fix:** When push \* PER_KN > LONGEST, draw a Note "off the scale" next to the push arrow, as FallDrawing does.
  - **Checker:** The arrow is capped at min(push\*60, 150), which is 2.5 kN, reached with the pivot at about 1.43 m. Past that, the readout keeps rising to 9 kN at 1.8 m but the arrow doesn't grow. common/fall.tsx shows an "off the scale" note in the same situation; levers doesn't. The readout stays correct, so this is cosmetic.

### safety-factors

- [x] **misleading**: 22 kN rating is presented as what rescue gear is built to, because of 10:1. `/Users/awestphal/projects/avut-project/avut-physics/src/visual/pages/safety-factors/page.tsx:62`. Raised by: practice.
  - **Problem:** The headline text says "Rescue gear aims to hold ten times its load ... So karabiners and pulleys are rated at about 22 kN", and the More drawer (lines 15-18) says "Rescue karabiners and pulleys are typically rated at 22 kN or more". Ratings don't come from a 10:1 rule. 22 kN is roughly what a typical aluminium EN 362 or climbing karabiner is rated. Gear built for rescue is usually rated much higher: NFPA 1983 General Use carabiners must hold at least 40 kN (CMC 3-sigma tech sheet, https://www.cmcpro.com/wp-content/uploads/wd/technical_reports/TechSheet-3SigmaExplained.pdf), and G-rated rescue pulleys such as the Petzl RESCUE are rated 36 kN (https://www.petzl.com/US/en/Sport/Pulleys/RESCUE). NFPA built its G ratings around 15:1 on a heavier design load of about 2.7 kN (600 lb). As written, the page teaches that a 22 kN climbing karabiner is 'rescue rated' and that the rating automatically gives you the safety factor.
  - **Fix:** Present 10:1 as a target the rigger sets, not a property of the gear. Retitle to something like 'Aim for ten times the load'. Text: 'A two-person rescue load weighs about 2 kN. Many teams aim for a safety factor of 10:1, so every part should hold at least 20 kN. Check each item's rating: a basic 22 kN karabiner only just clears it, while rescue-rated karabiners and pulleys are usually rated 30–40 kN or more.' In the drawer, mention that some standards (NFPA) use 15:1.
  - **Checker:** Line 62 says 'Rescue gear aims to hold ten times its load ... So karabiners and pulleys are rated at about 22 kN'. That makes the rating sound like a result of a 10:1 rule, which it isn't. 22 kN is roughly the floor for an EN 362 or climbing karabiner. NFPA G-rated karabiners must hold 40 kN or more, and rescue pulleys are about 36 kN. Some EN aluminium karabiners sold for rescue are rated 25–28 kN, so the More drawer's '22 kN or more' can be defended. The 'So' in the headline is the real flaw. I've rated it misleading rather than error because it's about how the numbers are framed, not wrong physics.
- [x] **misleading**: Says 10:1 'covers' angles, knots and shock loads, which contradicts how system safety factors are worked out. `/Users/awestphal/projects/avut-project/avut-physics/src/visual/pages/safety-factors/page.tsx:21`. Raised by: practice.
  - **Problem:** "Why ten times?" says the factor covers the gap from shocks, angles at spread anchors and redirects, and knots and edges. But a static system safety factor (SSSF), as taught in Rigging for Rescue and the CMC manual, is worked out after those are already accounted for: the weakest link's strength (with knot and bend losses taken off) divided by the force it actually carries (angles included). The page's own 'The weakest link' section (lines 46-52) says exactly this, so the two sections disagree. The 'Shocks' bullet is also wrong in practice. A static factor doesn't cover falls: the next page shows a 1 m fall stopped over 5 cm putting 21 kN on 100 kg, which uses up all of a 22 kN rating. Falls are handled by belay design and fall-arrest testing, not by the static factor. A reader could believe a 10:1 rig is safe with a wide anchor angle, knotted rope and some slack in it. Rigging Lab Academy's discussion of SSSF (https://rigginglabacademy.com/key-safety-factors-rope-rescue/) also notes that teams use different values (4:1, 7:1, 10:1, the legacy 15:1).
  - **Fix:** Limit the list to unknowns: wear and unseen damage, misuse, small jerks while hauling, and error in estimating the load. Move angles, knots and edges into 'The weakest link': take knot and edge losses off the strength, use the real force including angles, then check for 10:1. Replace the fall part of the Shocks bullet with: 'A static factor doesn't cover a fall onto the system (see the next page): keeping slack out and using a belay is what covers that.'
  - **Checker:** The 'Why ten times?' list says the factor covers angles and knots (lines 33-38). 'The weakest link' (lines 46-52) then says to check each part against the force it actually carries, which already includes angles. The two sections disagree. The Shocks bullet includes 'a fall onto the system', but the next page shows a 1 m fall stopped over 5 cm putting 21 kN on 100 kg. That uses up a 22 kN rating, so a static factor clearly doesn't cover falls. Wear, misuse and small dynamic bumps are fair things for the factor to cover.
- [x] **minor**: Headline implies gear ratings come from 10:1 and that the gear guarantees it. `src/visual/pages/safety-factors/page.tsx:61`. Raised by: physics, teaching.
  - **Problem:** The title says "Gear is built to hold ten times the load", and the text ends "So karabiners and pulleys are rated at about 22 kN." That presents the 22 kN rating as derived from 10 × 2 kN, and the safety factor as something the gear gives you. In fact 20 to 22 kN is a product standard minimum (EN 362, etc.). The safety factor belongs to the team's system and depends on what each part actually holds. The series' own pages show the gap: an anchor pulley with the rope doubled back holds 2W = 4 kN, so a 22 kN pulley there gives 5.5:1, and a 1 m fall stopped over 5 cm gives about 21 kN. The end page repeats the claim as "Gear holds ten times the load." (the-end/figure.tsx:23).
  - **Teaching reviewer adds:** The headline "Gear is built to hold ten times the load" reads as if the gear guarantees this. Really, a safety factor is something the person building the system aims for, and it depends on what each piece actually holds. The page also writes the factor as "10:1" and "11:1", the same notation the last eight pages used for mechanical advantage (3:1, 5:1, 2.7:1). A beginner can easily read "10:1" as a pulley ratio or think the two are related.
  - **Fix:** Retitle as "Rig for ten times the load" (or similar). In the text, change the last sentence to "Rescue karabiners and pulleys are typically rated at 22 kN or more, just over ten times a 2 kN load." In the-end, use "Aim for every part to hold ten times what it carries." Optionally, add to The weakest link: "a 22 kN pulley on the anchor with a 2 kN load doubled round it holds 4 kN, so that part is only 5.5:1."
  - **Checker:** The More drawer already says gear is "typically rated at 22 kN or more" and has a weakest-link section noting an anchor pulley can hold twice the load. So the main point is partly covered, and this is less than misleading. Still, the headline (line 61), the summary's "So karabiners and pulleys are rated at about 22 kN", and the-end's "Gear holds ten times the load" present the safety factor as something the gear guarantees. It actually depends on what each part carries in the rig.

### shock-loading

- [x] **minor**: Readout turns pink past 6 kN without explanation on the page. `src/visual/pages/shock-loading/figure.tsx:60`. Raised by: teaching.
  - **Problem:** The "rope pulls" readout changes colour above 6 kN, here and on Rope stretch. Only the Shock loading drawer explains why (6 kN is roughly where fall arrest starts to injure). A reader who doesn't open the drawer sees a colour change with no meaning, and on Rope stretch it's never explained at all.
  - **Fix:** When pink, change the readout label to e.g. "rope pulls, on 100 kg: enough to injure". Or mention 6 kN in one clause of each page's text, e.g. Rope stretch: "…so even a short fall onto it hits hard: past 6 kN, enough to injure."
  - **Checker:** shock-loading/figure.tsx:60 and rope-stretch/figure.tsx:65 turn the readout pink past 6 kN. Only the Shock loading drawer (line 37-38) explains it, and Rope stretch never does.
- [x] **suggestion**: Zero fall gives 1× weight here but 2× on Rope stretch. `src/visual/pages/shock-loading/figure.tsx:32`. Raised by: physics.
  - **Problem:** With the Fall slider at 0, stoppingForce gives W(1 + 0/d) = W, so the figure says a load that hasn't fallen is stopped with just its weight. The next page states that "even with no fall at all, a load dropped onto a slack-free rope pulls with twice its weight". The even-stop model can't describe a drop from rest: an even pull of W never speeds the load up, so there is nothing to stop over d. Readers who compare the two figures at 0 m will see a contradiction.
  - **Fix:** Start the Fall slider at 0.1 m, or add to the More drawer: "With no fall, there's no speed to take away, so this model gives just the weight; the next page shows a real rope still briefly pulls harder."
  - **Checker:** Confirmed: with Fall at 0, F = W(1 + 0/d) = 1 kN, while Rope stretch says a load dropped with no fall pulls with twice its weight. The More drawer already says a real stop's peak is higher than the even-stop figure, which softens this, so it's a suggestion rather than minor.
- [x] **suggestion**: "20 kN rating" here vs "22 kN" on Safety factors. `src/visual/pages/shock-loading/page.tsx:38`. Raised by: physics.
  - **Problem:** Safety factors builds its case on 22 kN gear, and this page then says "a 20 kN rating is soon used up". It's a small inconsistency a careful reader may notice.
  - **Fix:** Use "a 22 kN rating" to match Safety factors.
  - **Checker:** It's a small inconsistency with Safety factors' 22 kN, though 20 kN is also a real standard minimum, and Safety factors itself says ten times 2 kN is 20 kN. The point stands either way, and it's trivial to change.
- [x] **suggestion**: Doesn't link shock loads to belay practice and the drop test. `/Users/awestphal/projects/avut-project/avut-physics/src/visual/pages/shock-loading/page.tsx:42`. Raised by: practice.
  - **Problem:** The physics is sound, but the page stops at 'keep slack out'. Rescue practice handles falls with a separate belay line and belay devices that slip to limit the force. The standard check is the belay competence drop test (BCDT, now ASTM F2436): a 200 kg load dropped 1 m on 3 m of rescue rope must be stopped within 1 m of extra travel with a peak under 15 kN (see CMC 540 Rescue Belay, https://www.cmcpro.com/equipment/traverse-540-rescue-belay/). That ties the page's sliders straight to a number rescuers already know.
  - **Fix:** Add a section: 'Rescue belays are tested for exactly this: 200 kg dropped 1 m onto 3 m of rope must stop within about 1 m more, pulling under 15 kN. The belay lets the rope slip a little, stretching out the stop as the slider does.'
  - **Checker:** The shock-loading drawer stops at 'keep slack out'. The belay competence drop test (200 kg, 1 m drop on 3 m of rope, stop within about 1 m, peak under 15 kN) is a well-known benchmark and ties directly to the stopping-distance slider. Not every NZ team uses ASTM terms, so keep the citation light.

### rope-stretch

- [x] **minor**: Rope length (2 m) isn't shown, and "dropped with no fall" contradicts itself. `src/visual/pages/rope-stretch/figure.tsx:11`. Raised by: teaching.
  - **Problem:** The figure always uses 2 m of rope, but neither the page nor the figure says so. The drawer then says length matters (fall factor), so a reader can't connect the readouts to it. The drawer's "Even with no fall at all, a load dropped onto a slack-free rope pulls with twice its weight" (page.tsx line 36) contradicts itself: it says "dropped" and "no fall" in the same sentence.
  - **Fix:** Slider label: "Fall before 2 m of rope comes tight". Drawer: "Even with no fall at all, a load let go suddenly onto a rope that's just come tight pulls with twice its weight for a moment."
  - **Checker:** rope-stretch/figure.tsx:13 fixes LENGTH = 2 m, but no label or text says so (the slider label is 'Fall before the rope comes tight'). The drawer's fall-factor section mentions '2 m of rope' only as an example. Drawer line 36, 'a load dropped onto a slack-free rope … with no fall at all', is self-contradictory wording.
- [x] **minor**: Calls rescue rope "static" without mentioning the usual names, low-stretch or semi-static. `/Users/awestphal/projects/avut-project/avut-physics/src/visual/pages/rope-stretch/page.tsx:51`. Raised by: practice.
  - **Problem:** EN 1891 covers 'low stretch kernmantel ropes', and gear catalogues and many NZ courses call them low-stretch or semi-static. The page itself says they stretch 3-4%. 'Static' alone suggests they don't stretch at all, which is the opposite of what the page then shows.
  - **Fix:** Change it to 'Rescue ropes are low-stretch (often called static or semi-static): they stretch only a few percent ...'.
  - **Checker:** EN 1891's title is 'low stretch kernmantel ropes'. The same sentence goes on to say they stretch a few percent, so the harm is small. Adding the name 'low-stretch' still helps readers match the page to the gear they use.
- [ ] **suggestion** (uncertain): Spring model gives implausible static-rope stretch; caveat doesn't say which way the error goes. `src/visual/pages/rope-stretch/page.tsx:62`. Raised by: physics.
  - **Problem:** Defaults: a 1 m fall on 2 m of rope at 3% per kN gives F = 1 + √(1 + 2·16.7·1) ≈ 6.86 kN and x ≈ 0.41 m. That is about 20% elongation of a static rope, roughly two to three times what real static rope stretches at about 7 kN. The cause is extending the 50 to 150 kg slope in a straight line; real rope stiffens. A stiffer rope gives a higher peak (doubling k gives about 9.2 kN here). The caveat lists stiffening, heat and repeat loading, but doesn't say the stiffening means the real pull could be higher than shown, and readers may take the "41 cm" readout at face value.
  - **Fix:** Optionally add: "Real static rope stiffens, so at hard pulls it stretches less than the figure shows. That alone would make the pull higher, though knots and heat take some back." Consider labelling the stretch readout as the spring model's figure.
  - **Checker:** The arithmetic is right: F ≈ 6.86 kN and x ≈ 0.41 m, about 20% of the 2 m rope. Extending the 50 to 150 kg slope in a straight line does overstate stretch at high pulls. But the direction of the peak-force error is not clear-cut. Stiffening raises the peak, while heat loss and knots tightening lower it, and the model gives about 5.6 kN at fall factor 0.3, in line with the EN 1891 limit of 6 kN or less. The caveat already names stiffening and says to treat the numbers as a guide. It's a small, optional improvement.

### the-end

- [x] **misleading**: Summary gives counting as the way to find advantage, without its limit. `src/visual/pages/the-end/figure.tsx:19`. Raised by: physics, teaching.
  - **Problem:** "Count the parts that get shorter for the advantage" is the method the series itself shows fails on compound systems (Counting, T method on a compound). As the one-line takeaway, it may stick without the caveat.
  - **Teaching reviewer adds:** The take-away list says "Count the parts that get shorter for the advantage." The series spends two pages (compound, t-method-compound) showing that counting gets the 6:1 wrong. A reader who only remembers the summary takes away a rule that fails on compound systems. The same list also says "Gear holds ten times the load" (line 23), which states as fact what is only a design aim, and only for rated, undamaged gear.
  - **Fix:** "Count the parts that get shorter in a simple system; the T method works on anything."
  - **Checker:** The Counting page itself scopes counting to simple systems, and T method on a compound shows counting failing, but the one-line summary on the-end drops that limit. Worth tightening, since the summary is what readers keep.
- [x] **misleading**: Takeaway "Gear holds ten times the load" states a target as a guarantee. `/Users/awestphal/projects/avut-project/avut-physics/src/visual/pages/the-end/figure.tsx:23`. Raised by: practice.
  - **Problem:** The summary line reads as if any gear automatically holds ten times whatever is on it. In practice 10:1 is a target the rigger has to check part by part against the force each part actually carries; an anchor pulley or a wide anchor angle can take a 22 kN item well below 10:1. This is the line a reader is most likely to remember.
  - **Fix:** Change it to 'Aim for every part to hold ten times what it carries.'
  - **Checker:** the-end/figure.tsx line 23 reads 'Gear holds ten times the load.' That states a target as a guarantee, and it's the line readers are most likely to remember. An anchor pulley carrying twice the load already halves the factor.
- [ ] **suggestion**: Take-away list leaves out several big ideas. `src/visual/pages/the-end/figure.tsx:7`. Raised by: teaching.
  - **Problem:** The list has nine ideas but leaves out the T method, pulling off centre (most in line takes most), levers and anchors (tie low), and rope stretch / fall factor. All of these are practical lessons for the field. The rope-stretch point especially follows on from "Falling doesn't hurt; stopping does".
  - **Fix:** Add a few lines, e.g. {slug: "t-method", idea: "For any pulley system, follow the tension: the T method."}, {slug: "levers", idea: "Tie off low on trees and pickets."}, {slug: "rope-stretch", idea: "Static rope catches hard: keep slack out."}
  - **Checker:** The list (the-end/figure.tsx:7-25) leaves out the T method, most-in-line, levers ('Tie low' is levers/page.tsx:40) and rope stretch. These are practical lessons. Note the trade-off with keeping the list short.

### common

- [ ] **suggestion**: Pulley pages show exact pulls without saying the pulleys are perfect. `src/visual/common/haul.tsx:58`. Raised by: teaching.
  - **Problem:** The 2:1, Z-rig, 5:1, compound and T method figures label every rope part and the haul readout with exact numbers (0.4 kN, 0.24 kN). The only place that says pulleys are treated as perfect is the Pulley on the anchor drawer ("for now we'll leave that out"). The main texts of the 2:1, Z-rig and T method pages say nothing about it, and Pulley friction only comes after all of them.
  - **Fix:** In the T method text: "A rope keeps its T round every pulley (a perfect one; Pulley friction comes later)." Or add '(perfect pulleys)' to the haul readout label in common/haul.tsx, e.g. `you pull, for a ${LOAD_KN} kN load, perfect pulleys`.
  - **Checker:** The only 'perfect pulley' caveat is in the Pulley on the anchor drawer (lines 32-33). The 2:1, Z-rig, 5:1, compound and T method figures show exact pulls with no note on the page. The 5:1 drawer mentions friction, but its main text doesn't. Worth one clause.
- [x] **suggestion**: The working load changes from page to page. `/Users/awestphal/projects/avut-project/avut-physics/src/visual/frame.tsx:70`. Raised by: practice.
  - **Problem:** The pulley pages use 1.2 kN ('one person and their gear', LOAD_KN). Safety factors and Pulling off centre use 2 kN as the two-person rescue load. Shock loading, Rope stretch and Levers use 100 kg. The safety factors page tells readers the rescue load is 2 kN, but the shock pages then show forces for half of that. A reader comparing the 21 kN shock with the 22 kN rating may not realise a real two-person load would roughly double the shock.
  - **Fix:** Add to Shock loading's 'How hard is too hard': 'A two-person rescue load, 200 kg, pulls about twice as hard as these numbers.'
  - **Checker:** The loads do vary from page to page (1.2 kN, 2 kN, 100 kg), but each readout is labelled: 'rope pulls, on 100 kg', 'for a 1.2 kN load'. The shock page's text says '21 kN on 100 kg' explicitly. The force does scale with the load, so the 'roughly double' remark is right. This is a nice-to-have, not an inconsistency that misleads, so suggestion.

## Refuted

- common: The example load keeps changing between pages (teaching). The checker said: Each example load has a reason, and the readouts mostly state it already: 'you pull, for a 1.2 kN load' (haul, friction), 'rope pulls, on 100 kg' (shock, stretch), 'you push, for 100 kg' (levers), 'y, weight' in kN (pulling sideways), safety factors' 'mass, at 10 N/kg'. Standardising would mean reworking most figures and worked numbers (e.g. 1.8/2.4/3 kN Pythagoras) for little gain. The 'already done' alternative the reviewer offers is largely in place.

## What each reviewer covered

- **physics-1:** Read in full: src/visual/common/mechanics.ts, mechanics.test.ts, triangle.tsx, grid.tsx, details.tsx, track.tsx, slope.tsx, fall.tsx, haul.tsx and pulley-forces.tsx. Also read page.tsx and figure.tsx for introduction, velocity, acceleration, mass, force, weight, units, arrows, adding-arrows, equilibrium, splitting-arrows, pulling-sideways, two-anchors, pulling-off-centre (and its rig.ts) and redirect. Checked the helpers the figures depend on: legShare, redirectShare, swungDown and tiedOff in src/articles/gentle-introduction.ts, Arrow and AngleArc in src/components/diagram/svg.tsx (AngleArc uses screen angles, clockwise positive), and percent, kN and LOAD_KN in frame.tsx.

Numbers recomputed and found correct:

- 3 kN at 37° gives 1.805 and 2.396 kN.
- Pythagoras example: 3.24 + 5.76 = 9.
- Pulling-off-centre angles: α = 30°, β = 48.7°; T_left = 1.53 kN and T_right = 1.02 kN (the total is the one finding).
- Moon gravity is 17% of Earth's; rounding g to 10 adds 1.9%.
- Speed conversions in Velocity's drawer.
- The slope parts add back to the weight tip to tail.
- The ropeCatch and stoppingForce energy balances.

Checked the y-flip and arrow directions in every figure in scope. The rope's pull on the load points to the anchor; redirect forces point away from the anchor; pulley-forces is drawn correctly both ways up. The tiedOff slack case was checked at the slider's ends (offset ±0.8 m, swing ±60°): the slack rope always ends up shorter than its length, so it really is slack.

Not checked: pages after redirect, other than the shared figures in common/ (whose maths and directions were checked, but not how their pages use them); card.tsx and series.ts beyond a glance. Nothing was rendered in a browser, so the clipping findings come from working out viewBox coordinates, not from seeing them.

- **physics-2:** Read in full: page.tsx and figure.tsx for pulley-on-the-anchor, 2-to-1, z-rig, 5-to-1, counting, compound, t-method, t-method-compound, friction, inclines, surface-friction, levers, safety-factors, shock-loading, rope-stretch and the-end. Also src/visual/common/{mechanics.ts, mechanics.test.ts, haul.tsx, pulley-forces.tsx, slope.tsx, fall.tsx, track.tsx}, src/articles/pulley-systems.ts, and the label and T code in src/articles/pulley-figures.tsx. Computed numerically with tsx from the scratchpad (no repo files edited): every system's ideal and 90%-efficiency advantage, tensions, sling pulls, load-per-metre and part counts (REDIRECT 1, 2:1 2, 2:1↓ 2, Z 3 / 2.71, 5:1 5 / 4.10, 6:1 6 / 5.15, anchor pulleys 2T and 1.71T). These match every number in the text and the friction table. Recomputed by hand: inclines percentages, atan(0.4) = 21.8°, lever 0.33 kN and the 30 cm → 10 cm example, shock factors 6× and 21×, ropeCatch defaults (6.86 kN, 41 cm) and FF 0.3 (5.6 kN), and the dynamic rope 10%/kN figure. Checked the slope drawing's component vectors add back to the weight, and the PulleyForces arrows are drawn to one scale. Not checked: SystemDrawing's full rendering and drawing geometry in pulley-figures.tsx beyond the labels; pages were not viewed in a browser.
- **teaching:** Read every page.tsx for all 31 pages in order (introduction through the-end), including all More drawers, plus pages/index.ts and series.ts. Read every figure.tsx in full. Read the shared figure code: common/haul.tsx, track.tsx, grid.tsx, details.tsx, slope.tsx, fall.tsx, mechanics.ts and frame.tsx. Scanned card.tsx and pulley-forces.tsx for user-facing strings, and grepped src/articles/pulley-figures.tsx to confirm the rope grab is drawn green. Checked the arithmetic of the worked numbers (splitting 3 kN at 37°, the off-centre sine-rule example, friction tables, lever, shock and stretch formulas, the tan 22° claim) and grepped for US spellings (none found in page text). Not done: the pages were not viewed in a browser, so layout and how the figures look at phone width are unchecked; triangle.tsx, pulley-forces.tsx drawing geometry and mechanics.test.ts were not reviewed in depth; physics in src/articles (pulley-systems, gentle-introduction helpers) was not reviewed beyond its use here.
- **practice:** I read the page.tsx of all 31 pages (introduction through the-end) in full. I read the figure.tsx of every page from two-anchors onward: two-anchors, pulling-off-centre (and rig.ts), redirect, pulley-on-the-anchor, 2-to-1, z-rig, 5-to-1, counting, compound, t-method, t-method-compound, friction, inclines, surface-friction, levers, safety-factors, shock-loading, rope-stretch and the-end. I also read common/haul.tsx, common/mechanics.ts, common/fall.tsx, frame.tsx, the series name in series.ts, the start of card.tsx, the system definitions and pullsOf/partsOnTheLoad in src/articles/pulley-systems.ts, and src/articles/gentle-introduction.ts (legShare, redirectShare, tiedOff). I also searched src/visual for progress capture, belay, prusik and edge terms.

Not checked:

- The figure.tsx of the early pages (velocity to splitting-arrows). I only read their text.
- common/slope.tsx, pulley-forces.tsx, track.tsx, grid.tsx and triangle.tsx, and src/articles/pulley-figures.tsx (how SystemDrawing draws the rigs).
- Nothing was viewed in a browser: the Chrome DevTools profile was already in use by another session, so how the rigs look on screen wasn't checked.

Spot checks (by hand, no errors found): the numbers in two-anchors, pulling-off-centre, the friction table, surface friction's 22°, levers, shock loading and rope stretch.

Web checks:

- NFPA General Use carabiner ≥40 kN: CMC 3-sigma tech sheet.
- Petzl RESCUE pulley rated 36 kN.
- The drop test (200 kg, 1 m drop on 3 m of rope, under 15 kN): CMC 540 product pages.
- No universal SSSF (4:1, 7:1, 10:1, legacy 15:1): Rigging Lab Academy.

I couldn't find a published NZ (FENZ or LandSAR) SSSF or test-load figure online; NZQA unit standard 20537 names SSSF without giving a number. So NZ-specific conventions weren't confirmed.
