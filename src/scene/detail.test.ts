import { describe, expect, it } from "vitest";

import { judge, stepDetail } from "./detail";

describe("choosing the detail from the frame rate", () => {
    it("steps down when short and up with room to spare, stopping at the ends", () => {
        expect(stepDetail("medium", "short")).toBe("low");
        expect(stepDetail("low", "short")).toBe("low");
        expect(stepDetail("medium", "spare")).toBe("high");
        expect(stepDetail("high", "spare")).toBe("high");
    });

    it("judges a run of frames by its rate, once there are enough", () => {
        expect(judge(Array(30).fill(1000 / 30))).toBe("short");
        expect(judge(Array(30).fill(1000 / 60))).toBe("spare");
        expect(judge(Array(30).fill(1000 / 50))).toBeNull();
        expect(judge(Array(5).fill(1000 / 20))).toBeNull();
    });

    it("leaves out long gaps, when the page sat idle rather than slow", () => {
        expect(judge([...Array(30).fill(1000 / 60), 2000])).toBe("spare");
    });
});
