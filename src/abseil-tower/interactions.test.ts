import { describe, expect, it } from "vitest";

import { checkConnection } from "@/rigging/interactions";

import { layoutRig, RIGS } from "./rig";

/**
 * Connections the tower is known to get wrong, by rig and connection, with why. Each runs as an `it.fails` test, so when
 * one gets fixed its test fails and it should come off the list.
 */
const KNOWN_FAILURES: Record<string, Record<string, string>> = {};

describe.each(RIGS)("the $name rig's connections", (rig) => {
    const { connections } = layoutRig(rig);
    const known = KNOWN_FAILURES[rig.slug] ?? {};

    it("has its slings' carabiners and figure 8s on carabiners to check", () => {
        expect(connections.length).toBeGreaterThan(0);
    });

    for (const c of connections) {
        const why = known[c.id];
        if (why) it.fails(`${c.id} (known: ${why})`, () => expect(checkConnection(c)).toEqual([]));
        else it(c.id, () => expect(checkConnection(c)).toEqual([]));
    }

    it("lists only connections it has as known failures", () => {
        const ids = new Set(connections.map((c) => c.id));
        expect(Object.keys(known).filter((id) => !ids.has(id))).toEqual([]);
    });
});
