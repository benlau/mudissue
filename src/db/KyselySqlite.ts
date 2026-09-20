import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import {
  CompiledQuery,
  type DatabaseConnection,
  type Dialect,
  type Driver,
  Kysely,
  type QueryResult,
  SqliteAdapter,
  SqliteIntrospector,
  SqliteQueryCompiler,
} from "kysely";

class NodeSqliteDriver implements Driver {
  readonly #db: DatabaseSync;

  constructor(db: DatabaseSync) {
    this.#db = db;
  }

  async init(): Promise<void> {}

  async acquireConnection(): Promise<DatabaseConnection> {
    return new NodeSqliteConnection(this.#db);
  }

  async beginTransaction(connection: DatabaseConnection): Promise<void> {
    await connection.executeQuery(CompiledQuery.raw("BEGIN"));
  }

  async commitTransaction(connection: DatabaseConnection): Promise<void> {
    await connection.executeQuery(CompiledQuery.raw("COMMIT"));
  }

  async rollbackTransaction(connection: DatabaseConnection): Promise<void> {
    await connection.executeQuery(CompiledQuery.raw("ROLLBACK"));
  }

  async releaseConnection(): Promise<void> {}

  async destroy(): Promise<void> {
    this.#db.close();
  }
}

class NodeSqliteConnection implements DatabaseConnection {
  readonly #db: DatabaseSync;

  constructor(db: DatabaseSync) {
    this.#db = db;
  }

  async executeQuery<R>(compiledQuery: CompiledQuery): Promise<QueryResult<R>> {
    const stmt = this.#db.prepare(compiledQuery.sql);
    const params = compiledQuery.parameters as SQLInputValue[];

    // StatementSync has no `reader`; columns().length > 0 means a result set.
    if (stmt.columns().length > 0) {
      const rows = stmt.all(...params) as R[];
      return { rows };
    }

    const result = stmt.run(...params);
    return {
      numAffectedRows: BigInt(result.changes),
      insertId: BigInt(result.lastInsertRowid),
      rows: [],
    };
  }

  streamQuery<R>(
    _compiledQuery: CompiledQuery,
    _chunkSize: number,
  ): AsyncIterableIterator<QueryResult<R>> {
    throw new Error(
      "Streaming is not supported for node:sqlite synchronous binding",
    );
  }
}

export class NodeSqliteDialect implements Dialect {
  readonly #db: DatabaseSync;

  constructor(db: DatabaseSync) {
    this.#db = db;
  }

  createDriver(): Driver {
    return new NodeSqliteDriver(this.#db);
  }

  createQueryCompiler(): SqliteQueryCompiler {
    return new SqliteQueryCompiler();
  }

  createAdapter(): SqliteAdapter {
    return new SqliteAdapter();
  }

  createIntrospector(db: Kysely<any>): SqliteIntrospector {
    return new SqliteIntrospector(db);
  }
}
