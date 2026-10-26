import { describe, expect, it } from "vitest";

import { readout, teaching } from "./format";
import { rad } from "./math";

describe("readout", () => {
    it("shows enough digits to see a value move", () => {
        expect(readout.force(1234.4)).toBe("1234 N");
        expect(readout.forceParts(-12.3, 45.6)).toBe("-12, 46 N");
        expect(readout.angle(rad(12.34))).toBe("12.3°");
        expect(readout.length(1.234)).toBe("1.23 m");
        expect(readout.factor(0.5)).toBe("0.50");
        expect(readout.ratio(2.5)).toBe("2.50 : 1");
        expect(readout.ratio(Infinity)).toBe("∞ : 1");
        expect(readout.percent(0.456)).toBe("46%");
        expect(readout.mass(12.6)).toBe("13 kg");
    });
});

describe("teaching", () => {
    it("rounds to figures worth remembering", () => {
        expect(teaching.force(1234)).toBe("1230 N");
        expect(teaching.kN(0.44)).toBe("0.4 kN");
        expect(teaching.kN(1)).toBe("1.0 kN");
        expect(teaching.massHeldBy(981)).toBe("100 kg");
        expect(teaching.angle(rad(29.6))).toBe("30°");
        expect(teaching.length(2.04)).toBe("2.0 m");
        expect(teaching.speed(7.67)).toBe("7.7 m/s");
        expect(teaching.factor(1.234)).toBe("1.23");
        expect(teaching.percent(0.456)).toBe("46%");
    });

    it("takes more or fewer places where a page asks", () => {
        expect(teaching.kN(0.24, 2)).toBe("0.24 kN");
        expect(teaching.kN(1.2, 2)).toBe("1.20 kN");
        expect(teaching.ratio(2.714, 2)).toBe("2.71:1");
        expect(teaching.mass(2.5)).toBe("3 kg");
        expect(readout.angle(rad(12.34), 0)).toBe("12°");
    });

    it("writes whole ratios without a decimal", () => {
        expect(teaching.ratio(3)).toBe("3:1");
        expect(teaching.ratio(2.98)).toBe("3:1");
        expect(teaching.ratio(2.71)).toBe("2.7:1");
        expect(teaching.ratio(Infinity)).toBe("∞:1");
    });
});
