import { jest } from "@jest/globals";
import * as path from "path";
import { GitFolderValidator } from "../../../src/utils/validators/GitFolderValidator.ts";
import { FileService } from "../../../src/services/FileService.ts";
import { ShellService } from "../../../src/services/ShellService.ts";
import type { FileService as FileServiceType } from "../../../src/services/FileService.ts";
import type { ShellService as ShellServiceType } from "../../../src/services/ShellService.ts";

describe("GitFolderValidator", () => {
  const repoRoot = "/repo";

  let mockFileService: jest.Mocked<Pick<FileServiceType, "exists">>;
  let mockShellService: jest.Mocked<Pick<ShellServiceType, "which">>;
  let savedFileService: FileServiceType;
  let savedShellService: ShellServiceType;

  beforeEach(() => {
    savedFileService = FileService.getInstance();
    savedShellService = ShellService.getInstance();
    mockFileService = {
      exists: jest.fn(),
    };
    mockShellService = {
      which: jest.fn(),
    };
    FileService.setInstance(mockFileService as FileServiceType);
    ShellService.setInstance(mockShellService as ShellServiceType);
    jest.clearAllMocks();
  });

  afterEach(() => {
    FileService.setInstance(savedFileService);
    ShellService.setInstance(savedShellService);
  });

  describe("set", () => {
    it("stores repo root and returns this", async () => {
      mockFileService.exists.mockResolvedValue(true);
      mockShellService.which.mockResolvedValue("/usr/bin/git");

      const v = new GitFolderValidator().set(repoRoot);

      await v.validateDotGit();
      expect(mockFileService.exists).toHaveBeenCalledWith(
        path.join(repoRoot, ".git"),
      );
    });
  });

  describe("validateDotGit", () => {
    it("throws DOT_GIT_NOT_FOUND when .git does not exist", async () => {
      mockFileService.exists.mockResolvedValue(false);

      const v = new GitFolderValidator().set(repoRoot);

      await expect(v.validateDotGit()).rejects.toMatchObject({
        status: "error",
        error: { code: "DOT_GIT_NOT_FOUND" },
      });
      expect(mockFileService.exists).toHaveBeenCalledWith(
        path.join(repoRoot, ".git"),
      );
    });

    it("does not throw when .git exists", async () => {
      mockFileService.exists.mockResolvedValue(true);

      const v = new GitFolderValidator().set(repoRoot);

      const chain = await v.validateDotGit();
      expect(chain).toBe(v);
    });
  });

  describe("validateGitBinary", () => {
    it("throws GIT_BINARY_NOT_FOUND when git is not in PATH", async () => {
      mockShellService.which.mockResolvedValue(null);

      const v = new GitFolderValidator().set(repoRoot);

      await expect(v.validateGitBinary()).rejects.toMatchObject({
        status: "error",
        error: { code: "GIT_BINARY_NOT_FOUND" },
      });
      expect(mockShellService.which).toHaveBeenCalledWith("git");
    });

    it("does not throw when git is found", async () => {
      mockShellService.which.mockResolvedValue("/usr/bin/git");

      const v = new GitFolderValidator().set(repoRoot);

      const chain = await v.validateGitBinary();
      expect(chain).toBe(v);
    });
  });

  describe("chaining", () => {
    it("validateDotGit then validateGitBinary passes when both succeed", async () => {
      mockFileService.exists.mockResolvedValue(true);
      mockShellService.which.mockResolvedValue("/usr/bin/git");

      const v = new GitFolderValidator().set(repoRoot);

      await v.validateDotGit();
      await v.validateGitBinary();
      expect(mockFileService.exists).toHaveBeenCalledTimes(1);
      expect(mockShellService.which).toHaveBeenCalledTimes(1);
    });
  });
});
