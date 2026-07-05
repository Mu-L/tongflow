import "server-only";

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { decodeEnvStore, encodeEnvStore } from "@ext/settings-codec";
import { scopedDataDir } from "@/lib/runtime/scope.server";

/**
 * Generic, platform-agnostic environment store.
 *
 * TongFlow itself declares no specific keys: this is a flat `key -> value` map
 * that the user fills in (workspace settings dialog). Each plugin documents the
 * keys it needs in its own README. The stored values are merged into the
 * environment of spawned plugin processes at execution time, so edits take
 * effect without restarting the server.
 *
 * The file lives in the scoped data dir (per-user in a cloud shell) and its
 * raw contents pass through the `@ext/settings-codec` hooks — identity by
 * default, encryption in a cloud shell.
 */

export type EnvStore = Record<string, string>;

async function storeFile(): Promise<string> {
    return path.join(await scopedDataDir(), "settings.json");
}

/** Read the stored env map. Returns `{}` when absent or unreadable. */
export async function loadEnvStore(): Promise<EnvStore> {
    try {
        const raw = readFileSync(await storeFile(), "utf8");
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
    const dir = await scopedDataDir();
    mkdirSync(dir, { recursive: true });
    const clean: EnvStore = {};
    for (const [k, v] of Object.entries(env)) {
        const key = k.trim();
        if (key && typeof v === "string") clean[key] = v;
    }
    const encoded = await encodeEnvStore(JSON.stringify(clean, null, 2));
    writeFileSync(path.join(dir, "settings.json"), encoded, "utf8");
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
