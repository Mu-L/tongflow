import "server-only";

import { AsyncLocalStorage } from "node:async_hooks";
import path from "node:path";
import { resolveScope } from "@ext/scope";
import { dataDir } from "./paths.server";

/**
 * Tenant scoping seam.
 *
 * The open-source build is single-tenant: `resolveScope()` (from `@ext/scope`,
 * defaulting to `src/ext-default/scope.ts`) returns "" and `scopedDataDir()`
 * is exactly `dataDir()`. A cloud shell links in its own `src/ext/scope.ts`
 * that maps the request session to a user id, which gives every user an
 * isolated data directory (`<dataDir>/users/<id>/`) — per-user SQLite,
 * uploads and settings — with no schema or route changes.
 */

const scopeStorage = new AsyncLocalStorage<string>();

/**
 * Current tenant scope. Work pinned via `runWithScope` wins; otherwise the
 * `@ext/scope` resolver runs (request context).
 */
export async function getScope(): Promise<string> {
    const pinned = scopeStorage.getStore();
    if (pinned !== undefined) return pinned;
    return resolveScope();
}

/**
 * Pin a scope for work that outlives the request context, e.g. background
 * task execution kicked off from a route handler.
 */
export function runWithScope<T>(scope: string, fn: () => T): T {
    return scopeStorage.run(scope, fn);
}

/** Data root for a known scope; `dataDir()` itself when scope is "". */
export function scopedDataDirFor(scope: string): string {
    return scope ? path.join(dataDir(), "users", scope) : dataDir();
}

/** Data root for the current scope. */
export async function scopedDataDir(): Promise<string> {
    return scopedDataDirFor(await getScope());
}
