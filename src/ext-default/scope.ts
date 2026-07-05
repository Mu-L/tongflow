/**
 * Default tenant-scope resolver: single-tenant, one shared data dir.
 *
 * A cloud shell substitutes its own `src/ext/scope.ts` (gitignored, linked in
 * at build time) that maps the request session to a user id.
 */
export async function resolveScope(): Promise<string> {
    return "";
}
