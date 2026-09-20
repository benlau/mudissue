/**
 * DatabaseService integration test. Uses real node:sqlite (no mock), in-memory DB.
 * Tests: (url, catalog, key) uniqueness; migration up/down rollback.
 */
import { DatabaseSync } from "node:sqlite";
import { DatabaseService } from "../../src/db/DatabaseService.ts";
import { migration } from "../../src/db/migrations/260228_001_registry.ts";

describe("DatabaseService", () => {
  test("getKysely runs migrations and returns Kysely (real SQLite)", async () => {
    const service = new DatabaseService({ dbPath: ":memory:" });
    const db = await service.getKysely();
    await db
      .insertInto("registry")
      .values({
        url: "file:///tmp",
        catalog: "user",
        key: "testkey",
        value: "testvalue",
      })
      .onConflict((oc) =>
        oc.columns(["url", "catalog", "key"]).doUpdateSet({ value: "testvalue" }),
      )
      .execute();
    const row = await db
      .selectFrom("registry")
      .select(["url", "catalog", "key", "value"])
      .where("url", "=", "file:///tmp")
      .where("catalog", "=", "user")
      .where("key", "=", "testkey")
      .executeTakeFirst();
    expect(row).not.toBeUndefined();
    expect(row!.value).toBe("testvalue");
    service.close();
  });

  test("registry (url, catalog, key) is unique: upsert replaces value", async () => {
    const service = new DatabaseService({ dbPath: ":memory:" });
    const db = await service.getKysely();
    const url = "file:///tmp";
    const catalog = "user";
    const key = "k";
    await db
      .insertInto("registry")
      .values({ url, catalog, key, value: "v1" })
      .onConflict((oc) =>
        oc.columns(["url", "catalog", "key"]).doUpdateSet({ value: "v1" }),
      )
      .execute();
    await db
      .insertInto("registry")
      .values({ url, catalog, key, value: "v2" })
      .onConflict((oc) =>
        oc.columns(["url", "catalog", "key"]).doUpdateSet({ value: "v2" }),
      )
      .execute();
    const rows = await db
      .selectFrom("registry")
      .selectAll()
      .where("url", "=", url)
      .where("catalog", "=", catalog)
      .where("key", "=", key)
      .execute();
    expect(rows).toHaveLength(1);
    expect(rows[0]!.value).toBe("v2");
    service.close();
  });

  test("migration down rolls back registry table", async () => {
    const db = new DatabaseSync(":memory:");
    migration.up(db);
    db.exec(
      "INSERT INTO registry (url, catalog, key, value) VALUES ('u','user','k','v')",
    );
    const before = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='registry'",
      )
      .get();
    expect(before).not.toBeUndefined();
    migration.down!(db);
    const after = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='registry'",
      )
      .get();
    expect(after).toBeUndefined();
    migration.up(db);
    const again = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='registry'",
      )
      .get();
    expect(again).not.toBeUndefined();
    db.close();
  });
});
