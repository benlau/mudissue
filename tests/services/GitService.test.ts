import { jest } from "@jest/globals";
import * as path from "path";
import { GitService } from "../../src/services/GitService.ts";
import { FileService } from "../../src/services/FileService.ts";

function mockDirent(name: string) {
  return {
    name,
    isDirectory: () => true,
  } as Awaited<ReturnType<FileService["readdir"]>>[number];
}

describe("GitService.listWorktree", () => {
  let mockFileService: jest.Mocked<
    Pick<FileService, "exists" | "stat" | "readdir" | "readFile">
  >;
  let getInstanceSpy: jest.SpiedFunction<typeof FileService.getInstance>;

  beforeEach(() => {
    GitService.setInstance(null);
    mockFileService = {
      exists: jest.fn(),
      stat: jest.fn(),
      readdir: jest.fn(),
      readFile: jest.fn(),
    };
    getInstanceSpy = jest
      .spyOn(FileService, "getInstance")
      .mockReturnValue(mockFileService as unknown as FileService);
  });

  afterEach(() => {
    getInstanceSpy.mockRestore();
    GitService.setInstance(null);
  });

  it("returns main checkout when .git is a directory and there are no linked worktrees", async () => {
    const repoRoot = path.join(path.sep, "test", "repo");
    const dotGit = path.join(repoRoot, ".git");
    const worktreesDir = path.join(dotGit, "worktrees");

    mockFileService.exists.mockImplementation(async (p) => {
      const n = path.normalize(String(p));
      if (n === path.normalize(dotGit)) {
        return true;
      }
      if (n === path.normalize(worktreesDir)) {
        return false;
      }
      return false;
    });
    mockFileService.stat.mockResolvedValue({
      isDirectory: () => true,
      isFile: () => false,
    } as Awaited<ReturnType<FileService["stat"]>>);

    const svc = GitService.getInstance();
    const result = await svc.listWorktree(repoRoot);

    expect(result).toEqual([path.normalize(repoRoot)]);
  });

  it("includes linked worktrees listed under .git/worktrees", async () => {
    const repoRoot = path.join(path.sep, "test", "repo");
    const dotGit = path.join(repoRoot, ".git");
    const worktreesDir = path.join(dotGit, "worktrees");
    const wtName = "MI001-feature";
    const gitdirFilePath = path.join(worktreesDir, wtName, "gitdir");
    const linkedRoot = path.join(
      repoRoot,
      ".claude",
      "worktrees",
      "MI001-feature",
    );
    const linkedDotGit = path.join(linkedRoot, ".git");

    mockFileService.exists.mockImplementation(async (p) => {
      const n = path.normalize(String(p));
      const paths = new Set(
        [dotGit, worktreesDir, gitdirFilePath].map((x) => path.normalize(x)),
      );
      return paths.has(n);
    });
    mockFileService.stat.mockResolvedValue({
      isDirectory: () => true,
      isFile: () => false,
    } as Awaited<ReturnType<FileService["stat"]>>);
    mockFileService.readdir.mockImplementation(async (p) => {
      if (path.normalize(String(p)) === path.normalize(worktreesDir)) {
        return [mockDirent(wtName)];
      }
      return [];
    });
    mockFileService.readFile.mockImplementation(async (p) => {
      if (path.normalize(String(p)) === path.normalize(gitdirFilePath)) {
        return `${linkedDotGit}\n`;
      }
      return "";
    });

    const svc = GitService.getInstance();
    const result = await svc.listWorktree(repoRoot);

    expect(result).toEqual([
      path.normalize(repoRoot),
      path.normalize(linkedRoot),
    ]);
  });

  it("throws when .git is missing at git folder", async () => {
    mockFileService.exists.mockResolvedValue(false);
    await expect(
      GitService.getInstance().listWorktree("/nope"),
    ).rejects.toThrow(/No \.git directory found/);
  });
});

