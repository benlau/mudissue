import type { Migration } from "./types.ts";

const TABLE_NAME = "registry";
const INDEX_NAME = "idx_registry_url_catalog_key";

const UP_SQL = `
CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (
  url TEXT NOT NULL,
  catalog TEXT NOT NULL CHECK (catalog IN ('system', 'user')),
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  PRIMARY KEY (url, catalog, key)
);
CREATE INDEX IF NOT EXISTS ${INDEX_NAME} ON ${TABLE_NAME} (url, catalog, key);
`;

const DOWN_SQL = `
DROP INDEX IF EXISTS ${INDEX_NAME};
DROP TABLE IF EXISTS ${TABLE_NAME};
`;

export const migration: Migration = {
  name: "260228_001_registry",
  up(db) {
    db.exec(UP_SQL);
  },
  down(db) {
    db.exec(DOWN_SQL);
  },
};
