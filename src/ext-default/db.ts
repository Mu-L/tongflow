import { mkdirSync } from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "@/db/schema";
import { resourcesDir } from "@/lib/runtime/paths.server";
import { getScope, scopedDataDirFor } from "@/lib/runtime/scope.server";

/**
 * Default database backend: one local better-sqlite3 file per tenant scope
 * (scope "" — the open-source build — is exactly the historical single
 * `data/tongflow.db`). A cloud shell substitutes its own `src/ext/db.ts`
 * (e.g. a per-user Durable Object SQLite behind drizzle's proxy driver).
 */

// One connection per tenant scope, lazily opened and migrated.
const dbs = new Map<string, BetterSQLite3Database<typeof schema>>();

export async function getDb() {
    const scope = await getScope();
    let db = dbs.get(scope);
    if (!db) {
        const dbDir = scopedDataDirFor(scope);
        mkdirSync(dbDir, { recursive: true });

        const dbPath = path.join(dbDir, "tongflow.db");
        const sqlite = new Database(dbPath);
        sqlite.pragma("journal_mode = WAL");
        db = drizzle(sqlite, { schema });

        migrate(db, {
            migrationsFolder: path.join(resourcesDir(), "drizzle"),
        });
        dbs.set(scope, db);
    }
    return db;
}
