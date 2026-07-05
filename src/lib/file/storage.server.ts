import "server-only";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { nanoid } from "nanoid";
import { scopedDataDir } from "@/lib/runtime/scope.server";

/**
 * Storage driver seam.
 *
 * The default driver stores files on the local disk under the scoped uploads
 * directory (`<scopedDataDir>/uploads/`) — the historical behavior. A cloud
 * shell can register an alternative driver (e.g. R2 via the S3 API) from its
 * instrumentation hook so media bytes never transit the app server.
 */

export interface StorageDriver {
    /**
     * Persist bytes and return the fileKey (path relative to the uploads
     * root, e.g. `tasks/<taskId>/<id>.png`).
     */
    saveFile(
        data: Buffer | Uint8Array,
        ext: string,
        taskId?: string,
    ): Promise<string>;
    /** Read bytes by fileKey. Throws on missing files and invalid keys. */
    readFile(fileKey: string): Promise<Buffer>;
    /**
     * True when files do not live on the local uploads dir. The engine
     * delegate then routes the SDK engine's asset IO through the
     * `/api/engine-assets` loopback sink instead of a local out_dir.
     */
    remote?: boolean;
    /**
     * Optional directly-fetchable URL for a fileKey (e.g. a presigned
     * object-storage URL). The uploads route 302s to it when present;
     * return null to stream bytes via the app instead.
     */
    publicUrl?(fileKey: string): Promise<string | null>;
}

async function uploadsRoot(): Promise<string> {
    return path.join(await scopedDataDir(), "uploads");
}

const localDriver: StorageDriver = {
    async saveFile(data, ext, taskId) {
        const root = await uploadsRoot();
        const dir = taskId ? path.join(root, "tasks", taskId) : root;
        await mkdir(dir, { recursive: true });

        const filename = ext ? `${nanoid()}.${ext}` : nanoid();
        const filePath = path.join(dir, filename);
        await writeFile(filePath, data);

        // The fileKey is the path relative to the uploads root.
        return path.relative(root, filePath);
    },

    async readFile(fileKey) {
        const root = await uploadsRoot();
        const normalized = fileKey.replace(/^\/+/, "").replace(/\\/g, "/");
        const resolved = path.resolve(
            root,
            ...normalized.split("/").filter(Boolean),
        );
        if (!resolved.startsWith(root)) {
            throw new Error("Invalid file key");
        }
        return readFile(resolved);
    },
};

// The registry lives on globalThis: instrumentation.ts (where shells
// register their driver) is compiled as a separate bundle from route
// handlers, so a module-level variable would not be shared between them.
const DRIVER_KEY = Symbol.for("tongflow.storage.driver");

type DriverGlobal = { [DRIVER_KEY]?: StorageDriver };

/** Replace the storage backend (cloud shells call this at startup). */
export function registerStorageDriver(next: StorageDriver): void {
    (globalThis as DriverGlobal)[DRIVER_KEY] = next;
}

export function getStorage(): StorageDriver {
    return (globalThis as DriverGlobal)[DRIVER_KEY] ?? localDriver;
}
