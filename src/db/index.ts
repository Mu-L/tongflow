// Database backend seam: the default implementation (src/ext-default/db.ts)
// opens one local better-sqlite3 file per tenant scope; a cloud shell can
// substitute another sqlite-dialect drizzle driver via src/ext/db.ts
// (the schema below is shared by all backends).
export { getDb } from "@ext/db";
export * from "./schema";
