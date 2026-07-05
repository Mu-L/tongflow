import "server-only";

/**
 * Per-run bearer tokens for the `/api/engine-assets` loopback sink. The
 * engine delegate mints one per spawned engine process (binding the tenant
 * scope and taskId) and revokes it when the run ends, so the engine child
 * can read/write assets through the storage driver without ever holding
 * storage credentials or a user session.
 *
 * Backend seam: the default (src/ext-default/asset-token.ts) is an
 * in-process map; a cloud shell substitutes a stateless scheme via
 * src/ext/asset-token.ts.
 */

export interface EngineAssetTokenBinding {
    scope: string;
    taskId: string;
}

export {
    bindingForEngineAssetToken,
    issueEngineAssetToken,
    revokeEngineAssetToken,
} from "@ext/asset-token";
