import { z } from "zod";

/**
 * Optional per-plugin env declaration file: `tongflow.plugin.json` at the
 * plugin repo root. It only feeds the Settings UI (per-plugin env var cards);
 * plugin/handler registration stays annotation-driven and never reads it.
 */
export const PluginEnvVarSchema = z.object({
    /** Env key, conventional UPPER_SNAKE. */
    key: z
        .string()
        .min(1)
        .regex(/^[A-Z][A-Z0-9_]*$/),
    /** Required keys render flat in the card; optional ones go under "Advanced". */
    required: z.boolean().optional(),
    /** Short human hint shown under the input. */
    description: z.string().optional(),
    /** Default the plugin uses when unset; shown as the input placeholder. */
    default: z.string().optional(),
    /** Where to obtain the key (e.g. the provider's API-keys page). */
    url: z.url().optional(),
});

export const PluginEnvManifestSchema = z.object({
    env: z.array(PluginEnvVarSchema).default([]),
});

export type PluginEnvVar = z.infer<typeof PluginEnvVarSchema>;
export type PluginEnvManifest = z.infer<typeof PluginEnvManifestSchema>;

/** Loader output: one entry per installed plugin that ships a manifest. */
export interface PluginEnvDecl {
    pluginId: string;
    env: PluginEnvVar[];
}
