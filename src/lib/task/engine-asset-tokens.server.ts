import "server-only";

import { randomBytes } from "node:crypto";

/**
 * Per-run bearer tokens for the `/api/engine-assets` loopback sink. The
 * engine delegate mints one per spawned engine process (binding the tenant
 * scope and taskId) and revokes it when the run ends, so the engine child
 * can read/write assets through the storage driver without ever holding
 * storage credentials or a user session.
 */

interface TokenBinding {
    scope: string;
    taskId: string;
}

const tokens = new Map<string, TokenBinding>();

export function issueEngineAssetToken(scope: string, taskId: string): string {
    const token = randomBytes(24).toString("base64url");
    tokens.set(token, { scope, taskId });
    return token;
}

export function revokeEngineAssetToken(token: string): void {
    tokens.delete(token);
}

export function bindingForEngineAssetToken(token: string): TokenBinding | null {
    return tokens.get(token) ?? null;
}
