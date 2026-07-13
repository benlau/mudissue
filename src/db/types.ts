/**
 * Registry table: (url, catalog, key) unique, value string.
 * Stored in global DB at ~/.mudissue/system.sqlite.
 */
export interface RegistryTable {
  url: string;
  catalog: "system" | "user";
  key: string;
  value: string;
}

export interface Database {
  registry: RegistryTable;
}
