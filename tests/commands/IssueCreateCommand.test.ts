import { jest } from "@jest/globals";
import {
  IssueCreateCommand,
  type IssueCreateCommandArgs,
} from "../../src/commands/IssueCreateCommand.ts";
import { IssueResource } from "../../src/utils/resources/IssueResource.ts";
import { NextIssueIdHelper } from "../../src/helpers/NextIssueIdHelper.ts";
import { TrackerRepoStorage } from "../../src/utils/storage/TrackerRepoStorage.ts";
import { IssueFolderStorage } from "../../src/utils/storage/IssueFolderStorage.ts";
import { LoggerService } from "../../src/services/LoggerService.ts";
import type { FileService } from "../../src/services/FileService.ts";
import {
  createMockSystemContext,
  type MockSystemContextBundle,
} from "../fixture/MockSystemContext.tsx";

describe("IssueCreateCommand", () => {
  let mockIssueResource: jest.Mocked<
    Pick<IssueResource, "create" | "createFromFile">
  >;
  let bundle: MockSystemContextBundle;

  const stubRepo = {
    name: "repo",
    projectPath: "/repo",
    trackerPath: "/repo",
    config: { issue_path: "issues" },
  };

  const issueBody = "Issue body";

  beforeEach(() => {
    bundle = createMockSystemContext();
    mockIssueResource = {
      create: jest.fn(),
      createFromFile: jest.fn(),
    } as unknown as jest.Mocked<
      Pick<IssueResource, "create" | "createFromFile">
    >;
    bundle.trackerRepoStore.getCurrentTrackerRepo.mockResolvedValue(stubRepo);
    bundle.issueFinderService.find.mockResolvedValue([]);
    bundle.shellService.cwd.mockReturnValue("/cwd");
    bundle.shellService.isAbsolute.mockReturnValue(false);
    jest
      .spyOn(TrackerRepoStorage.prototype, "getDefaultStatus")
      .mockReturnValue("open");
    jest
      .spyOn(TrackerRepoStorage.prototype, "getDefaultPriority")
      .mockReturnValue("urgent");
    LoggerService.setInstance(
      bundle.loggerService as unknown as LoggerService,
    );
  });

  afterEach(() => {
    LoggerService.setInstance(new LoggerService());
  });

  it("returns SuccessResponse with createdIssue on success", async () => {
    const createdFolder = {
      issueId: "0001",
      folderName: "0001-my-issue",
      path: "/repo/issues/0001-my-issue",
      title: "My issue",
    };
    (mockIssueResource.create as jest.Mock).mockResolvedValue(createdFolder);

    jest
      .spyOn(NextIssueIdHelper.prototype, "resolveIssueId")
      .mockResolvedValue("0001");
    jest
      .spyOn(TrackerRepoStorage.prototype, "getIssuePath")
      .mockReturnValue("/repo/issues");
    jest.spyOn(TrackerRepoStorage.prototype, "resolveFilePath").mockImplementation(
      (absPath: string) => ({
        absPath,
        relativePath: absPath.replace("/repo/", ""),
      }),
    );
    const resolveIssueFilePathSpy = jest
      .spyOn(TrackerRepoStorage.prototype, "resolveIssueFilePath")
      .mockResolvedValue("/repo/issues/0001-my-issue/issue.md");

    const command = new IssueCreateCommand({
      issueResource: mockIssueResource as unknown as IssueResource,
    });

    const args: IssueCreateCommandArgs = {
      title: "My issue",
      content: issueBody,
    };
    const result = await command.command(args);

    expect(result.status).toBe("ok");
    expect(result.result).toEqual({
      createdIssue: {
        issueId: "0001",
        issueFolderName: "0001-my-issue",
        issueFilePath: "/repo/issues/0001-my-issue/issue.md",
      },
    });
    expect(mockIssueResource.create).toHaveBeenCalledWith(
      {
        issueId: "0001",
        folderName: "0001-my-issue",
        path: "/repo/issues/0001-my-issue",
      },
      "/repo/issues/0001-my-issue/issue.md",
      "My issue",
      undefined,
      "open",
      "urgent",
      "long",
      issueBody,
    );
    expect(resolveIssueFilePathSpy).toHaveBeenCalledWith(createdFolder);
    expect(bundle.loggerService.info).toHaveBeenCalled();
    jest.restoreAllMocks();
  });

  it("uses the first configured status as default for new issues", async () => {
    const repoWithCustomStatus = {
      ...stubRepo,
      config: {
        issue_path: "issues",
        status_list: "pending, open, closed",
      },
    };
    bundle.trackerRepoStore.getCurrentTrackerRepo.mockResolvedValue(
      repoWithCustomStatus,
    );
    jest
      .spyOn(TrackerRepoStorage.prototype, "getDefaultStatus")
      .mockReturnValue("pending");

    (mockIssueResource.create as jest.Mock).mockResolvedValue({
      issueId: "0001",
      folderName: "0001-my-issue",
      path: "/repo/issues/0001-my-issue",
      title: "My issue",
    });

    jest
      .spyOn(NextIssueIdHelper.prototype, "resolveIssueId")
      .mockResolvedValue("0001");
    jest
      .spyOn(TrackerRepoStorage.prototype, "getIssuePath")
      .mockReturnValue("/repo/issues");
    jest.spyOn(TrackerRepoStorage.prototype, "resolveFilePath").mockImplementation(
      (absPath: string) => ({
        absPath,
        relativePath: absPath.replace("/repo/", ""),
      }),
    );
    jest
      .spyOn(TrackerRepoStorage.prototype, "resolveIssueFilePath")
      .mockResolvedValue("/repo/issues/0001-my-issue/issue.md");

    const command = new IssueCreateCommand({
      issueResource: mockIssueResource as unknown as IssueResource,
    });

    await command.command({ title: "My issue", content: issueBody });

    expect(mockIssueResource.create).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      "My issue",
      undefined,
      "pending",
      "urgent",
      "long",
      issueBody,
    );
    jest.restoreAllMocks();
  });

  it("uses the marked default priority for new issues", async () => {
    const repoWithCustomPriority = {
      ...stubRepo,
      config: {
        issue_path: "issues",
        priority_list: "urgent, high, *medium, low",
      },
    };
    bundle.trackerRepoStore.getCurrentTrackerRepo.mockResolvedValue(
      repoWithCustomPriority,
    );
    jest
      .spyOn(TrackerRepoStorage.prototype, "getDefaultPriority")
      .mockReturnValue("medium");

    (mockIssueResource.create as jest.Mock).mockResolvedValue({
      issueId: "0001",
      folderName: "0001-my-issue",
      path: "/repo/issues/0001-my-issue",
      title: "My issue",
    });

    jest
      .spyOn(NextIssueIdHelper.prototype, "resolveIssueId")
      .mockResolvedValue("0001");
    jest
      .spyOn(TrackerRepoStorage.prototype, "getIssuePath")
      .mockReturnValue("/repo/issues");
    jest.spyOn(TrackerRepoStorage.prototype, "resolveFilePath").mockImplementation(
      (absPath: string) => ({
        absPath,
        relativePath: absPath.replace("/repo/", ""),
      }),
    );
    jest
      .spyOn(TrackerRepoStorage.prototype, "resolveIssueFilePath")
      .mockResolvedValue("/repo/issues/0001-my-issue/issue.md");

    const command = new IssueCreateCommand({
      issueResource: mockIssueResource as unknown as IssueResource,
    });

    await command.command({ title: "My issue", content: issueBody });

    expect(mockIssueResource.create).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      "My issue",
      undefined,
      "open",
      "medium",
      "long",
      issueBody,
    );
    jest.restoreAllMocks();
  });

  it("calls issueResource.create with parentFolderName when parent is provided", async () => {
    const parentFolder = {
      issueId: "FN004",
      folderName: "FN004-parent-feature",
      path: "/repo/issues/FN004-parent-feature",
    };
    (bundle.issueFinderService.find as jest.Mock).mockResolvedValue([
      parentFolder,
    ]);

    const createdFolder = {
      issueId: "0002",
      folderName: "0002-child-issue",
      path: "/repo/issues/0002-child-issue",
      title: "Child issue",
    };
    (mockIssueResource.create as jest.Mock).mockResolvedValue(createdFolder);

    jest
      .spyOn(NextIssueIdHelper.prototype, "resolveIssueId")
      .mockResolvedValue("0002");
    jest
      .spyOn(TrackerRepoStorage.prototype, "getIssuePath")
      .mockReturnValue("/repo/issues");
    jest.spyOn(TrackerRepoStorage.prototype, "resolveFilePath").mockImplementation(
      (absPath: string) => ({
        absPath,
        relativePath: absPath.replace("/repo/", ""),
      }),
    );

    const parentIssueFilePath =
      "/repo/issues/FN004-parent-feature/issue.md";
    const resolveIssueFilePathSpy = jest
      .spyOn(TrackerRepoStorage.prototype, "resolveIssueFilePath")
      .mockImplementation((folder: { folderName: string }) =>
        folder.folderName === "FN004-parent-feature"
          ? Promise.resolve(parentIssueFilePath)
          : Promise.resolve("/repo/issues/0002-child-issue/issue.md"),
      );
    const appendSubissueSpy = jest
      .spyOn(IssueFolderStorage.prototype, "appendSubissue")
      .mockResolvedValue(undefined);

    const command = new IssueCreateCommand({
            issueResource: mockIssueResource as unknown as IssueResource,
    });

    const result = await command.command({
      title: "Child issue",
      parent: "FN004",
      content: issueBody,
    });

    expect(result.status).toBe("ok");
    expect(bundle.issueFinderService.find).toHaveBeenCalledWith("FN004");
    expect(mockIssueResource.create).toHaveBeenCalledWith(
      expect.objectContaining({
        issueId: "0002",
        folderName: "0002-child-issue",
      }),
      "/repo/issues/0002-child-issue/issue.md",
      "Child issue",
      "FN004-parent-feature",
      "open",
      "urgent",
      "long",
      issueBody,
    );
    expect(appendSubissueSpy).toHaveBeenCalledWith("0002-child-issue", "long");
    jest.restoreAllMocks();
    appendSubissueSpy.mockRestore();
  });

  it("throws when parent is provided but not found", async () => {
    (bundle.issueFinderService.find as jest.Mock).mockResolvedValue([]);

    const command = new IssueCreateCommand({
            issueResource: mockIssueResource as unknown as IssueResource,
    });

    await expect(
      command.command({
        title: "My issue",
        parent: "999",
      }),
    ).rejects.toMatchObject({
      status: "error",
      error: { code: "ISSUE_NOT_FOUND" },
    });
    expect(mockIssueResource.create).not.toHaveBeenCalled();
  });

  it("throws when parent matches multiple issues", async () => {
    (bundle.issueFinderService.find as jest.Mock).mockResolvedValue([
      {
        issueId: "1",
        folderName: "1-a",
        path: "/repo/issues/1-a",
      },
      {
        issueId: "1",
        folderName: "1-b",
        path: "/repo/issues/1-b",
      },
    ]);

    const command = new IssueCreateCommand({
            issueResource: mockIssueResource as unknown as IssueResource,
    });

    await expect(
      command.command({
        title: "My issue",
        parent: "1",
      }),
    ).rejects.toMatchObject({
      status: "error",
      error: { code: "ISSUE_MULTI_MATCHED" },
    });
    expect(mockIssueResource.create).not.toHaveBeenCalled();
  });

  it("throws when issue creation fails (runCommand wraps)", async () => {
    (mockIssueResource.create as jest.Mock).mockRejectedValue(
      new Error("Title required"),
    );
    const command = new IssueCreateCommand({
            issueResource: mockIssueResource as unknown as IssueResource,
    });

    await expect(
      command.command({
        title: "",
        content: issueBody,
      }),
    ).rejects.toThrow("Title required");
  });

  it("throws when project is specified but not found", async () => {
    bundle.trackerRepoStore.getCurrentTrackerRepo.mockResolvedValue(stubRepo);
    bundle.trackerRepoStore.getTrackerRepoByProjectName.mockResolvedValue(null);

    const command = new IssueCreateCommand({
            issueResource: mockIssueResource as unknown as IssueResource,
    });

    await expect(
      command.command({
        title: "My issue",
        project: "nonexistent-project",
      }),
    ).rejects.toMatchObject({
      status: "error",
      error: {
        code: "PROJECT_NOT_FOUND",
        message: expect.stringContaining("nonexistent-project"),
      },
    });
    expect(mockIssueResource.create).not.toHaveBeenCalled();
  });

  describe("issue content (--content)", () => {
    function stubCreatePath(): void {
      jest
        .spyOn(NextIssueIdHelper.prototype, "resolveIssueId")
        .mockResolvedValue("0001");
      jest
        .spyOn(TrackerRepoStorage.prototype, "getIssuePath")
        .mockReturnValue("/repo/issues");
      jest
        .spyOn(TrackerRepoStorage.prototype, "resolveFilePath")
        .mockImplementation((absPath: string) => ({
          absPath,
          relativePath: absPath.replace("/repo/", ""),
        }));
      jest
        .spyOn(TrackerRepoStorage.prototype, "resolveIssueFilePath")
        .mockResolvedValue("/repo/issues/0001-my-issue/issue.md");
      (mockIssueResource.create as jest.Mock).mockResolvedValue({
        issueId: "0001",
        folderName: "0001-my-issue",
        path: "/repo/issues/0001-my-issue",
        title: "My issue",
      });
    }

    it("passes --content to issueResource.create", async () => {
      stubCreatePath();
      const command = new IssueCreateCommand({
        issueResource: mockIssueResource as unknown as IssueResource,
      });

      await command.command({
        title: "My issue",
        content: "Provided body",
      });

      expect(mockIssueResource.create).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        "My issue",
        undefined,
        "open",
        "urgent",
        "long",
        "Provided body",
      );
      jest.restoreAllMocks();
    });

    it("passes empty --content without prompting", async () => {
      stubCreatePath();
      class TestCommand extends IssueCreateCommand {
        protected override async askUserTextContent(): Promise<string | null> {
          throw new Error("should not prompt when --content is passed");
        }
      }
      const command = new TestCommand({
        issueResource: mockIssueResource as unknown as IssueResource,
      });

      await command.command({ title: "My issue", content: "" });

      expect(mockIssueResource.create).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        "My issue",
        undefined,
        "open",
        "urgent",
        "long",
        "",
      );
      jest.restoreAllMocks();
    });

    it("uses askUserTextContent when --content is omitted", async () => {
      stubCreatePath();
      class TestCommand extends IssueCreateCommand {
        protected override async askUserTextContent(): Promise<string | null> {
          return "From prompt";
        }
      }
      const command = new TestCommand({
        issueResource: mockIssueResource as unknown as IssueResource,
      });

      await command.command({ title: "My issue" });

      expect(mockIssueResource.create).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        "My issue",
        undefined,
        "open",
        "urgent",
        "long",
        "From prompt",
      );
      jest.restoreAllMocks();
    });

    it("throws CREATE_ISSUE_CONTENT_EMPTY when interactive input is cancelled", async () => {
      stubCreatePath();
      class TestCommand extends IssueCreateCommand {
        protected override async askUserTextContent(): Promise<string | null> {
          return null;
        }
      }
      const command = new TestCommand({
        issueResource: mockIssueResource as unknown as IssueResource,
      });

      await expect(command.command({ title: "My issue" })).rejects.toMatchObject({
        status: "error",
        error: { code: "CREATE_ISSUE_CONTENT_EMPTY" },
      });
      expect(mockIssueResource.create).not.toHaveBeenCalled();
      jest.restoreAllMocks();
    });

    it("ignores --content when --file is used", async () => {
      bundle.fileService.exists.mockResolvedValue(true);
      bundle.fileService.stat.mockResolvedValue({
        isFile: () => true,
      } as ReturnType<FileService["stat"]>);
      bundle.fileService.isBinaryFile.mockResolvedValue(false);
      bundle.fileService.readFile.mockResolvedValue("---\ntitle: Plan\n---\n");
      (mockIssueResource.createFromFile as jest.Mock).mockResolvedValue({
        issueId: "0001",
        folderName: "0001-plan",
        path: "/repo/issues/0001-plan",
        title: "Plan",
      });
      jest
        .spyOn(NextIssueIdHelper.prototype, "resolveIssueId")
        .mockResolvedValue("0001");
      jest
        .spyOn(TrackerRepoStorage.prototype, "getIssuePath")
        .mockReturnValue("/repo/issues");
      jest
        .spyOn(TrackerRepoStorage.prototype, "resolveFilePath")
        .mockImplementation((absPath: string) => ({
          absPath,
          relativePath: absPath.replace("/repo/", ""),
        }));
      jest
        .spyOn(TrackerRepoStorage.prototype, "resolveIssueFilePath")
        .mockResolvedValue("/repo/issues/0001-plan/issue.md");

      const command = new IssueCreateCommand({
        issueResource: mockIssueResource as unknown as IssueResource,
      });

      await command.command({
        title: "",
        file: "plan.md",
        content: "Ignored body",
      });

      expect(mockIssueResource.createFromFile).toHaveBeenCalled();
      expect(mockIssueResource.create).not.toHaveBeenCalled();
      jest.restoreAllMocks();
    });
  });

  describe("create from file (--file)", () => {
    const resolvedPath = "/cwd/plan.md";
    const successResult = {
      issueId: "0001",
      folderName: "0001-plan",
      path: "/repo/issues/0001-plan",
      title: "Plan",
    };

    it("calls createFromFile with resolved path when file is valid", async () => {
      bundle.fileService.exists.mockResolvedValue(true);
      bundle.fileService.stat.mockResolvedValue({
        isFile: () => true,
      } as ReturnType<FileService["stat"]>);
      bundle.fileService.isBinaryFile.mockResolvedValue(false);
      bundle.fileService.readFile.mockResolvedValue("---\ntitle: Plan\n---\n");
      (mockIssueResource.createFromFile as jest.Mock).mockResolvedValue(
        successResult,
      );
      jest
        .spyOn(NextIssueIdHelper.prototype, "resolveIssueId")
        .mockResolvedValue("0001");
      jest
        .spyOn(TrackerRepoStorage.prototype, "getIssuePath")
        .mockReturnValue("/repo/issues");
      jest.spyOn(TrackerRepoStorage.prototype, "resolveFilePath").mockImplementation(
        (absPath: string) => ({
          absPath,
          relativePath: absPath.replace("/repo/", ""),
        }),
      );
      jest
        .spyOn(TrackerRepoStorage.prototype, "resolveIssueFilePath")
        .mockResolvedValue("/repo/issues/0001-plan/issue.md");

      const command = new IssueCreateCommand({
        issueResource: mockIssueResource as unknown as IssueResource,
      });

      const result = await command.command({
        title: "",
        file: "plan.md",
      });

      expect(result.status).toBe("ok");
      expect(result.result).toEqual({
        createdIssue: {
          issueId: "0001",
          issueFolderName: "0001-plan",
          issueFilePath: "/repo/issues/0001-plan/issue.md",
        },
      });
      expect(mockIssueResource.createFromFile).toHaveBeenCalledWith(
        resolvedPath,
        expect.objectContaining({
          issueId: "0001",
          folderName: "0001-plan",
        }),
        "/repo/issues/0001-plan/issue.md",
        "Plan",
      );
      expect(mockIssueResource.create).not.toHaveBeenCalled();
      jest.restoreAllMocks();
    });

    it("ignores title when both file and title provided", async () => {
      bundle.fileService.exists.mockResolvedValue(true);
      bundle.fileService.stat.mockResolvedValue({
        isFile: () => true,
      } as ReturnType<FileService["stat"]>);
      bundle.fileService.isBinaryFile.mockResolvedValue(false);
      bundle.fileService.readFile.mockResolvedValue("---\ntitle: Plan\n---\n");
      (mockIssueResource.createFromFile as jest.Mock).mockResolvedValue(
        successResult,
      );
      jest
        .spyOn(NextIssueIdHelper.prototype, "resolveIssueId")
        .mockResolvedValue("0001");
      jest
        .spyOn(TrackerRepoStorage.prototype, "getIssuePath")
        .mockReturnValue("/repo/issues");
      jest.spyOn(TrackerRepoStorage.prototype, "resolveFilePath").mockImplementation(
        (absPath: string) => ({
          absPath,
          relativePath: absPath.replace("/repo/", ""),
        }),
      );
      jest
        .spyOn(TrackerRepoStorage.prototype, "resolveIssueFilePath")
        .mockResolvedValue("/repo/issues/0001-plan/issue.md");

      const command = new IssueCreateCommand({
        issueResource: mockIssueResource as unknown as IssueResource,
      });

      await command.command({
        title: "Custom title",
        file: "plan.md",
      });

      expect(mockIssueResource.createFromFile).toHaveBeenCalledWith(
        resolvedPath,
        expect.objectContaining({ folderName: "0001-plan" }),
        "/repo/issues/0001-plan/issue.md",
        "Plan",
      );
      jest.restoreAllMocks();
    });

    it("throws error response when file does not exist", async () => {
      bundle.fileService.exists.mockResolvedValue(false);

      const command = new IssueCreateCommand({
                issueResource: mockIssueResource as unknown as IssueResource,
      });

      await expect(
        command.command({
          title: "",
          file: "missing.md",
        }),
      ).rejects.toMatchObject({
        status: "error",
        error: { code: "CREATE_ISSUE_FILE_NOT_FOUND" },
      });
      expect(mockIssueResource.createFromFile).not.toHaveBeenCalled();
    });

    it("throws error response when path is a directory", async () => {
      bundle.fileService.exists.mockResolvedValue(true);
      bundle.fileService.stat.mockResolvedValue({
        isFile: () => false,
      } as ReturnType<FileService["stat"]>);

      const command = new IssueCreateCommand({
                issueResource: mockIssueResource as unknown as IssueResource,
      });

      await expect(
        command.command({
          title: "",
          file: "dir/",
        }),
      ).rejects.toMatchObject({
        status: "error",
        error: { code: "CREATE_ISSUE_PATH_NOT_FILE" },
      });
      expect(mockIssueResource.createFromFile).not.toHaveBeenCalled();
    });

    it("throws error response when file is binary", async () => {
      bundle.fileService.exists.mockResolvedValue(true);
      bundle.fileService.stat.mockResolvedValue({
        isFile: () => true,
      } as ReturnType<FileService["stat"]>);
      bundle.fileService.isBinaryFile.mockResolvedValue(true);

      const command = new IssueCreateCommand({
                issueResource: mockIssueResource as unknown as IssueResource,
      });

      await expect(
        command.command({
          title: "",
          file: "binary.png",
        }),
      ).rejects.toMatchObject({
        status: "error",
        error: { code: "CREATE_ISSUE_FILE_BINARY" },
      });
      expect(mockIssueResource.createFromFile).not.toHaveBeenCalled();
    });
  });
});
