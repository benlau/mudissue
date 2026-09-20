import type { DatabaseSync } from "node:sqlite";

/**
 * A migration runs SQL or logic against the raw SQLite database.
 * Migrations are imported in code (not scanned from disk) and run in order.
 */
export type Migration = {
  name: string;
  up: (db: DatabaseSync) => void;
  down?: (db: DatabaseSync) => void;
};
