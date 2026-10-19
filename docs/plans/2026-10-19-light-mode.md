# Light mode: colour tokens, a light theme and a toggle; print uses the light theme

**Date:** 2026-10-19
**Branch:** `feat/light-mode`
**Written against:** main @ df90dae
**Scope:** review groups 1 and 2 are to be built now. Review group 3 (the light theme itself) is deferred until we
decide we want a light mode; it's written out here so stage one is built with it in mind.

## Decisions

- **The work comes in two stages: tokens first, then the light theme.** Every colour moves to a named token whose
  dark value is exactly today's colour, so stage one changes nothing on screen and can be checked by comparing pages
  before and after. Only then do the tokens get light values and the site a toggle. Mixing the two would make it
  impossible to tell a migration mistake from a light-theme choice.
- **Stage one is worth having on its own.** Even if a light mode never comes, the colours end up named once in
  `globals.css` rather than repeated as about 160 hex values and 340 palette classes. The same quantity then has the
  same colour everywhere, and changing one is a single edit.
- **Tokens are named for their role, not their colour.** The site's chrome uses the shadcn names that already exist
  (`background`, `foreground`, `card`, `muted-foreground`, `border`, `primary`). Drawings get their own: `ink`
  (`#e2e8f0`), `ink-strong` (`#f1f5f9`), `ink-soft` (`#cbd5e1`), `ink-muted` (`#94a3b8`), `ghost` (`#64748b`), `line`
  (`#475569`), `line-faint` (`#334155`), `surface` (`#0f172a`), `surface-raised` (`#1e293b`) and `halo` (the
  `paint-order` outline behind `Label`, `#0f172a`). Each quantity drawn gets one too: `load`, `pull`, `sideways`,
  `redirect` (from `src/articles/colors.ts`), and the rest of the 28 distinct hex values in the visualisations (beam
  and wall tension, weight, bar, hinge, contact, hold, warning, timber…), with the same hue for the same meaning
  sharing one token. The CSS variables are defined in `globals.css` and registered in `@theme inline` as
  `--color-<name>: var(--<name>)`, so `text-ink-muted`, `fill-surface` and `stroke-line` work as Tailwind classes.
  SVG attributes use the base name (`var(--ink-muted)`), since Tailwind only outputs a `--color-*` variable once a
  class uses it. The full list, as Task 1 settled it, is in `globals.css`; the second rope's token is
  `--rope-tension` (class `text-rope`), because `.rope-range` already takes a `--rope` per slider.
- **A token's dark value is exactly what it replaces.** Drawing tokens hold the hex the drawings use today. Tokens
  that replace accent classes in later tasks (links, warnings, the "In short" box) hold Tailwind's own variable, such
  as `var(--color-sky-400)`, because v4's palette is defined in oklch and its accents differ visibly from the v3 hex
  values (sky-400 is `#38bdf8` in v3, about `#00bcff` in v4). The slate neutrals are the one place a class and a hex
  value share a token: there the two differ by at most 4/255 per channel, which can't be seen.
- **Today's colours don't always match their meaning, and stage one keeps them anyway.** Friction is orange in the
  visual introduction (`friction`) but pink on the incline (`incline-friction`); several unrelated quantities share
  a hue (`pull`, `normal` and `anchor-a` are all sky). They get separate tokens with today's values, so the light
  pass can tidy them without hunting through drawings.
- **We won't redefine the slate scale.** Redefining `--color-slate-*` in light mode would flip every existing
  class with no migration, but `text-slate-300` would then mean dark text, and every later edit would have to know
  that.
- **SVG attributes take `var(--…)` strings.** The palette objects (`COLORS` in `src/articles/colors.ts` and the
  per-file objects such as `ladder-hinge.tsx:24-31`) become `{ load: "var(--load)", … }`. Nothing does arithmetic on
  colour strings (no `${color}80`, no hex parsing), so callers don't change. Presentation attributes accept `var()` in
  current Chrome, Firefox and Safari. Task 1 confirms that before anything depends on it. If it fails in any of
  them, the fallback is `style={{ fill: … }}` in the SVG primitives.
