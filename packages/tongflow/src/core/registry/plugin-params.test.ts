import { describe, expect, it } from "vitest";

import {
    normalizePluginParams,
    samePluginParams,
    visiblePluginParams,
} from "./plugin-params";

const specs = {
    steps: { type: "select" as const, options: [8, 20, 40], default: 20 },
    turbo: { type: "boolean" as const, default: false },
    shift: { type: "number" as const, default: 12, min: 1, max: 20 },
    guidance: { type: "integer" as const, default: 4, models: ["m-a"] },
    sampler: { type: "text" as const },
};

describe("visiblePluginParams", () => {
    it("keeps declaration order and gates model-scoped entries", () => {
        expect(
            visiblePluginParams(specs, undefined).map((e) => e.name),
        ).toEqual(["steps", "turbo", "shift", "sampler"]);
        expect(visiblePluginParams(specs, "m-a").map((e) => e.name)).toEqual([
            "steps",
            "turbo",
            "shift",
            "guidance",
            "sampler",
        ]);
        expect(visiblePluginParams(undefined, "m-a")).toEqual([]);
    });
});

describe("normalizePluginParams", () => {
    const entries = visiblePluginParams(specs, "m-a");

    it("drops unknown keys, invalid values and defaults", () => {
        expect(
            normalizePluginParams(entries, {
                steps: 8, // valid, non-default
                turbo: false, // equals default → dropped
                shift: 99, // out of range → dropped
                guidance: 4.5, // not an integer → dropped
                sampler: "dpmpp", // text, no default → kept
                stale: 1, // not declared → dropped
            }),
        ).toEqual({ steps: 8, sampler: "dpmpp" });
    });

    it("drops entries hidden by the model gate", () => {
        const noModel = visiblePluginParams(specs, undefined);
        expect(normalizePluginParams(noModel, { guidance: 7 })).toEqual({});
    });

    it("returns an empty record for no values", () => {
        expect(normalizePluginParams(entries, undefined)).toEqual({});
    });
});

describe("samePluginParams", () => {
    it("compares shallowly", () => {
        expect(samePluginParams({ a: 1 }, { a: 1 })).toBe(true);
        expect(samePluginParams({ a: 1 }, { a: 2 })).toBe(false);
        expect(samePluginParams(undefined, {})).toBe(true);
        expect(samePluginParams({ a: 1 }, {})).toBe(false);
    });
});
