/**
 * Jest resolves `node:sqlite` as bare `sqlite` and fails to load the builtin.
 * Re-export the real module via getBuiltinModule so tests use real SQLite.
 *
 * Note: under Jest's VM, getBuiltinModule("sqlite") is null; use "node:sqlite".
 */
const sqlite = process.getBuiltinModule("node:sqlite");

if (!sqlite?.DatabaseSync) {
  throw new Error("Unable to load node:sqlite via process.getBuiltinModule");
}

module.exports = {
  __esModule: true,
  DatabaseSync: sqlite.DatabaseSync,
  StatementSync: sqlite.StatementSync,
  Session: sqlite.Session,
  constants: sqlite.constants,
  backup: sqlite.backup,
  default: sqlite,
};
