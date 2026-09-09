import * as path from "path";
import { jest } from "@jest/globals";
import { IssueSetPropertyCommand } from "../../src/commands/IssueSetPropertyCommand.ts";
import {
  resetIssueMetadataChangedPostHookStore,
  useIssueMetadataChangedPostHookStore,
} from "../../src/store/IssueMetadataChangedPostHookStore.ts";
import { IssueFolderStorage } from "../../src/utils/storage/IssueFolderStorage.ts";
import type { IssueFolder } from "../../src/types/Issue.ts";
import { SystemRuleKey } from "../../src/types/rules.ts";
import type { TrackerRepo } from "../../src/types/Tracker.ts";
import { createMockSystemContext } from "../fixture/MockSystemContext.tsx";

const buildIssueFolder = (issueId: string, label?: string): IssueFolder => ({
  issueId,
  label: label ?? extractIssueLabel(issueId),
  path: `/dummy/${issueId}`,
});

const extractIssueLabel = (issueId: string): string => {
  const m = issueId.trim().match(/^([a-zA-Z_-]*)(\d+)(?:-(.*))?$/);
  return m ? `${m[1]}${m[2]}` : issueId;
};

describe("IssueSetPropertyCommand", () => {
  let fileService: ReturnType<typeof createMockSystemContext>["fileService"];
  let issueFinderService: ReturnType<typeof createMockSystemContext>["issueFinderService"];
  let trackerRepoStore: ReturnType<typeof createMockSystemContext>["trackerRepoStore"];
  let shellService: ReturnType<typeof createMockSystemContext>["shellService"];

  const mockRepo: TrackerRepo = {
    name: "my-repo",
    projectPath: "/repo",
    trackerPath: "/repo",
    config: { issue_path: "issues" },
  };

  beforeEach(() => {
    resetIssueMetadataChangedPostHookStore();
    const bundle = createMockSystemContext();
    fileService = bundle.fileService;
    issueFinderService = bundle.issueFinderService;
    trackerRepoStore = bundle.trackerRepoStore;
    shellService = bundle.shellService;

    shellService.cwd.mockReturnValue("/repo");
    shellService.relative.mockImplementation((from: string, to: string) =>
      path.relative(from, to),
    );

    jest.clearAllMocks();

    shellService.cwd.mockReturnValue("/repo");
    shellService.relative.mockImplementation((from: string, to: string) =>
      path.relative(from, to),
    );
  });

  test("returns ErrorResponse when 0 matches", async () => {
    issueFinderService.find.mockResolvedValue([]);

    const command = new IssueSetPropertyCommand();

    await expect(
      command.command("0001", "status", "open"),
    ).rejects.toMatchObject({
      status: "error",
      error: { code: "ISSUE_NOT_FOUND" },
    });
    expect(trackerRepoStore.getCurrentTrackerRepo).not.toHaveBeenCalled();
  });

  test("returns ErrorResponse when multiple matches", async () => {
    const folders: IssueFolder[] = [
      buildIssueFolder("0001-rename", "0001"),
      buildIssueFolder("0001-other", "0001"),
    ];
    issueFinderService.find.mockResolvedValue(folders);

    const command = new IssueSetPropertyCommand();

    await expect(
      command.command("0001", "status", "open"),
    ).rejects.toMatchObject({
      status: "error",
      error: { code: "ISSUE_MULTI_MATCHED" },
    });
    expect(trackerRepoStore.getCurrentTrackerRepo).not.toHaveBeenCalled();
  });

  test("returns ErrorResponse when property key is invalid", async () => {
    issueFinderService.find.mockResolvedValue([
      buildIssueFolder("0001"),
    ]);

    const command = new IssueSetPropertyCommand();

    const result = await command.command("0001", "invalid key", "value");

    expect(result.status).toBe("error");
    expect((result as { error: { code: string } }).error.code).toBe(
      "SET_ISSUE_INVALID_PROPERTY",
    );
  });

  test("returns ErrorResponse when no issue file found", async () => {
    issueFinderService.find.mockResolvedValue([
      buildIssueFolder("0001"),
    ]);
    trackerRepoStore.getCurrentTrackerRepo.mockResolvedValue(
      mockRepo,
    );
    fileService.exists.mockResolvedValue(false);
    fileService.readdir.mockResolvedValue([]);

    const command = new IssueSetPropertyCommand();

    const issueFilePath = path.join("/dummy", "0001", "issue.md");

    const result = await command.command("0001", "status", "open");

    expect(result.status).toBe("error");
    expect((result as { error: { code: string } }).error.code).toBe(
      "ISSUE_MD_MISSING",
    );
    expect((result as { error: { details: { path: string } } }).error.details.path).toBe(
      "/dummy/0001",
    );
    expect(fileService.exists).toHaveBeenCalledWith(issueFilePath);
  });

  test("returns ErrorResponse when issue file is binary", async () => {
    issueFinderService.find.mockResolvedValue([
      buildIssueFolder("0001-rename", "0001"),
    ]);
    trackerRepoStore.getCurrentTrackerRepo.mockResolvedValue(mockRepo);
    fileService.exists.mockResolvedValue(true);
    fileService.isBinaryFile.mockResolvedValue(true);

    const result = await new IssueSetPropertyCommand().command(
      "0001",
      "status",
      "open",
    );

    expect(result.status).toBe("error");
    expect((result as { error: { code: string } }).error.code).toBe(
      "SET_FILE_BINARY",
    );
    expect(fileService.writeFile).not.toHaveBeenCalled();
  });

  test("returns SuccessResponse when exactly one match and file exists", async () => {
    const folders: IssueFolder[] = [
      buildIssueFolder("0001-rename", "0001"),
    ];
    issueFinderService.find.mockResolvedValue(folders);
    trackerRepoStore.getCurrentTrackerRepo.mockResolvedValue(
      mockRepo,
    );
    fileService.exists.mockResolvedValue(true);
    fileService.isBinaryFile.mockResolvedValue(false);
    const originalContent = `---
title: An issue
---
# Body
`;
    fileService.readFile.mockResolvedValue(originalContent);
    fileService.writeFile.mockResolvedValue(undefined);
    const touchUpdatedAtSpy = jest.spyOn(
      IssueFolderStorage.prototype,
      "touchUpdatedAt",
    );

    const command = new IssueSetPropertyCommand();

    const result = await command.command("0001", "status", "open");

    expect(result.status).toBe("ok");
    expect(result.result.property).toBe("status");
    expect(result.result.value).toBe("open");
    const expectedPath = path.join("/dummy", "0001-rename", "issue.md");
    expect(result.result.issueFilePath).toBe(expectedPath);
    expect(fileService.readFile).toHaveBeenCalledWith(expectedPath, "utf-8");
    expect(fileService.writeFile).toHaveBeenCalledWith(
      expectedPath,
      expect.stringContaining("status: open"),
    );
    expect(touchUpdatedAtSpy).toHaveBeenCalled();
    expect(fileService.writeFile).toHaveBeenCalledTimes(2);
    expect(fileService.writeFile).toHaveBeenLastCalledWith(
      expectedPath,
      expect.stringMatching(/updated_at:/),
    );
  });

  test("does not touch updated_at when skipUpdatedAt is true", async () => {
    const folders: IssueFolder[] = [
      buildIssueFolder("0001-rename", "0001"),
    ];
    issueFinderService.find.mockResolvedValue(folders);
    trackerRepoStore.getCurrentTrackerRepo.mockResolvedValue(
      mockRepo,
    );
    fileService.exists.mockResolvedValue(true);
    fileService.isBinaryFile.mockResolvedValue(false);
    const originalContent = `---
title: An issue
---
# Body
`;
    fileService.readFile.mockResolvedValue(originalContent);
    fileService.writeFile.mockResolvedValue(undefined);
    const touchUpdatedAtSpy = jest.spyOn(
      IssueFolderStorage.prototype,
      "touchUpdatedAt",
    );

    const command = new IssueSetPropertyCommand();

    const result = await command.command("0001", "status", "open", undefined, {
      skipUpdatedAt: true,
    });

    expect(result.status).toBe("ok");
    expect(touchUpdatedAtSpy).not.toHaveBeenCalled();
    expect(fileService.writeFile).toHaveBeenCalledTimes(1);
    expect(fileService.writeFile).toHaveBeenCalledWith(
      path.join("/dummy", "0001-rename", "issue.md"),
      expect.not.stringMatching(/updated_at:/),
    );
  });

  test("throws PROJECT_NOT_FOUND when project is passed but not found", async () => {
    trackerRepoStore.getTrackerRepoByProjectName.mockResolvedValue(
      null,
    );

    const command = new IssueSetPropertyCommand();

    await expect(
      command.command("07", "status", "open", "123"),
    ).rejects.toMatchObject({
      status: "error",
      error: {
        code: "PROJECT_NOT_FOUND",
        message: expect.stringContaining("123"),
        details: { project: "123" },
      },
    });
    expect(issueFinderService.find).not.toHaveBeenCalled();
  });

  test("calls find with project option when project is passed and repo exists", async () => {
    trackerRepoStore.getTrackerRepoByProjectName.mockResolvedValue(
      mockRepo,
    );
    issueFinderService.find.mockResolvedValue([]);

    const command = new IssueSetPropertyCommand();

    await expect(
      command.command("0001", "status", "open", "proj-a"),
    ).rejects.toMatchObject({
      status: "error",
      error: { code: "ISSUE_NOT_FOUND" },
    });

    expect(trackerRepoStore.getTrackerRepoByProjectName).toHaveBeenCalledWith(
      "proj-a",
    );
    expect(issueFinderService.find).toHaveBeenCalledWith("0001", {
      project: "proj-a",
    });
  });

  test("notifies metadata post-hooks after a successful property write", async () => {
    const folders: IssueFolder[] = [buildIssueFolder("0001-rename", "0001")];
    const issueFilePath = path.join("/dummy", "0001-rename", "issue.md");
    const files = new Map<string, string>([
      [
        issueFilePath,
        `---
title: An issue
---
# Body
`,
      ],
    ]);
    issueFinderService.find.mockResolvedValue(folders);
    trackerRepoStore.getCurrentTrackerRepo.mockResolvedValue(mockRepo);
    fileService.exists.mockImplementation((p: string) =>
      Promise.resolve(files.has(p)),
    );
    fileService.isBinaryFile.mockResolvedValue(false);
    fileService.readFile.mockImplementation((p: string) =>
      Promise.resolve(files.get(p) ?? ""),
    );
    fileService.writeFile.mockImplementation((p: string, content: string) => {
      files.set(p, content);
      return Promise.resolve();
    });

    const hook = jest.fn();
    useIssueMetadataChangedPostHookStore
      .getState()
      .registerPostHook(SystemRuleKey.BlockedStatusRule, hook);

    const result = await new IssueSetPropertyCommand().command(
      "0001",
      "status",
      "open",
    );

    expect(result.status).toBe("ok");
    expect(hook).toHaveBeenCalledTimes(1);
    expect(hook).toHaveBeenCalledWith(
      folders[0],
      expect.objectContaining({
        title: "An issue",
        status: "open",
      }),
      expect.objectContaining({
        title: "An issue",
      }),
    );
  });

  test("writes a YAML boolean when type is boolean", async () => {
    const folders: IssueFolder[] = [buildIssueFolder("0001-rename", "0001")];
    issueFinderService.find.mockResolvedValue(folders);
    trackerRepoStore.getCurrentTrackerRepo.mockResolvedValue(mockRepo);
    fileService.exists.mockResolvedValue(true);
    fileService.isBinaryFile.mockResolvedValue(false);
    fileService.readFile.mockResolvedValue(`---
title: An issue
---
# Body
`);
    fileService.writeFile.mockResolvedValue(undefined);

    const result = await new IssueSetPropertyCommand().command(
      "0001",
      "flag",
      "yes",
      undefined,
      { type: "boolean", skipUpdatedAt: true },
    );

    expect(result).toEqual({
      status: "ok",
      result: {
        issueFilePath: path.join("/dummy", "0001-rename", "issue.md"),
        property: "flag",
        value: true,
      },
    });
    expect(fileService.writeFile).toHaveBeenCalledWith(
      path.join("/dummy", "0001-rename", "issue.md"),
      [
        "---",
        "title: An issue",
        "flag: true",
        "---",
        "# Body",
        "",
      ].join("\n"),
    );
  });

  test("writes a YAML number when type is number", async () => {
    const folders: IssueFolder[] = [buildIssueFolder("0001-rename", "0001")];
    issueFinderService.find.mockResolvedValue(folders);
    trackerRepoStore.getCurrentTrackerRepo.mockResolvedValue(mockRepo);
    fileService.exists.mockResolvedValue(true);
    fileService.isBinaryFile.mockResolvedValue(false);
    fileService.readFile.mockResolvedValue(`---
title: An issue
---
# Body
`);
    fileService.writeFile.mockResolvedValue(undefined);

    const result = await new IssueSetPropertyCommand().command(
      "0001",
      "count",
      "42",
      undefined,
      { type: "number", skipUpdatedAt: true },
    );

    expect(result).toEqual({
      status: "ok",
      result: {
        issueFilePath: path.join("/dummy", "0001-rename", "issue.md"),
        property: "count",
        value: 42,
      },
    });
    expect(fileService.writeFile).toHaveBeenCalledWith(
      path.join("/dummy", "0001-rename", "issue.md"),
      [
        "---",
        "title: An issue",
        "count: 42",
        "---",
        "# Body",
        "",
      ].join("\n"),
    );
  });

  test("throws COMMAND_INVALID_ARG when type is invalid", async () => {
    const command = new IssueSetPropertyCommand();

    await expect(
      command.command("0001", "status", "open", undefined, {
        type: "array",
      }),
    ).rejects.toMatchObject({
      status: "error",
      error: {
        code: "COMMAND_INVALID_ARG",
        details: { argument: "type", value: "array" },
      },
    });
  });

  test("throws COMMAND_INVALID_ARG when boolean value is invalid", async () => {
    const folders: IssueFolder[] = [buildIssueFolder("0001-rename", "0001")];
    issueFinderService.find.mockResolvedValue(folders);
    trackerRepoStore.getCurrentTrackerRepo.mockResolvedValue(mockRepo);
    fileService.exists.mockResolvedValue(true);
    fileService.isBinaryFile.mockResolvedValue(false);
    fileService.readFile.mockResolvedValue(`---
title: An issue
---
# Body
`);

    await expect(
      new IssueSetPropertyCommand().command("0001", "flag", "maybe", undefined, {
        type: "boolean",
      }),
    ).rejects.toMatchObject({
      status: "error",
      error: {
        code: "COMMAND_INVALID_ARG",
        details: { argument: "value", value: "maybe" },
      },
    });
    expect(fileService.writeFile).not.toHaveBeenCalled();
  });

  test("throws COMMAND_INVALID_ARG when number value is invalid", async () => {
    const folders: IssueFolder[] = [buildIssueFolder("0001-rename", "0001")];
    issueFinderService.find.mockResolvedValue(folders);
    trackerRepoStore.getCurrentTrackerRepo.mockResolvedValue(mockRepo);
    fileService.exists.mockResolvedValue(true);
    fileService.isBinaryFile.mockResolvedValue(false);
    fileService.readFile.mockResolvedValue(`---
title: An issue
---
# Body
`);

    await expect(
      new IssueSetPropertyCommand().command("0001", "count", "abc", undefined, {
        type: "number",
      }),
    ).rejects.toMatchObject({
      status: "error",
      error: {
        code: "COMMAND_INVALID_ARG",
        details: { argument: "value", value: "abc" },
      },
    });
    expect(fileService.writeFile).not.toHaveBeenCalled();
  });

  test("skipIfPresent leaves an existing property unchanged", async () => {
    const folders: IssueFolder[] = [buildIssueFolder("0001-rename", "0001")];
    issueFinderService.find.mockResolvedValue(folders);
    trackerRepoStore.getCurrentTrackerRepo.mockResolvedValue(mockRepo);
    fileService.exists.mockResolvedValue(true);
    fileService.isBinaryFile.mockResolvedValue(false);
    fileService.readFile.mockResolvedValue(`---
title: An issue
status: open
---
# Body
`);
    const touchUpdatedAtSpy = jest.spyOn(
      IssueFolderStorage.prototype,
      "touchUpdatedAt",
    );

    const result = await new IssueSetPropertyCommand().command(
      "0001",
      "status",
      "closed",
      undefined,
      { skipIfPresent: true },
    );

    expect(result).toEqual({
      status: "ok",
      result: {
        issueFilePath: path.join("/dummy", "0001-rename", "issue.md"),
        property: "status",
        value: "open",
        skipped: true,
      },
    });
    expect(fileService.writeFile).not.toHaveBeenCalled();
    expect(touchUpdatedAtSpy).not.toHaveBeenCalled();
  });

  test("skipIfPresent sets the property when it is missing", async () => {
    const folders: IssueFolder[] = [buildIssueFolder("0001-rename", "0001")];
    issueFinderService.find.mockResolvedValue(folders);
    trackerRepoStore.getCurrentTrackerRepo.mockResolvedValue(mockRepo);
    fileService.exists.mockResolvedValue(true);
    fileService.isBinaryFile.mockResolvedValue(false);
    fileService.readFile.mockResolvedValue(`---
title: An issue
---
# Body
`);
    fileService.writeFile.mockResolvedValue(undefined);

    const result = await new IssueSetPropertyCommand().command(
      "0001",
      "status",
      "open",
      undefined,
      { skipIfPresent: true, skipUpdatedAt: true },
    );

    expect(result).toEqual({
      status: "ok",
      result: {
        issueFilePath: path.join("/dummy", "0001-rename", "issue.md"),
        property: "status",
        value: "open",
      },
    });
    expect(fileService.writeFile).toHaveBeenCalledWith(
      path.join("/dummy", "0001-rename", "issue.md"),
      [
        "---",
        "title: An issue",
        "status: open",
        "---",
        "# Body",
        "",
      ].join("\n"),
    );
  });
});
