import * as path from "path";
import * as os from "os";
import Database from "better-sqlite3";
import { Kysely, SqliteDialect } from "kysely";
import type { Database as DatabaseType } from "./types.ts";
import { GLOBAL_CONFIG_DIR, SYSTEM_DB_FILENAME } from "../constants.ts";
import { FileService } from "../services/FileService.ts";
import { migrations } from "./migrations/index.ts";

export type DatabaseServiceProps = {
  /** Override DB path (e.g. ":memory:" for tests). */
  dbPath?: string;
};

function getDefaultDbPath(): string {
  return path.join(os.homedir(), GLOBAL_CONFIG_DIR, SYSTEM_DB_FILENAME);
}

export class DatabaseService {
  private static instance: DatabaseService | null = null;

  private fileService: FileService;
  private dbPath: string;
  private kysely: Kysely<DatabaseType> | null = null;
  private nativeDb: InstanceType<typeof Database> | null = null;

  constructor(props?: DatabaseServiceProps) {
    this.fileService = FileService.getInstance();
    this.dbPath = props?.dbPath ?? getDefaultDbPath();
  }

  /**
   * Ensures the DB directory exists. No-op for :memory:.
   */
  async ensureDir(): Promise<void> {
    if (this.dbPath === ":memory:") return;
    const dir = path.dirname(this.dbPath);
    const exists = await this.fileService.exists(dir);
    if (!exists) {
      await this.fileService.mkdir(dir, { recursive: true });
    }
  }

  private runMigrations(db: InstanceType<typeof Database>): void {
    for (const m of migrations) {
      m.up(db);
    }
  }

  async getKysely(): Promise<Kysely<DatabaseType>> {
    if (this.kysely) return this.kysely;
    await this.ensureDir();
    const nativeDb = new Database(this.dbPath);
    this.nativeDb = nativeDb;
    this.runMigrations(nativeDb);
    this.kysely = new Kysely<DatabaseType>({
      dialect: new SqliteDialect({
        database: nativeDb,
      }),
    });
    return this.kysely;
  }

  close(): void {
    if (DatabaseService.instance === this) {
      DatabaseService.instance = null;
    }
    if (this.nativeDb) {
      this.nativeDb.close();
      this.nativeDb = null;
    }
    this.kysely = null;
  }

  static getInstance(props?: DatabaseServiceProps): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService(props);
    }
    return DatabaseService.instance;
  }

  static setInstance(instance: DatabaseService | null): void {
    DatabaseService.instance = instance;
  }
}
