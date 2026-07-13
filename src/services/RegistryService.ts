import * as path from "path";
import { z } from "zod";
import { MAX_RECENT_PROJECTS, MUDISSUE_STATE_URL } from "../constants.ts";
import { URLFormatter } from "../foundation/formatter/URLFormatter.ts";
import { DatabaseService } from "../db/DatabaseService.ts";
import {
  type RecentProjectItem,
  RecentProjectListSchema,
} from "../types/RecentProject.ts";
import {
  SortingOrderAccessor,
  type SortingOrder,
} from "../types/SortingOrder.ts";
import { MudissueStateKey, ProjectStateKey } from "../types/registry.ts";
import { FileService } from "./FileService.ts";

const PinnedIssueFolderNamesSchema = z.array(z.string());

function parsePinnedIssueFolderNames(value: string | undefined): string[] {
  if (value === undefined || value.trim() === "") {
    return [];
  }
  try {
    const parsed = PinnedIssueFolderNamesSchema.safeParse(
      JSON.parse(value) as unknown,
    );
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
}

export type RegistryCatalog = "system" | "user";

export class RegistryService {
  static instance: RegistryService | null = null;
  private databaseService: DatabaseService;
  private fileService: FileService;

  constructor() {
    this.databaseService = DatabaseService.getInstance();
    this.fileService = FileService.getInstance();
  }

  static getInstance(): RegistryService {
    if (!RegistryService.instance) {
      RegistryService.instance = new RegistryService();
    }
    return RegistryService.instance;
  }

  static setInstance(instance: RegistryService): void {
    RegistryService.instance = instance;
  }

  /** Gets the value for (url, catalog, key) at the given URL only. */
  async get(
    url: string,
    catalog: RegistryCatalog,
    key: string,
  ): Promise<{ url: string; value: string } | null> {
    const db = await this.databaseService.getKysely();
    const row = await db
      .selectFrom("registry")
      .select(["url", "value"])
      .where("url", "=", url)
      .where("catalog", "=", catalog)
      .where("key", "=", key)
      .executeTakeFirst();
    return row ? { url: row.url, value: row.value } : null;
  }

  /** Returns all key-value pairs for (url, catalog) at the given URL only. */
  async getRecords(
    url: string,
    catalog: RegistryCatalog,
  ): Promise<Record<string, string>> {
    const db = await this.databaseService.getKysely();
    const rows = await db
      .selectFrom("registry")
      .select(["key", "value"])
      .where("url", "=", url)
      .where("catalog", "=", catalog)
      .orderBy("key", "asc")
      .execute();
    return Object.fromEntries(rows.map((row) => [row.key, row.value]));
  }

  /**
   * Sets (url, catalog, key) = value at the given URL.
   */
  async set(
    key: string,
    value: string,
    url: string,
    catalog: RegistryCatalog,
  ): Promise<void> {
    const db = await this.databaseService.getKysely();
    await db
      .insertInto("registry")
      .values({ url, catalog, key, value })
      .onConflict((oc) =>
        oc.columns(["url", "catalog", "key"]).doUpdateSet({ value }),
      )
      .execute();
  }

  /**
   * Upserts RECENT_PROJECTS at mudissue state URL for system catalog.
   * Existing items with non-existent paths are removed.
   */
  async upsertRecentProjects(project: RecentProjectItem): Promise<void> {
    try {
      const currentProjectPath = path.resolve(project.projectPath);
      const row = await this.get(
        MUDISSUE_STATE_URL,
        "system",
        MudissueStateKey.RecentProjectKey,
      );
      const parsed = row?.value ? (JSON.parse(row.value) as unknown) : [];
      const parsedList = RecentProjectListSchema.safeParse(parsed);
      const list = parsedList.success ? parsedList.data : [];

      const filtered: RecentProjectItem[] = [];
      for (const item of list) {
        const resolved = path.resolve(item.projectPath);
        if (await this.fileService.exists(resolved).catch(() => false)) {
          filtered.push({ name: item.name, projectPath: resolved });
        }
      }
      const filteredBeforeUpsert = filtered.slice();

      const firstProjectPath = filtered[0]?.projectPath
        ? path.resolve(filtered[0].projectPath)
        : null;
      if (firstProjectPath !== currentProjectPath) {
        const idx = filtered.findIndex(
          (x) => path.resolve(x.projectPath) === currentProjectPath,
        );
        const nextProject: RecentProjectItem = {
          name: project.name,
          projectPath: currentProjectPath,
        };
        if (idx >= 0) {
          filtered.splice(idx, 1);
        }
        filtered.unshift(nextProject);
      }

      const capped = filtered.slice(0, MAX_RECENT_PROJECTS);
      const wouldHaveWritten = filteredBeforeUpsert.slice(
        0,
        MAX_RECENT_PROJECTS,
      );
      const unchanged =
        JSON.stringify(capped) === JSON.stringify(wouldHaveWritten);
      if (!unchanged) {
        await this.set(
          MudissueStateKey.RecentProjectKey,
          JSON.stringify(capped),
          MUDISSUE_STATE_URL,
          "system",
        );
      }
    } catch {
      // fail silently
    }
  }

  /**
   * Returns the list of recent projects from the registry, with non-existent paths removed.
   * Returns [] on error.
   */
  async getIssueListSortOrder(projectPath: string): Promise<SortingOrder> {
    const url = URLFormatter.pathToFileUrl(projectPath);
    const row = await this.get(
      url,
      "system",
      ProjectStateKey.IssueListSortOrder,
    );
    return SortingOrderAccessor.parseJson(row?.value).get();
  }

  async setIssueListSortOrder(
    order: SortingOrder,
    projectPath: string,
  ): Promise<void> {
    const url = URLFormatter.pathToFileUrl(projectPath);
    await this.set(
      ProjectStateKey.IssueListSortOrder,
      JSON.stringify(SortingOrderAccessor.from(order).get()),
      url,
      "system",
    );
  }

  async getPinnedIssueFolderNames(projectPath: string): Promise<string[]> {
    const url = URLFormatter.pathToFileUrl(projectPath);
    const row = await this.get(url, "system", ProjectStateKey.PinnedIssues);
    return parsePinnedIssueFolderNames(row?.value);
  }

  async setPinnedIssueFolderNames(
    folderNames: string[],
    projectPath: string,
  ): Promise<void> {
    const url = URLFormatter.pathToFileUrl(projectPath);
    await this.set(
      ProjectStateKey.PinnedIssues,
      JSON.stringify(folderNames),
      url,
      "system",
    );
  }

  /** Pins when absent (appended last); unpins when present. Returns true when pinned. */
  async togglePinnedIssueFolderName(
    projectPath: string,
    folderName: string,
  ): Promise<boolean> {
    const list = await this.getPinnedIssueFolderNames(projectPath);
    const idx = list.indexOf(folderName);
    if (idx >= 0) {
      list.splice(idx, 1);
      await this.setPinnedIssueFolderNames(list, projectPath);
      return false;
    }
    list.push(folderName);
    await this.setPinnedIssueFolderNames(list, projectPath);
    return true;
  }

  async getRecentProjects(): Promise<RecentProjectItem[]> {
    try {
      const row = await this.get(
        MUDISSUE_STATE_URL,
        "system",
        MudissueStateKey.RecentProjectKey,
      );
      if (!row?.value) return [];
      const parsed = JSON.parse(row.value) as unknown;
      const parsedList = RecentProjectListSchema.safeParse(parsed);
      const list = parsedList.success ? parsedList.data : [];
      const result: RecentProjectItem[] = [];
      for (const item of list) {
        const resolved = path.resolve(item.projectPath);
        if (await this.fileService.exists(resolved).catch(() => false)) {
          result.push({ name: item.name, projectPath: resolved });
        }
      }
      return result;
    } catch {
      return [];
    }
  }
}
