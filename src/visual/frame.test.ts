import { describe, expect, it } from "vitest";

import { fraction } from "./frame";

describe("fraction", () => {
    it("writes whole numbers plainly", () => {
        expect(fraction(1)).toBe("1");
        expect(fraction(2)).toBe("2");
    });

    it("writes a pulley system's shares as fractions in their smallest terms, despite rounding", () => {
        expect(fraction(1 / 2)).toBe("1/2");
        expect(fraction((1 / 3) * 2)).toBe("2/3");
        expect(fraction(1 / 6)).toBe("1/6");
        expect(fraction(0.4)).toBe("2/5");
        expect(fraction(3 / 2)).toBe("3/2");
    });

    it("gives any other share to 0.01", () => {
        expect(fraction(1 / 2.71)).toBe("0.37");
    });
});
