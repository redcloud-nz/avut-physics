import { G } from "./constants";
import { deg } from "./math";

/** A force in newtons, to the nearest 10. */
export const newtons = (x: number) => `${Math.round(x / 10) * 10} N`;

/** A force in newtons as the mass it would hold up, in kilograms. */
export const kg = (newtons: number) => `${Math.round(newtons / G)} kg`;

/** An angle in radians, in whole degrees. */
export const degrees = (radians: number) => `${Math.round(deg(radians))}°`;