describe("GitService.parseDotGitFileAtFolder", () => {
  let mockFileService: jest.Mocked<Pick<FileService, "readFile">>;
  let getInstanceSpy: jest.SpiedFunction<typeof FileService.getInstance>;

  beforeEach(() => {
    GitService.setInstance(null);
    mockFileService = {
      readFile: jest.fn(),
    } as unknown as jest.Mocked<Pick<FileService, "readFile">>;
    getInstanceSpy = jest
      .spyOn(FileService, "getInstance")
      .mockReturnValue(mockFileService as unknown as FileService);
  });

  afterEach(() => {
    getInstanceSpy.mockRestore();
    GitService.setInstance(null);
  });

  it("returns resolved absolute path for relative gitdir", async () => {
    mockFileService.readFile.mockResolvedValue(
      "gitdir: ../.git/modules/sub\n",
    );
    const dirContainingDotGit = "/repo/submodule";

    const result = await GitService.getInstance().parseDotGitFileAtFolder(
      dirContainingDotGit,
    );

    expect(mockFileService.readFile).toHaveBeenCalledWith(
      "/repo/submodule/.git",
      "utf-8",
    );
    expect(result).toBe("/repo/.git/modules/sub");
  });

  it("returns resolved absolute path for absolute gitdir", async () => {
    mockFileService.readFile.mockResolvedValue(
      "gitdir: /absolute/path/to/gitdir\n",
    );

    const result = await GitService.getInstance().parseDotGitFileAtFolder(
      "/any/dir",
    );

    expect(result).toBe("/absolute/path/to/gitdir");
  });

  it("returns null when file has no gitdir line", async () => {
    mockFileService.readFile.mockResolvedValue("ref: refs/heads/main\n");

    const result = await GitService.getInstance().parseDotGitFileAtFolder(
      "/repo",
    );

    expect(result).toBeNull();
  });

  it("returns null when file is empty", async () => {
    mockFileService.readFile.mockResolvedValue("");

    const result = await GitService.getInstance().parseDotGitFileAtFolder(
      "/repo",
    );

    expect(result).toBeNull();
  });

  it("returns null when gitdir line has no path", async () => {
    mockFileService.readFile.mockResolvedValue("gitdir: \n");

    const result = await GitService.getInstance().parseDotGitFileAtFolder(
      "/repo",
    );

    expect(result).toBeNull();
  });

  it("parses first line matching gitdir", async () => {
    mockFileService.readFile.mockResolvedValue(
      "gitdir: /first/path\nother: line\n",
    );

    const result = await GitService.getInstance().parseDotGitFileAtFolder(
      "/repo",
    );

    expect(result).toBe("/first/path");
  });

  it("trims whitespace from path", async () => {
    mockFileService.readFile.mockResolvedValue("gitdir: /path/with/space \n");

    const result = await GitService.getInstance().parseDotGitFileAtFolder(
      "/repo",
    );

    expect(result).toBe("/path/with/space");
  });

  it("returns null when readFile throws", async () => {
    mockFileService.readFile.mockRejectedValue(new Error("ENOENT"));

    const result = await GitService.getInstance().parseDotGitFileAtFolder(
      "/repo",
    );

    expect(result).toBeNull();
  });
});

describe("GitService.resolveBaseGitFolder", () => {
  let mockFileService: jest.Mocked<Pick<FileService, "readFile">>;
  let getInstanceSpy: jest.SpiedFunction<typeof FileService.getInstance>;

  beforeEach(() => {
    GitService.setInstance(null);
    mockFileService = {
      readFile: jest.fn(),
    } as unknown as jest.Mocked<Pick<FileService, "readFile">>;
    getInstanceSpy = jest
      .spyOn(FileService, "getInstance")
      .mockReturnValue(mockFileService as unknown as FileService);
  });

  afterEach(() => {
    getInstanceSpy.mockRestore();
    GitService.setInstance(null);
  });

  it("returns the checkout folder when .git is a directory", async () => {
    mockFileService.readFile.mockRejectedValue(new Error("ENOENT"));
    const repoRoot = path.join(path.sep, "test", "repo");

    const result = await GitService.getInstance().resolveBaseGitFolder(repoRoot);

    expect(result).toBe(path.normalize(repoRoot));
  });

  it("returns the admin gitdir when .git is a linked worktree file", async () => {
    const worktreeRoot = path.join(path.sep, "test", "repo", "wt");
    const adminGitdir = path.join(
      path.sep,
      "test",
      "repo",
      ".git",
      "worktrees",
      "MI001",
    );
    mockFileService.readFile.mockResolvedValue(
      `gitdir: ${adminGitdir}\n`,
    );

    const result =
      await GitService.getInstance().resolveBaseGitFolder(worktreeRoot);

    expect(result).toBe(path.normalize(adminGitdir));
  });
});

describe("GitService.getGitFolderHeadObjectId", () => {
  let svc: GitService;

  beforeEach(() => {
    GitService.setInstance(null);
    svc = GitService.getInstance();
  });

  afterEach(() => {
    GitService.setInstance(null);
  });

  it("uses resolveRef for main checkout paths", async () => {
    const repoRoot = path.join(path.sep, "test", "repo");
    const resolveRefSpy = jest
      .spyOn(svc, "resolveRef")
      .mockResolvedValue("abcdef1234567890");

    const result = await svc.getGitFolderHeadObjectId(repoRoot);

    expect(resolveRefSpy).toHaveBeenCalledWith(
      path.normalize(repoRoot),
      "HEAD",
    );
    expect(result).toBe("abcdef1");
    resolveRefSpy.mockRestore();
  });
});