- **The share image keeps its own literal colours.** `src/visual/share-image.tsx` is drawn by `next/og`, which can't
  resolve CSS variables, and it's one fixed picture whatever the viewer's theme. It gets a local hex palette (today's
  dark values), and stops importing `COLORS`.
- **The control is AVUT's three-way one: Light, Dark, System.** It's AVUT's `src/components/nav/mode-toggle.tsx`:
  a ghost icon button (sun or moon, depending on the theme showing) that opens a dropdown with a radio group of the
  three choices. AVUT runs it on `next-themes` (`^0.4.6`), with `ThemeProvider` set to `attribute="class"`,
  `defaultTheme="system"`, `enableSystem` and `disableTransitionOnChange`
  (`src/components/providers/root-providers.tsx`). This site uses the same, so the two behave alike.
  `next-themes` saves the choice to `localStorage`, follows `prefers-color-scheme` under System (including changes
  while the page is open), and sets the class from an inline script before the page first draws. That's the
  technique in `node_modules/next/dist/docs/01-app/02-guides/preventing-flash-before-hydration.md` ("Themes"). A
  cookie would let the server read the choice, but reading cookies in the root layout stops every page being
  prerendered. This site has no `dropdown-menu`, so the build adds shadcn's (AVUT's
  `src/components/ui/dropdown-menu.tsx`; `radix-ui` is already a dependency). AVUT is on Next 16.3 and React 19.2,
  and this site on 16.4 and 19.3, so Task 8 confirms `next-themes` gives no hydration or script warnings here.
- **System is the default.** Until someone chooses, the site follows the device's setting.
- **Printing uses the light theme.** The `.dark` token block goes inside `@media screen`, so a printout always gets
  the light values. The article `print:` colour overrides (`print:**:text-black`, `print:fill-white`,
  `print:border-black`, `print:bg-transparent`…) then do nothing extra and come out. Layout ones (`print:hidden`,
  `print:break-inside-avoid`, `print:px-0`, `print:text-[11pt]`) stay.
- **The toggle sits in the site footer, and in the visual introduction's contents drawer.** The footer is hidden on
  `/visual/*` pages, which fill the screen, so those pages need their own place for it.

## Tasks

### Review group 1: tokens and shared pieces

- [x] **1. Colour tokens** — Add colour tokens for the site and its drawings
  - **Files:** `src/app/globals.css`
  - **Do:**
    - Add the drawing and quantity tokens from Decisions to the `.dark` block, with today's hex values, and register
      each in `@theme inline`. Give each group a short comment saying what it's for.
    - Use them in `globals.css` itself: the scrollbar colours and the `.rope-range` track and thumb.
    - While the dev server is running, check by hand that a `<line stroke="var(--load)">` draws in Chrome, Firefox
      and Safari, and record the result in this plan.
    - **Result (2026-10-19):** fills and strokes given as `var(--…)` attributes on `line`, `rect` and `text` compute to
      the variable's colour in Chrome 153 and Safari 18.6. Firefox isn't installed on this Mac, so it's unchecked:
      after Task 2, open a visual page in Firefox; if its arrows and labels draw black, switch the primitives to
      the `style` fallback.
  - **Done when:** pages look as before (scrollbar and rope sliders included), and `var()` in an SVG attribute is
    confirmed in all three browsers. Type check, lint and `npm test` pass.

- [x] **2. Shared primitives and palettes** — Draw the shared diagram pieces with colour tokens
  - **Files:** `src/components/diagram/svg.tsx`, `src/components/diagram/controls.tsx`, `src/visual/frame.tsx`,
    `src/articles/colors.ts`, `src/visual/share-image.tsx`, `src/components/tex.tsx`
  - **Do:**
    - `svg.tsx`: the `AngleArc` and `Label` defaults and `Label`'s halo stroke become tokens.
    - `frame.tsx`: `Readout`'s default colour and background, `SVG`, and `GHOST` become tokens.
    - `controls.tsx`: its slate and sky classes become token classes (it has the most in `src/components`, about 29).
    - `colors.ts`: `COLORS` values become `var(--load)` and so on. Its comment notes the values are CSS variables.
    - `share-image.tsx`: a local hex palette replaces the `COLORS` import (see Decisions).
    - `tex.tsx`: `text-slate-300` becomes a token class.
  - **Done when:** the visual introduction, an article and a visualisation look as before, and the shared preview
    image at `/visual/opengraph-image` is unchanged. Type check, lint and `npm test` pass.

