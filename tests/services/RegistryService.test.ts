import { jest } from "@jest/globals";
import { DatabaseService } from "../../src/db/DatabaseService.ts";
import { MUDISSUE_STATE_URL } from "../../src/constants.ts";
import { FileService } from "../../src/services/FileService.ts";
import { URLFormatter } from "../../src/foundation/formatter/URLFormatter.ts";
import { RegistryService } from "../../src/services/RegistryService.ts";
import { DEFAULT_SORTING_ORDER } from "../../src/types/SortingOrder.ts";
import { MudissueStateKey, ProjectStateKey } from "../../src/types/registry.ts";

describe("RegistryService", () => {
  let dbService: DatabaseService;
  let mockFileService: jest.Mocked<Pick<FileService, "exists">>;
  let savedFileService: FileService;

  const buildService = () => new RegistryService();

  beforeEach(() => {
    savedFileService = FileService.getInstance();
    mockFileService = {
      exists: jest.fn().mockResolvedValue(true),
    } as unknown as jest.Mocked<Pick<FileService, "exists">>;
    FileService.setInstance(mockFileService as FileService);
    dbService = new DatabaseService({ dbPath: ":memory:" });
    DatabaseService.setInstance(dbService);
    jest.clearAllMocks();
  });

  afterEach(() => {
    dbService.close();
    DatabaseService.setInstance(null);
    FileService.setInstance(savedFileService);
  });

  test("set and get (direct) at same URL", async () => {
    const cwd = "/home/proj";
    const url = URLFormatter.normalizeRegistryUrl(undefined, cwd);
    const service = buildService();
    await service.set("mykey", "myvalue", url, "user");
    const result = await service.get(url, "user", "mykey");
    expect(result).not.toBeNull();
    expect(result!.value).toBe("myvalue");
    expect(result!.url).toMatch(/file:\/\/.+/);
  });

  test("get returns null when key not found (direct)", async () => {
    const url = URLFormatter.normalizeRegistryUrl(undefined, "/home/proj");
    const service = buildService();
    const result = await service.get(url, "user", "missing");
    expect(result).toBeNull();
  });

  test("system and user catalogs are separate", async () => {
    const url = URLFormatter.normalizeRegistryUrl(undefined, "/home/proj");
    const service = buildService();
    await service.set("k", "user-val", url, "user");
    await service.set("k", "system-val", url, "system");
    const userResult = await service.get(url, "user", "k");
    const systemResult = await service.get(url, "system", "k");
    expect(userResult!.value).toBe("user-val");
    expect(systemResult!.value).toBe("system-val");
  });

  describe("getRecentProjects()", () => {
    test("returns empty array when registry has no recent projects row", async () => {
      const service = buildService();
      const list = await service.getRecentProjects();
      expect(list).toEqual([]);
    });

    test("returns filtered list from registry when paths exist", async () => {
      const items = [
        { name: "proj-a", projectPath: "/proj-a" },
        { name: "proj-b", projectPath: "/proj-b" },
      ];
      const service = buildService();
      await service.set(
        MudissueStateKey.RecentProjectKey,
        JSON.stringify(items),
        MUDISSUE_STATE_URL,
        "system",
      );
      const list = await service.getRecentProjects();
      expect(list).toEqual(items);
    });

    test("filters out items whose path does not exist", async () => {
      mockFileService.exists.mockImplementation((absPath: string) =>
        Promise.resolve(absPath === "/proj-a"),
      );
      const service = buildService();
      await service.set(
        MudissueStateKey.RecentProjectKey,
        JSON.stringify([
          { name: "proj-a", projectPath: "/proj-a" },
          { name: "deleted", projectPath: "/deleted" },
        ]),
        MUDISSUE_STATE_URL,
        "system",
      );

      const list = await service.getRecentProjects();
      expect(list).toEqual([{ name: "proj-a", projectPath: "/proj-a" }]);
    });
  });

  describe("upsertRecentProjects()", () => {
    test("inserts current project when no existing list", async () => {
      const service = buildService();
      await service.upsertRecentProjects({
        name: "proj-a",
        projectPath: "/proj-a",
      });

      const row = await service.get(
        MUDISSUE_STATE_URL,
        "system",
        MudissueStateKey.RecentProjectKey,
      );
      expect(row).not.toBeNull();
      expect(JSON.parse(row!.value)).toEqual([
        { name: "proj-a", projectPath: "/proj-a" },
      ]);
    });

    test("moves existing project to top and keeps remaining order", async () => {
      const service = buildService();
      await service.set(
        MudissueStateKey.RecentProjectKey,
        JSON.stringify([
          { name: "first", projectPath: "/first" },
          { name: "second", projectPath: "/second" },
          { name: "third", projectPath: "/third" },
        ]),
        MUDISSUE_STATE_URL,
        "system",
      );

      await service.upsertRecentProjects({
        name: "second",
        projectPath: "/second",
      });

      const row = await service.get(
        MUDISSUE_STATE_URL,
        "system",
        MudissueStateKey.RecentProjectKey,
      );
      expect(JSON.parse(row!.value)).toEqual([
        { name: "second", projectPath: "/second" },
        { name: "first", projectPath: "/first" },
        { name: "third", projectPath: "/third" },
      ]);
    });

    test("caps project list to MAX_RECENT_PROJECTS", async () => {
      const service = buildService();
      await service.set(
        MudissueStateKey.RecentProjectKey,
        JSON.stringify(
          Array.from({ length: 25 }, (_, i) => ({
            name: `proj-${i}`,
            projectPath: `/proj-${i}`,
          })),
        ),
        MUDISSUE_STATE_URL,
        "system",
      );

      await service.upsertRecentProjects({ name: "new", projectPath: "/new" });

      const row = await service.get(
        MUDISSUE_STATE_URL,
        "system",
        MudissueStateKey.RecentProjectKey,
      );
      const list = JSON.parse(row!.value) as Array<{
        name: string;
        projectPath: string;
      }>;
      expect(list.length).toBe(20);
      expect(list[0]).toEqual({ name: "new", projectPath: "/new" });
    });

    test("skips non-existent projects from existing list", async () => {
      mockFileService.exists.mockImplementation((absPath: string) =>
        Promise.resolve(absPath !== "/gone"),
      );
      const service = buildService();
      await service.set(
        MudissueStateKey.RecentProjectKey,
        JSON.stringify([
          { name: "gone", projectPath: "/gone" },
          { name: "alive", projectPath: "/alive" },
        ]),
        MUDISSUE_STATE_URL,
        "system",
      );

      await service.upsertRecentProjects({
        name: "current",
        projectPath: "/current",
      });

      const row = await service.get(
        MUDISSUE_STATE_URL,
        "system",
        MudissueStateKey.RecentProjectKey,
      );
      expect(JSON.parse(row!.value)).toEqual([
        { name: "current", projectPath: "/current" },
        { name: "alive", projectPath: "/alive" },
      ]);
    });

    test("fails silently when write throws", async () => {
      const service = buildService();
      const setMock = jest
        .fn()
        .mockRejectedValue(
          new Error("write failed"),
        ) as unknown as RegistryService["set"];
      (service as unknown as { set: RegistryService["set"] }).set = setMock;

      await expect(
        service.upsertRecentProjects({ name: "proj", projectPath: "/proj" }),
      ).resolves.not.toThrow();
    });
  });

  test("getIssueListSortOrder returns default when key is missing", async () => {
    const service = buildService();
    const order = await service.getIssueListSortOrder("/home/proj");
    expect(order).toEqual(DEFAULT_SORTING_ORDER);
  });

  test("setIssueListSortOrder persists and getIssueListSortOrder reads back", async () => {
    const service = buildService();
    const custom = {
      field: "title" as const,
      order: "asc" as const,
    };
    await service.setIssueListSortOrder(custom, "/home/proj");
    const order = await service.getIssueListSortOrder("/home/proj");
    expect(order).toEqual(custom);

    const url = URLFormatter.pathToFileUrl("/home/proj");
    const row = await service.get(
      url,
      "system",
      ProjectStateKey.IssueListSortOrder,
    );
    expect(row?.value).toBe(JSON.stringify(custom));
  });

  test("getPinnedIssueFolderNames returns empty array when key is missing", async () => {
    const service = buildService();
    const list = await service.getPinnedIssueFolderNames("/home/proj");
    expect(list).toEqual([]);
  });

  test("setPinnedIssueFolderNames persists and getPinnedIssueFolderNames reads back", async () => {
    const service = buildService();
    const pinned = ["MI0001-alpha", "MI0002-beta"];
    await service.setPinnedIssueFolderNames(pinned, "/home/proj");
    const list = await service.getPinnedIssueFolderNames("/home/proj");
    expect(list).toEqual(pinned);

    const url = URLFormatter.pathToFileUrl("/home/proj");
    const row = await service.get(url, "system", ProjectStateKey.PinnedIssues);
    expect(row?.value).toBe(JSON.stringify(pinned));
  });

  test("togglePinnedIssueFolderName appends new pins at the bottom and removes existing pins", async () => {
    const service = buildService();
    await service.setPinnedIssueFolderNames(["first"], "/home/proj");

    const pinned = await service.togglePinnedIssueFolderName(
      "/home/proj",
      "second",
    );
    expect(pinned).toBe(true);
    expect(await service.getPinnedIssueFolderNames("/home/proj")).toEqual([
      "first",
      "second",
    ]);

    const unpinned = await service.togglePinnedIssueFolderName(
      "/home/proj",
      "first",
    );
    expect(unpinned).toBe(false);
    expect(await service.getPinnedIssueFolderNames("/home/proj")).toEqual([
      "second",
    ]);
  });
});
