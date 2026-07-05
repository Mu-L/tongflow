import "server-only";

import { decodeEnvStore, encodeEnvStore } from "@ext/settings-codec";
import { readSettingsBlob, writeSettingsBlob } from "@ext/settings-store";

/**
 * Generic, platform-agnostic environment store.
 *
 * TongFlow itself declares no specific keys: this is a flat `key -> value` map
 * that the user fills in (workspace settings dialog). Each plugin documents the
 * keys it needs in its own README. The stored values are merged into the
 * environment of spawned plugin processes at execution time, so edits take
 * effect without restarting the server.
 *
 * Two seams compose here: `@ext/settings-store` persists the raw blob
 * (default: settings.json in the scoped data dir) and `@ext/settings-codec`
 * encodes/decodes it (default: identity; a cloud shell encrypts BYOK keys).
 */

export type EnvStore = Record<string, string>;

/** Read the stored env map. Returns `{}` when absent or unreadable. */
export async function loadEnvStore(): Promise<EnvStore> {
    try {
        const raw = await readSettingsBlob();
        if (raw == null) return {};
        const parsed = JSON.parse(await decodeEnvStore(raw)) as unknown;
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
            return {};
        }
        const out: EnvStore = {};
        for (const [k, v] of Object.entries(
            parsed as Record<string, unknown>,
        )) {
            if (typeof k === "string" && k.trim() && typeof v === "string") {
                out[k] = v;
            }
        }
        return out;
    } catch {
        return {};
    }
}

/** Persist the env map, overwriting the previous contents. */
export async function saveEnvStore(env: EnvStore): Promise<void> {
    const clean: EnvStore = {};
    for (const [k, v] of Object.entries(env)) {
        const key = k.trim();
        if (key && typeof v === "string") clean[key] = v;
    }
    const encoded = await encodeEnvStore(JSON.stringify(clean, null, 2));
    await writeSettingsBlob(encoded);
}

/**
 * Build a spawn environment: the stored values override the process env so the
 * UI is the source of truth, while still inheriting PATH and other essentials.
 */
export async function withStoredEnv(
    extra?: Record<string, string | undefined>,
): Promise<NodeJS.ProcessEnv> {
    return {
        ...process.env,
        ...(await loadEnvStore()),
        ...extra,
    };
}