_End of review group 1._

### Review group 2: move every page to tokens (visual checkpoint: dark looks unchanged)

- [ ] **3. Visualisations** `mechanical` — Draw the visualisations with colour tokens
  - **Files:** `src/visualisations/{body-belay,four-point-lower,incline,ladder-hinge,multi-point-anchor,two-point-lower,ute-load}.tsx`
    and their `-notes.tsx`, plus `body-belay-maths.tsx`
  - **Do:** follow the pattern from Task 2. The palette object at the top of each file moves to tokens, and so do
    its SVG hex attributes (about 120) and slate and sky classes (about 70). No solver, `src/lib` or `*.compute.ts`
    file changes, so no figure hashes change.
  - **Done when:** every visualisation looks as before, at phone width too. `grep -nE '#[0-9a-fA-F]{3,6}\b'` over
    `src/visualisations/*.tsx` finds nothing. Type check, lint, `npm test` and `npm run test:sweep` pass, and
    `scripts/figures.mjs --check` passes.

- [ ] **4. Articles** `mechanical` — Draw the articles with colour tokens
  - **Files:** `src/articles/{prose,setup-diagram,gentle-introduction-figures,pulley-figures,belayer-forces-diagram,stretcher-weight-graph}.tsx`,
    `src/app/standing-body-belays/page.tsx`, `src/app/gentle-introduction/part-{1,2}/page.tsx`
  - **Do:** as Task 3. Leave every `print:` class as it is. They stay needed until the light theme exists (Task 9).
  - **Done when:** the three articles look as before, on screen and in print preview. `scripts/figures.mjs --check`
    passes. Type check, lint and `npm test` pass.

- [ ] **5. Visual introduction** `mechanical` — Draw the visual introduction with colour tokens
  - **Files:** `src/visual/card.tsx`, `src/visual/share.tsx`, `src/visual/common/*.tsx`, and the `page.tsx` and
    `figure.tsx` in `src/visual/pages/*` that use hex or palette classes (about 20 files; `grep -rlE` from the
    investigation lists them). Local `FAINT = "#64748b"` constants become the `ghost` token.
  - **Do:** as Task 3.
  - **Done when:** every visual page, its contents drawer and its details look as before, at phone width.
    Type check, lint and `npm test` pass.

