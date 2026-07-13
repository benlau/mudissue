import * as path from "path";
import { jest } from "@jest/globals";
import {
  GIT_MUD_CONFIG_FILENAME,
  MUD_CONFIG_FILENAME,
} from "../../../src/constants.ts";
import { TrackerRepoStorage } from "../../../src/utils/storage/TrackerRepoStorage.ts";
import { FileService } from "../../../src/services/FileService.ts";
import { ShellService } from "../../../src/services/ShellService.ts";
import type { GlobalConfig } from "../../../src/types/GlobalConfig.ts";
import type { TrackerRepo, TrackerRepoConfig } from "../../../src/types/Tracker.ts";
import type { IssueFolder } from "../../../src/types/Issue.ts";
import { createMockShellService } from "../../fixture/MockServiceContext.tsx";

describe("TrackerRepoStorage", () => {
  const emptyGlobal: GlobalConfig = {};

  let mockFileService: jest.Mocked<FileService>;
  let mockShellService: ReturnType<typeof createMockShellService>;

  const buildDirent = (
    name: string,
    isDirectory: boolean,
  ): Awaited<ReturnType<FileService["readdir"]>>[number] =>
    ({
      name,
      isDirectory: () => isDirectory,
    }) as Awaited<ReturnType<FileService["readdir"]>>[number];

  const buildTrackerRepo = (
    overrides: Partial<{
      name: string;
      projectPath: string;
      trackerPath: string;
      config: TrackerRepoConfig;
    }> = {},
  ): TrackerRepo => {
    const projectPath = overrides.projectPath ?? "/repo/root";
    const trackerPath = overrides.trackerPath ?? projectPath;
    return {
      name: "my-repo",
      projectPath,
      trackerPath,
      config: { issue_prefix: null, issue_path: "issues" },
      ...overrides,
      projectPath,
      trackerPath,
    };
  };

  beforeEach(() => {
    mockFileService = {
      exists: jest.fn(),
      readdir: jest.fn(),
      readFile: jest.fn(),
      stat: jest.fn(),
      rename: jest.fn(),
    } as unknown as jest.Mocked<FileService>;
    mockShellService = createMockShellService();
    mockShellService.isAbsolute.mockImplementation((p: string) =>
      path.isAbsolute(p),
    );
    mockShellService.relative.mockImplementation((from: string, to: string) =>
      path.relative(from, to),
    );
    FileService.setInstance(mockFileService as unknown as FileService);
    ShellService.setInstance(mockShellService as unknown as ShellService);
  });

  describe("constructor", () => {
    it("stores the given TrackerRepo and listIssues uses its path and config", async () => {
      const repo = buildTrackerRepo({
        trackerPath: "/custom/path",
        config: { issue_path: "items" },
      });
      mockFileService.exists.mockResolvedValue(true);
      mockFileService.readdir.mockResolvedValue([
        buildDirent("0001", true),
        buildDirent("0002", true),
      ]);

      const storage = new TrackerRepoStorage(repo, emptyGlobal);
      const issues = await storage.listIssues();

      expect(mockFileService.exists).toHaveBeenCalledWith(expect.stringContaining("items"));
      expect(mockFileService.readdir).toHaveBeenCalledWith(
        expect.stringMatching(/\/custom\/path.*items$/),
      );
      expect(issues).toEqual([
        { issueId: "0001", folderName: "0001", path: "/custom/path/items/0001" },
        { issueId: "0002", folderName: "0002", path: "/custom/path/items/0002" },
      ]);
    });
  });

  describe("listIssues()", () => {
    it("returns issue folders when path exists and is readable", async () => {
      const repo = buildTrackerRepo();
      mockFileService.exists.mockResolvedValue(true);
      mockFileService.readdir.mockResolvedValue([
        buildDirent("0001", true),
        buildDirent("0002", true),
        buildDirent("abc", true),
        buildDirent("notes.txt", false),
      ]);

      const storage = new TrackerRepoStorage(repo, emptyGlobal);
      const issues = await storage.listIssues();

      expect(issues).toEqual([
        { issueId: "0001", folderName: "0001", path: "/repo/root/issues/0001" },
        { issueId: "0002", folderName: "0002", path: "/repo/root/issues/0002" },
      ]);
    });

    it("includes both prefixed and bare numeric folders when prefix is set", async () => {
      const repo = buildTrackerRepo({
        config: { issue_prefix: "PROJ-", issue_path: "issues" },
      });
      mockFileService.exists.mockResolvedValue(true);
      mockFileService.readdir.mockResolvedValue([
        buildDirent("PROJ-0001", true),
        buildDirent("PROJ-2-something", true),
        buildDirent("0002", true),
        buildDirent("TASK-1", true),
        buildDirent("notes.txt", false),
      ]);

      const storage = new TrackerRepoStorage(repo, emptyGlobal);
      const issues = await storage.listIssues();

      expect(issues).toEqual([
        { issueId: "PROJ-0001", folderName: "PROJ-0001", path: "/repo/root/issues/PROJ-0001" },
        { issueId: "PROJ-2", folderName: "PROJ-2-something", path: "/repo/root/issues/PROJ-2-something" },
        { issueId: "0002", folderName: "0002", path: "/repo/root/issues/0002" },
        { issueId: "TASK-1", folderName: "TASK-1", path: "/repo/root/issues/TASK-1" },
      ]);
    });

    it("returns [] when issue path does not exist", async () => {
      const repo = buildTrackerRepo();
      mockFileService.exists.mockResolvedValue(false);

      const storage = new TrackerRepoStorage(repo, emptyGlobal);
      const issues = await storage.listIssues();

      expect(issues).toEqual([]);
      expect(mockFileService.readdir).not.toHaveBeenCalled();
    });

    it("returns [] when readdir throws", async () => {
      const repo = buildTrackerRepo();
      mockFileService.exists.mockResolvedValue(true);
      mockFileService.readdir.mockRejectedValue(new Error("Read error"));

      const storage = new TrackerRepoStorage(repo, emptyGlobal);
      const issues = await storage.listIssues();

      expect(issues).toEqual([]);
    });

    it("uses custom issue_path from config", async () => {
      const repo = buildTrackerRepo({ config: { issue_path: "custom-issues" } });
      mockFileService.exists.mockResolvedValue(true);
      mockFileService.readdir.mockResolvedValue([buildDirent("0001", true)]);

      const storage = new TrackerRepoStorage(repo, emptyGlobal);
      const issues = await storage.listIssues();

      expect(mockFileService.exists).toHaveBeenCalledWith(
        expect.stringContaining("custom-issues"),
      );
      expect(mockFileService.readdir).toHaveBeenCalledWith(
        expect.stringContaining("custom-issues"),
      );
      expect(issues[0].path).toBe("/repo/root/custom-issues/0001");
    });

    it("resolves issue_path under a separate trackerPath", async () => {
      const repo = buildTrackerRepo({
        projectPath: "/repo/root",
        trackerPath: "/repo/tracker",
        config: { issue_path: "items" },
      });
      mockFileService.exists.mockResolvedValue(true);
      mockFileService.readdir.mockResolvedValue([buildDirent("0001", true)]);

      const storage = new TrackerRepoStorage(repo, emptyGlobal);
      const issues = await storage.listIssues();

      expect(mockFileService.exists).toHaveBeenCalledWith("/repo/tracker/items");
      expect(mockFileService.readdir).toHaveBeenCalledWith("/repo/tracker/items");
      expect(issues[0].path).toBe("/repo/tracker/items/0001");
    });
  });

  describe("resolveFilePath()", () => {
    it("returns FilePath with relativePath relative to tracker root", () => {
      const repo = buildTrackerRepo();
      const storage = new TrackerRepoStorage(repo, emptyGlobal);
      const fp = storage.resolveFilePath("/repo/root/issues/0001/issue.md");
      expect(fp.absPath).toBe("/repo/root/issues/0001/issue.md");
      expect(fp.relativePath).toBe("issues/0001/issue.md");
    });

    it("handles path outside tracker root", () => {
      const repo = buildTrackerRepo();
      const storage = new TrackerRepoStorage(repo, emptyGlobal);
      const fp = storage.resolveFilePath("/other/place/file.md");
      expect(fp.absPath).toBe("/other/place/file.md");
      expect(fp.relativePath).toContain("..");
      expect(fp.relativePath).toContain("other");
      expect(fp.relativePath).toContain("file.md");
    });
  });

  describe("getIssuePath()", () => {
    it("resolves relative issue_path with .. under trackerPath", () => {
      const repo = buildTrackerRepo({
        trackerPath: "/repo/root",
        config: { issue_path: "../other/issues" },
      });
      const storage = new TrackerRepoStorage(repo, emptyGlobal);
      expect(storage.getIssuePath()).toBe(path.resolve("/repo/root", "../other/issues"));
    });

    it("returns resolved path for default issue_path", () => {
      const repo = buildTrackerRepo();
      const storage = new TrackerRepoStorage(repo, emptyGlobal);
      expect(storage.getIssuePath()).toBe(path.resolve("/repo/root", "issues"));
    });
  });

  describe("getLinkTypes()", () => {
    it("returns default link types when repo config has no link_types", () => {
      const repo = buildTrackerRepo();
      const storage = new TrackerRepoStorage(repo, emptyGlobal);

      expect(storage.getLinkTypes()).toEqual([
        { forward: "parent", reverse: "subissues" },
        { forward: "related", reverse: "related" },
        { forward: "duplicated", reverse: "has_duplicate" },
        { forward: "blocking", reverse: "blocked_by" },
      ]);
    });

    it("returns repo link_types over global default_link_types", () => {
      const repo = buildTrackerRepo({
        config: { link_types: ["depends_on/depended_on_by"] },
      });
      const storage = new TrackerRepoStorage(repo, {
        default_link_types: ["related/related"],
      });

      expect(storage.getLinkTypes()).toEqual([
        { forward: "depends_on", reverse: "depended_on_by" },
      ]);
    });
  });

  describe("folderExists()", () => {
    it("returns true when trackerPath exists and is a directory", async () => {
      const repo = buildTrackerRepo();
      mockFileService.stat.mockResolvedValue({
        isDirectory: () => true,
      } as ReturnType<FileService["stat"]>);

      const storage = new TrackerRepoStorage(repo, emptyGlobal);
      const result = await storage.folderExists();

      expect(mockFileService.stat).toHaveBeenCalledWith("/repo/root");
      expect(result).toBe(true);
    });

    it("returns false when trackerPath is not a directory", async () => {
      const repo = buildTrackerRepo({ trackerPath: "/repo/file" });
      mockFileService.stat.mockResolvedValue({
        isDirectory: () => false,
      } as ReturnType<FileService["stat"]>);

      const storage = new TrackerRepoStorage(repo, emptyGlobal);
      const result = await storage.folderExists();

      expect(result).toBe(false);
    });

    it("returns false when trackerPath does not exist", async () => {
      const repo = buildTrackerRepo({ trackerPath: "/missing/dir" });
      mockFileService.stat.mockRejectedValue(new Error("ENOENT"));

      const storage = new TrackerRepoStorage(repo, emptyGlobal);
      const result = await storage.folderExists();

      expect(result).toBe(false);
    });
  });

  describe("renameIssue()", () => {
    const buildIssueFolder = (
      folderName: string,
      issueId?: string,
    ): IssueFolder => ({
      issueId: issueId ?? folderName,
      folderName,
      path: `/repo/root/issues/${folderName}`,
    });

    it("renames issue file when issue id changes and pattern is long", async () => {
      const repo = buildTrackerRepo({
        config: { issue_path: "issues", issue_file_pattern: "long" },
      });
      const folder = buildIssueFolder("MI0297-summary", "MI0297");
      mockFileService.exists.mockImplementation((p: string) =>
        Promise.resolve(p === "/repo/root/issues/MI0297-summary/MI0297-summary.md"),
      );
      mockFileService.rename.mockResolvedValue(undefined);

      const storage = new TrackerRepoStorage(repo, emptyGlobal);
      const result = await storage.renameIssue(folder, "300-summary");

      expect(result).toEqual({
        oldFolderName: "MI0297-summary",
        newFolderName: "300-summary",
        oldPath: "/repo/root/issues/MI0297-summary",
        newPath: "/repo/root/issues/300-summary",
      });
      expect(mockFileService.rename).toHaveBeenCalledTimes(2);
      expect(mockFileService.rename).toHaveBeenNthCalledWith(
        1,
        "/repo/root/issues/MI0297-summary",
        "/repo/root/issues/300-summary",
      );
      expect(mockFileService.rename).toHaveBeenNthCalledWith(
        2,
        "/repo/root/issues/300-summary/MI0297-summary.md",
        "/repo/root/issues/300-summary/300-summary.md",
      );
    });
  });

  describe("createByProjectPath()", () => {
    it("returns TrackerRepoStorage with config from mud.conf when it exists under projectPath", async () => {
      const projectPath = "/repo/root";
      const mudConfPath = path.join(projectPath, MUD_CONFIG_FILENAME);
      mockFileService.exists.mockResolvedValue(true);
      mockFileService.readFile.mockResolvedValue(
        "issue_path: items\nissue_prefix: P-\nissue_branch_name_template: pr/<%= issue_folder_name %>\n",
      );

      const storage = await TrackerRepoStorage.createByProjectPath(projectPath, emptyGlobal);

      expect(mockFileService.exists).toHaveBeenCalledWith(mudConfPath);
      expect(mockFileService.readFile).toHaveBeenCalledWith(mudConfPath, "utf-8");
      expect(storage).toBeInstanceOf(TrackerRepoStorage);
      expect(storage.getTrackerRepo().config).toEqual({
        issue_prefix: "P-",
        issue_path: "items",
        issue_branch_name_template: "pr/<%= issue_folder_name %>",
      });
      expect(storage.getTrackerRepo().projectPath).toBe(projectPath);
      expect(storage.getTrackerRepo().trackerPath).toBe(projectPath);
      expect(storage.getTrackerRepo().name).toBe("root");
    });

    it("reads from .git/mudissue/mud.conf when mud.conf is missing", async () => {
      const projectPath = "/repo/root";
      const mudConfPath = path.join(projectPath, MUD_CONFIG_FILENAME);
      const gitMudConfPath = path.join(projectPath, GIT_MUD_CONFIG_FILENAME);
      mockFileService.exists
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(true);
      mockFileService.readFile.mockResolvedValue("issue_path: docs\n");

      const storage = await TrackerRepoStorage.createByProjectPath(projectPath, emptyGlobal);

      expect(mockFileService.exists).toHaveBeenCalledWith(mudConfPath);
      expect(mockFileService.exists).toHaveBeenCalledWith(gitMudConfPath);
      expect(mockFileService.readFile).toHaveBeenCalledWith(
        gitMudConfPath,
        "utf-8",
      );
      expect(storage.getTrackerRepo().config.issue_path).toBe("docs");
    });

    it("merges loaded config with defaults", async () => {
      const projectPath = "/repo/root";
      mockFileService.exists.mockResolvedValue(true);
      mockFileService.readFile.mockResolvedValue("issue_prefix: X-\n");

      const storage = await TrackerRepoStorage.createByProjectPath(projectPath, emptyGlobal);

      expect(storage.getTrackerRepo().config).toEqual({
        issue_prefix: "X-",
        issue_path: "issues",
      });
    });

    it("uses defaults when mud.conf is empty", async () => {
      const projectPath = "/repo/root";
      mockFileService.exists.mockResolvedValue(true);
      mockFileService.readFile.mockResolvedValue("");

      const storage = await TrackerRepoStorage.createByProjectPath(projectPath, emptyGlobal);

      expect(storage.getTrackerRepo().config).toEqual({
        issue_prefix: null,
        issue_path: "issues",
      });
    });

    it("uses defaults when mud.conf contains only comments", async () => {
      const projectPath = "/repo/root";
      mockFileService.exists.mockResolvedValue(true);
      mockFileService.readFile.mockResolvedValue(
        "# issue_prefix: \"\"\n# tracker_path:\n# status_list: open, backlog\n",
      );

      const storage = await TrackerRepoStorage.createByProjectPath(projectPath, emptyGlobal);

      expect(storage.getTrackerRepo().config).toEqual({
        issue_prefix: null,
        issue_path: "issues",
      });
    });

    it("returns storage with config.projects when present in YAML", async () => {
      const projectPath = "/repo/root";
      mockFileService.exists.mockResolvedValue(true);
      mockFileService.readFile.mockResolvedValue(
        "issue_path: items\nprojects:\n  - ../proj-a\n  - ../proj-b\n",
      );

      const storage = await TrackerRepoStorage.createByProjectPath(projectPath, emptyGlobal);

      expect(storage.getTrackerRepo().config.projects).toEqual([
        "../proj-a",
        "../proj-b",
      ]);
      expect(storage.getTrackerRepo().config.issue_path).toBe("items");
    });

    it("returns storage with defaults when no config file exists", async () => {
      const projectPath = "/repo/root";
      mockFileService.exists.mockResolvedValue(false);

      const storage = await TrackerRepoStorage.createByProjectPath(projectPath, emptyGlobal);

      expect(mockFileService.readFile).not.toHaveBeenCalled();
      expect(storage.getTrackerRepo().config).toEqual({
        issue_prefix: null,
        issue_path: "issues",
      });
      expect(storage.getTrackerRepo().configFilePath).toBeUndefined();
      expect(storage.getTrackerRepo().projectPath).toBe(projectPath);
      expect(storage.getTrackerRepo().trackerPath).toBe(projectPath);
    });

    it("sets trackerPath equal to projectPath when tracker_path is unset", async () => {
      const projectPath = "/repo/root";
      mockFileService.exists.mockResolvedValue(true);
      mockFileService.readFile.mockResolvedValue("issue_path: items\n");

      const storage = await TrackerRepoStorage.createByProjectPath(projectPath, emptyGlobal);

      expect(storage.getTrackerRepo().trackerPath).toBe(projectPath);
    });

    it("sets trackerPath equal to projectPath when tracker_path is .", async () => {
      const projectPath = "/repo/root";
      mockFileService.exists.mockResolvedValue(true);
      mockFileService.readFile.mockResolvedValue("tracker_path: .\nissue_path: items\n");

      const storage = await TrackerRepoStorage.createByProjectPath(projectPath, emptyGlobal);

      expect(storage.getTrackerRepo().trackerPath).toBe(projectPath);
    });

    it("resolves relative tracker_path under projectPath", async () => {
      const projectPath = "/repo/root";
      mockFileService.exists.mockResolvedValue(true);
      mockFileService.readFile.mockResolvedValue("tracker_path: ../tracker\n");

      const storage = await TrackerRepoStorage.createByProjectPath(projectPath, emptyGlobal);

      expect(storage.getTrackerRepo().trackerPath).toBe(
        path.resolve(projectPath, "../tracker"),
      );
    });

    it("resolves absolute tracker_path", async () => {
      const projectPath = "/repo/root";
      const trackerPath = path.resolve("/external/tracker");
      mockFileService.exists.mockResolvedValue(true);
      mockFileService.readFile.mockResolvedValue(`tracker_path: ${trackerPath}\n`);

      const storage = await TrackerRepoStorage.createByProjectPath(projectPath, emptyGlobal);

      expect(storage.getTrackerRepo().trackerPath).toBe(trackerPath);
    });

    it("rejects mi.conf when priority_list uses object entries instead of strings", async () => {
      const projectPath = "/repo/root";
      const mudConfPath = path.join(projectPath, MUD_CONFIG_FILENAME);
      mockFileService.exists.mockResolvedValue(true);
      mockFileService.readFile.mockResolvedValue(
        "tracker_path: ../tracker\npriority_list:\n  - name: urgent\n    description: Urgent issue\n",
      );

      const err = TrackerRepoStorage.createByProjectPath(projectPath, emptyGlobal);
      await expect(err).rejects.toThrow(/Invalid config/);
      await expect(err).rejects.toThrow(mudConfPath);
      await expect(err).rejects.toThrow(/priority_list/);
    });

    it("rejects mi.conf with malformed YAML", async () => {
      const projectPath = "/repo/root";
      const mudConfPath = path.join(projectPath, MUD_CONFIG_FILENAME);
      mockFileService.exists.mockResolvedValue(true);
      mockFileService.readFile.mockResolvedValue("tracker_path: [\n");

      const err = TrackerRepoStorage.createByProjectPath(projectPath, emptyGlobal);
      await expect(err).rejects.toThrow(/Invalid YAML/);
      await expect(err).rejects.toThrow(mudConfPath);
    });

    it("rejects mi.conf when priority_list has duplicate entries", async () => {
      const projectPath = "/repo/root";
      const mudConfPath = path.join(projectPath, MUD_CONFIG_FILENAME);
      mockFileService.exists.mockResolvedValue(true);
      mockFileService.readFile.mockResolvedValue(
        "tracker_path: ../tracker\npriority_list: urgent, urgent\n",
      );

      const err = TrackerRepoStorage.createByProjectPath(projectPath, emptyGlobal);
      await expect(err).rejects.toThrow(/Invalid priority_list/);
      await expect(err).rejects.toThrow(mudConfPath);
    });

    it("loads scripts without description from mud.conf", async () => {
      const projectPath = "/repo/root";
      mockFileService.exists.mockResolvedValue(true);
      mockFileService.readFile.mockResolvedValue(
        [
          "scripts:",
          '  - name: "Open Primary Issue"',
          '    command: "vim"',
          "    args:",
          '      - "$MUD_ISSUE_ID"',
        ].join("\n"),
      );

      const storage = await TrackerRepoStorage.createByProjectPath(
        projectPath,
        emptyGlobal,
      );

      expect(storage.getTrackerRepo().config.scripts).toEqual([
        {
          name: "Open Primary Issue",
          command: "vim",
          args: ["$MUD_ISSUE_ID"],
        },
      ]);
    });

  });

  describe("find", () => {
    beforeEach(() => {
      mockShellService.cwd.mockReturnValue(process.cwd());
    });

    it("finds repo config in parent when child does not have config", async () => {
      mockShellService.cwd.mockReturnValue("/home/repo/submodule");
      mockFileService.exists.mockImplementation((p: string) => {
        if (
          p === "/home/repo/mud.conf" ||
          p === "/home/repo/.git/mudissue/mud.conf"
        ) {
          return Promise.resolve(true);
        }
        return Promise.resolve(false);
      });

      const result = await TrackerRepoStorage.find();

      expect(result).toEqual({
        root: "/home/repo",
        configPath: "/home/repo/mud.conf",
      });
    });

    it("follows gitdir path before parent and still falls back to parent", async () => {
      mockShellService.cwd.mockReturnValue("/repo/submodule");
      mockFileService.exists.mockImplementation((p: string) => {
        if (p === "/repo/submodule/.git") return Promise.resolve(true);
        if (
          p === "/repo/submodule/mud.conf" ||
          p === "/repo/submodule/.git/mudissue/mud.conf"
        ) {
          return Promise.resolve(false);
        }
        if (p === "/repo/mud.conf" || p === "/repo/.git/mudissue/mud.conf") {
          return Promise.resolve(true);
        }
        return Promise.resolve(false);
      });
      mockFileService.readFile.mockImplementation((p: string) =>
        p === "/repo/submodule/.git"
          ? Promise.resolve("gitdir: /real/git/dir\n")
          : Promise.resolve(""),
      );

      const result = await TrackerRepoStorage.find();

      expect(result).toEqual({
        root: "/repo",
        configPath: "/repo/mud.conf",
      });
    });

    it("avoids infinite recursion for cyclic gitdir references", async () => {
      mockShellService.cwd.mockReturnValue("/A");
      mockFileService.exists.mockImplementation((p: string) => {
        if (p === "/A/.git") return Promise.resolve(true);
        if (p === "/B/.git") return Promise.resolve(true);
        return Promise.resolve(false);
      });
      mockFileService.readFile.mockImplementation((p: string) => {
        if (p === "/A/.git") return Promise.resolve("gitdir: /B\n");
        if (p === "/B/.git") return Promise.resolve("gitdir: /A\n");
        return Promise.resolve("");
      });

      const result = await TrackerRepoStorage.find();

      expect(result).toBeNull();
    });

    it("throws when depth exceeds configured limit", async () => {
      mockShellService.cwd.mockReturnValue("/a/b/c");
      mockFileService.exists.mockResolvedValue(false);

      await expect(
        TrackerRepoStorage.find(undefined, { searchDepthLimit: 2 }),
      ).rejects.toThrow(/search depth exceeded.*max 2/i);
    });
  });
});
