import { jest } from "@jest/globals";
import { NextIssueIdHelper } from "../../src/helpers/NextIssueIdHelper.ts";
import { TrackerRepoStorage } from "../../src/utils/storage/TrackerRepoStorage.ts";
import { FileService } from "../../src/services/FileService.ts";
import type { GlobalConfig } from "../../src/types/GlobalConfig.ts";
import type { TrackerRepo, TrackerRepoConfig } from "../../src/types/Tracker.ts";
import { createMockSystemContext } from "../fixture/MockSystemContext.tsx";

describe("NextIssueIdHelper", () => {
  const emptyGlobal: GlobalConfig = {};

  let mockFileService: jest.Mocked<FileService>;

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
    const bundle = createMockSystemContext();
    mockFileService = bundle.fileService as unknown as jest.Mocked<FileService>;
  });

  describe("allocateNextIssueId()", () => {
    it("returns padded id with configured prefix", async () => {
      const repo = buildTrackerRepo({
        config: { issue_prefix: "PROJ-", issue_path: "issues" },
      });
      mockFileService.exists.mockResolvedValue(false);

      const storage = new TrackerRepoStorage(repo, emptyGlobal);
      const helper = new NextIssueIdHelper(storage, mockFileService);
      const issueId = await helper.allocateNextIssueId();

      expect(issueId).toBe("PROJ-0001");
    });
  });

  describe("findNextNumber()", () => {
    it("returns default padded ID when issue directory does not exist", async () => {
      const repo = buildTrackerRepo();
      mockFileService.exists.mockResolvedValue(false);

      const storage = new TrackerRepoStorage(repo, emptyGlobal);
      const helper = new NextIssueIdHelper(storage, mockFileService);
      const nextId = await helper.findNextNumber(storage.getIssuePath());

      expect(nextId).toBe(1);
      expect(mockFileService.readdir).not.toHaveBeenCalled();
    });

    it("increments issue IDs using configured prefix while ignoring non-matching folders", async () => {
      const repo = buildTrackerRepo({
        config: { issue_prefix: "PROJ-", issue_path: "issues" },
      });
      mockFileService.exists.mockResolvedValue(true);
      mockFileService.readdir.mockResolvedValue([
        buildDirent("PROJ-9-first", true),
        buildDirent("PROJ-", true),
        buildDirent("something-else", true),
      ]);

      const storage = new TrackerRepoStorage(repo, emptyGlobal);
      const helper = new NextIssueIdHelper(storage, mockFileService);
      const nextId = await helper.findNextNumber(storage.getIssuePath());

      expect(nextId).toBe(10);
    });

    it("supports explicit directory override with detected padding", async () => {
      const repo = buildTrackerRepo();
      const adrPath = "/repo/root/docs/adr";
      mockFileService.exists.mockResolvedValue(true);
      mockFileService.readdir.mockResolvedValue([
        buildDirent("001-first", true),
        buildDirent("010-second", true),
      ]);

      const storage = new TrackerRepoStorage(repo, emptyGlobal);
      const helper = new NextIssueIdHelper(storage, mockFileService);
      const nextId = await helper.findNextNumber(adrPath);

      expect(mockFileService.exists).toHaveBeenCalledWith(adrPath);
      expect(mockFileService.readdir).toHaveBeenCalledWith(adrPath);
      expect(nextId).toBe(11);
    });

    it("returns 0001 when reading issue directory fails", async () => {
      const repo = buildTrackerRepo();
      mockFileService.exists.mockResolvedValue(true);
      mockFileService.readdir.mockRejectedValue(new Error("read failed"));

      const storage = new TrackerRepoStorage(repo, emptyGlobal);
      const helper = new NextIssueIdHelper(storage, mockFileService);
      const nextId = await helper.findNextNumber(storage.getIssuePath());

      expect(nextId).toBe(1);
    });
  });

  describe("resolveIssueId()", () => {
    it("allocates next id when id is blank", async () => {
      const repo = buildTrackerRepo();
      mockFileService.exists.mockResolvedValue(false);

      const storage = new TrackerRepoStorage(repo, emptyGlobal);
      const helper = new NextIssueIdHelper(storage, mockFileService);
      const issueId = await helper.resolveIssueId(undefined, "My issue");

      expect(issueId).toBe("0001");
    });

    it("returns explicit id when folder does not exist", async () => {
      const repo = buildTrackerRepo();
      mockFileService.exists.mockResolvedValue(false);

      const storage = new TrackerRepoStorage(repo, emptyGlobal);
      const helper = new NextIssueIdHelper(storage, mockFileService);
      const issueId = await helper.resolveIssueId("MI0042", "My issue");

      expect(issueId).toBe("MI0042");
    });

    it("throws when explicit id folder already exists", async () => {
      const repo = buildTrackerRepo();
      mockFileService.exists.mockResolvedValue(true);

      const storage = new TrackerRepoStorage(repo, emptyGlobal);
      const helper = new NextIssueIdHelper(storage, mockFileService);

      await expect(
        helper.resolveIssueId("MI0042", "My issue"),
      ).rejects.toThrow("Issue already exists: MI0042-my-issue");
    });
  });
});