- [ ] **6. Site chrome, and the convention** — Use colour tokens in the site's chrome, and say so in AGENTS.md
  - **Files:** `src/app/page.tsx`, `src/app/visual/page.tsx`, `src/components/VisualisationPage.tsx`,
    `src/components/SiteFooter.tsx`, `AGENTS.md`
  - **Do:**
    - Move the remaining classes to tokens.
    - In AGENTS.md's code layout section, add that colours come from the tokens in `globals.css`. Components don't
      use hex values or Tailwind palette classes. The exceptions are the share image and `src/components/ui`
      (shadcn's own overlays).
  - **Done when:** a grep for hex literals and `-(slate|sky|amber|…)-` classes over `src` finds only
    `share-image.tsx` and `src/components/ui/*`. The home page and visual index look as before. Type check, lint and
    `npm test` pass.

_End of review group 2._

### Review group 3: the light theme (visual checkpoint) — deferred

Not to be built until we decide we want a light mode. Before picking it up, check the code against this group again,
and update **Written against**.

- [ ] **7. Light values** `visual` — Give every colour token a light value
  - **Files:** `src/app/globals.css`
  - **Do:**
    - Replace shadcn's stock grey `:root` values with light counterparts of the site's slate and sky palette, and
      give every drawing and quantity token a light value. Quantity colours move from the -400 shades to roughly
      -600/-700, enough for text and thin arrows to stay readable on white, about 4.5:1 for text and 3:1 for lines.
      They must stay easy to tell apart.
    - `color-scheme: light` in `:root` and `dark` in `.dark`, so native controls follow.
    - Wrap the `.dark` block in `@media screen` (Decisions: printing).
    - To check it before the toggle exists, remove `dark` from `<html>` in DevTools.
  - **Done when:** with `dark` removed, every page reads clearly: the home page, each visualisation, each article and
    a sample of visual pages. Print preview gives the light theme with nothing dark showing through. Type check, lint
    and `npm test` pass.

- [ ] **8. The three-way control** `visual` — Add a Light, Dark and System theme control
  - **Files:** `package.json`, `src/app/layout.tsx`, `src/components/ui/dropdown-menu.tsx` (new),
    `src/components/ModeToggle.tsx` (new), `src/components/SiteFooter.tsx`, `src/visual/card.tsx`
  - **Do:**
    - Add `next-themes`, and shadcn's `dropdown-menu` (copy AVUT's, or `npx shadcn add dropdown-menu`).
    - `layout.tsx`:
      - Drop the hard-coded `dark` class.
      - Add `suppressHydrationWarning` to `<html>`.
      - Wrap the body's contents in `ThemeProvider` with AVUT's settings (Decisions).
      - Replace `viewport.themeColor`'s single value with a light and a dark one keyed on `prefers-color-scheme`.
        `next-themes` doesn't set `theme-color`, so `ModeToggle` updates the meta when the theme shown differs from
        the system's.
    - `ModeToggle`: AVUT's, unchanged apart from the `theme-color` update and the site's NZ English labels. Its
      dropdown must fit at 400 px and inside the drawer.
    - Put it in `SiteFooter`, and in the visual contents drawer in `card.tsx`.
  - **Done when:**
    - The first load follows the system setting.
    - Choosing Light or Dark switches with no flash, and the choice survives a reload and a client-side navigation.
    - Choosing System goes back to following the device, including a change made while the page is open.
    - A hard reload in the theme the system isn't using shows no flash of the other.
    - There are no hydration or script warnings in the console.
    - The control can be reached on `/visual/*` pages.
    - Type check, lint and `npm test` pass.

- [ ] **9. Print uses the light theme** — Let printing use the light theme instead of its own colours
  - **Files:** the files with `print:` colour classes: `src/articles/{prose,setup-diagram,gentle-introduction-figures,pulley-figures,belayer-forces-diagram,stretcher-weight-graph}.tsx`,
    the three article pages; `globals.css` (the `background: white` in the print block, if the tokens now cover it)
  - **Do:** remove `print:` classes that only set colour (see Decisions). Keep layout ones.
  - **Done when:** print preview of all three articles, started from both themes, matches print preview before this
    group (black text, figures on white, no site chrome). Type check, lint and `npm test` pass.

- [ ] **10. Light-mode pass** `visual` — Tune light-mode colours page by page
  - **Files:** `src/app/globals.css`, and any drawing whose light rendering needs a local fix
  - **Do:**
    - Go through every page in light mode at desktop and phone width (about 400 px): each visualisation, each
      article, and every visual introduction page, with its details and contents drawer.
    - Fix colours that read poorly or clash. Change token values rather than single drawings where you can.
    - Recheck dark mode on any page you touch.
  - **Done when:** every page has been looked at in both themes and at both widths, with notes on anything changed.
    Type check, lint and `npm test` pass.

_End of review group 3._

## Docs impact

Stage one: none outside AGENTS.md, which Task 6 covers. Group 3, if built: one line in the README saying the site has
light and dark themes, with the control in the footer.

## Out of scope

- A light version of the shared preview image.
- Redesigning figures beyond what readability in light mode needs.
- A lint rule banning hex values and palette classes. The grep in Task 6 checks it once; see Parked.

## Parked

- A lint rule (ESLint `no-restricted-syntax` on class strings and hex literals) to keep new code on tokens, if it
  starts slipping.
