import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { scopedDataDir } from "@/lib/runtime/scope.server";

/**
 * Default settings persistence: `settings.json` in the scoped data dir.
 * A cloud shell substitutes its own `src/ext/settings-store.ts` (e.g. a
 * per-user Durable Object). The blob is the raw (possibly codec-encoded)
 * file contents; parsing/validation stays in env-store.server.ts.
 */

async function storeFile(): Promise<string> {
    return path.join(await scopedDataDir(), "settings.json");
}

/** Raw settings blob for the current scope, or null when absent. */
export async function readSettingsBlob(): Promise<string | null> {
    try {
        return readFileSync(await storeFile(), "utf8");
    } catch {
        return null;
    }
}

/** Persist the raw settings blob for the current scope. */
export async function writeSettingsBlob(blob: string): Promise<void> {
    const dir = await scopedDataDir();
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, "settings.json"), blob, "utf8");
}
