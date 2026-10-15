import type { Figures } from "./standing-body-belays.compute";
import saved from "./standing-body-belays.figures.json";

/*
 * The standing body belays article's figures, as saved by `npm run figures` from standing-body-belays.compute.ts:
 * the article reads them rather than solving as the site builds.
 */

export const FIGURES: Figures = saved.figures;
export const { defaults: DEFAULTS } = FIGURES;
