import type Database from "better-sqlite3";

/**
 * A migration runs SQL or logic against the raw SQLite database.
 * Migrations are imported in code (not scanned from disk) and run in order.
 */
export type Migration = {
  name: string;
  up: (db: InstanceType<typeof Database>) => void;
  down?: (db: InstanceType<typeof Database>) => void;
};
