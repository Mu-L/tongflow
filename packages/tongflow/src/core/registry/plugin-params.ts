import type { PluginParamSpec } from "./plugins-registry-schema";

/** A plugin's declared params for one slot, in declaration order. */
export type PluginParamEntry = { name: string; spec: PluginParamSpec };

/**
 * The params a node offers for the active plugin + model: every declared entry
 * whose `models` gate is absent or names the selected model.
 */
export function visiblePluginParams(
    params: Record<string, PluginParamSpec> | undefined,
    model: string | undefined,
): PluginParamEntry[] {
    if (!params) return [];
    const out: PluginParamEntry[] = [];
    for (const [name, spec] of Object.entries(params)) {
        if (spec.models && !(model && spec.models.includes(model))) continue;
        out.push({ name, spec });
    }
    return out;
}

/** True when `value` is a legal setting for `spec` (type + range/options). */
export function isValidPluginParamValue(
    spec: PluginParamSpec,
    value: unknown,
): boolean {
    switch (spec.type) {
        case "select":
            return (spec.options ?? []).some((o) => o === value);
        case "boolean":
            return typeof value === "boolean";
        case "text":
            return typeof value === "string";
        case "number":
        case "integer": {
            if (typeof value !== "number" || !Number.isFinite(value))
                return false;
            if (spec.type === "integer" && !Number.isInteger(value))
                return false;
            if (spec.min !== undefined && value < spec.min) return false;
            if (spec.max !== undefined && value > spec.max) return false;
            return true;
        }
        default:
            return false;
    }
}

/**
 * Keep only the entries of `values` that the visible params accept and that
 * differ from the declared default. Unset means "plugin default", so a value
 * equal to it is dropped; the result is what travels to the plugin.
 */
export function normalizePluginParams(
    entries: PluginParamEntry[],
    values: Record<string, unknown> | undefined,
): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    if (!values) return out;
    for (const { name, spec } of entries) {
        if (!(name in values)) continue;
        const v = values[name];
        if (!isValidPluginParamValue(spec, v)) continue;
        if (spec.default !== undefined && v === spec.default) continue;
        out[name] = v;
    }
    return out;
}

/** Shallow key/value equality for two param records. */
export function samePluginParams(
    a: Record<string, unknown> | undefined,
    b: Record<string, unknown> | undefined,
): boolean {
    const ka = Object.keys(a ?? {});
    const kb = Object.keys(b ?? {});
    if (ka.length !== kb.length) return false;
    return ka.every((k) => Object.is(a?.[k], b?.[k]));
}
