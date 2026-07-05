import { randomBytes } from "node:crypto";
import type { EngineAssetTokenBinding } from "@/lib/task/engine-asset-tokens.server";

/**
 * Default engine-asset token backend: an in-process map of random bearer
 * tokens, minted per engine run and revoked when it ends. Correct for the
 * single-process open-source build; a multi-instance cloud shell
 * substitutes a stateless scheme (e.g. HMAC-signed tokens) via
 * `src/ext/asset-token.ts`.
 */

const tokens = new Map<string, EngineAssetTokenBinding>();

export async function issueEngineAssetToken(
    scope: string,
    taskId: string,
): Promise<string> {
    const token = randomBytes(24).toString("base64url");
    tokens.set(token, { scope, taskId });
    return token;
}

export async function revokeEngineAssetToken(token: string): Promise<void> {
    tokens.delete(token);
}

export async function bindingForEngineAssetToken(
    token: string,
): Promise<EngineAssetTokenBinding | null> {
    return tokens.get(token) ?? null;
}
