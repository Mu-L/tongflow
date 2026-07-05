import { mkdirSync } from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { resourcesDir } from "@/lib/runtime/paths.server";
import { getScope, scopedDataDirFor } from "@/lib/runtime/scope.server";
import * as schema from "./schema";

// One connection per tenant scope. The open-source build always resolves
// scope "" and behaves exactly like the previous singleton; a cloud shell
// gets an isolated, lazily-migrated SQLite db per user.
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

export * from "./schema";
