import { jest } from "@jest/globals";
import { IssuePrependCommand } from "../../src/commands/IssuePrependCommand.ts";
import { IssueFolderStorage } from "../../src/utils/storage/IssueFolderStorage.ts";
import type { TrackerRepo } from "../../src/types/Tracker.ts";
import { createMockSystemContext } from "../fixture/MockSystemContext.tsx";

describe("IssuePrependCommand", () => {
  let fileService: ReturnType<typeof createMockSystemContext>["fileService"];
  let issueFinderService: ReturnType<
    typeof createMockSystemContext
  >["issueFinderService"];
  let trackerRepoStore: ReturnType<
    typeof createMockSystemContext
  >["trackerRepoStore"];

  const mockRepo: TrackerRepo = {
    name: "my-repo",
    projectPath: "/repo",
    trackerPath: "/repo",
    config: { issue_path: "issues" },
  };

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 4, 31, 10, 14, 0));

    const bundle = createMockSystemContext();
    fileService = bundle.fileService;
    issueFinderService = bundle.issueFinderService;
    trackerRepoStore = bundle.trackerRepoStore;
    issueFinderService.find.mockResolvedValue([]);
    trackerRepoStore.getCurrentTrackerRepo.mockResolvedValue(mockRepo);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("throws PREPEND_ARGS_INVALID when issue selector is empty", async () => {
    const cmd = new IssuePrependCommand();

    await expect(
      cmd.command({ issueSelector: "", content: "hi" }),
    ).rejects.toMatchObject({
      status: "error",
      error: { code: "PREPEND_ARGS_INVALID" },
    });
  });

  it("throws PREPEND_CONTENT_EMPTY when interactive input is cancelled", async () => {
    class TestCommand extends IssuePrependCommand {
      protected override async askUserTextContent(): Promise<string | null> {
        return null;
      }
    }
    const cmd = new TestCommand();

    await expect(cmd.command({ issueSelector: "0001" })).rejects.toMatchObject({
      status: "error",
      error: { code: "PREPEND_CONTENT_EMPTY" },
    });
  });

  it("throws ISSUE_NOT_FOUND when selector matches none", async () => {
    issueFinderService.find.mockResolvedValue([]);
    const cmd = new IssuePrependCommand();

    await expect(
      cmd.command({
        issueSelector: "999",
        content: "hi",
      }),
    ).rejects.toMatchObject({
      status: "error",
      error: { code: "ISSUE_NOT_FOUND" },
    });
  });

  it("throws ISSUE_MULTI_MATCHED when selector matches multiple", async () => {
    issueFinderService.find.mockResolvedValue([
      {
        issueId: "0001",
        folderName: "0001-a",
        path: "/repo/issues/0001-a",
      },
      {
        issueId: "0001",
        folderName: "0001-b",
        path: "/repo/issues/0001-b",
      },
    ]);
    const cmd = new IssuePrependCommand();

    await expect(
      cmd.command({
        issueSelector: "0001",
        content: "hi",
      }),
    ).rejects.toMatchObject({
      status: "error",
      error: { code: "ISSUE_MULTI_MATCHED" },
    });
  });

  it("throws ISSUE_MD_MISSING when issue file cannot be found", async () => {
    issueFinderService.find.mockResolvedValue([
      {
        issueId: "0001",
        folderName: "0001-test",
        path: "/repo/issues/0001-test",
      },
    ]);
    fileService.exists.mockResolvedValue(false);
    fileService.readdir.mockResolvedValue([]);

    const cmd = new IssuePrependCommand();
    await expect(
      cmd.command({
        issueSelector: "0001",
        content: "hi",
      }),
    ).rejects.toMatchObject({
      status: "error",
      error: { code: "ISSUE_MD_MISSING" },
    });
  });

  it("prepends raw content to issue body after frontmatter", async () => {
    issueFinderService.find.mockResolvedValue([
      {
        issueId: "0001",
        folderName: "0001-test",
        path: "/repo/issues/0001-test",
      },
    ]);
    fileService.exists.mockResolvedValue(true);
    let fileContent = "---\ntitle: Test\n---\n\nExisting body\n";
    fileService.readFile.mockImplementation(() => Promise.resolve(fileContent));
    fileService.writeFile.mockImplementation((_path, content) => {
      fileContent = content as string;
      return Promise.resolve();
    });
    const touchUpdatedAtSpy = jest.spyOn(
      IssueFolderStorage.prototype,
      "touchUpdatedAt",
    );

    const cmd = new IssuePrependCommand();
    const result = await cmd.command({
      issueSelector: "0001",
      content: "Prepended text",
    });

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.result).toEqual({
        issueId: "0001",
        issueFolderName: "0001-test",
        issueFilePath: expect.any(String),
      });
    }

    expect(touchUpdatedAtSpy).toHaveBeenCalled();
    expect(fileService.writeFile).toHaveBeenCalledTimes(2);

    const written = fileService.writeFile.mock.calls[0][1] as string;
    expect(written).toEqual(
      [
        "---",
        "title: Test",
        "---",
        "Prepended text",
        "",
        "Existing body",
        "",
      ].join("\n"),
    );
  });

  it("uses askUserTextContent when --content is omitted", async () => {
    issueFinderService.find.mockResolvedValue([
      {
        issueId: "0001",
        folderName: "0001-test",
        path: "/repo/issues/0001-test",
      },
    ]);
    fileService.exists.mockResolvedValue(true);
    let fileContent = "---\ntitle: Test\n---\n\nExisting body\n";
    fileService.readFile.mockImplementation(() => Promise.resolve(fileContent));
    fileService.writeFile.mockImplementation((_path, content) => {
      fileContent = content as string;
      return Promise.resolve();
    });

    class TestCommand extends IssuePrependCommand {
      protected override async askUserTextContent(): Promise<string | null> {
        return "From prompt";
      }
    }
    const cmd = new TestCommand();
    const result = await cmd.command({
      issueSelector: "0001",
    });

    expect(result.status).toBe("ok");
    const written = fileService.writeFile.mock.calls[0][1] as string;
    expect(written).toEqual(
      [
        "---",
        "title: Test",
        "---",
        "From prompt",
        "",
        "Existing body",
        "",
      ].join("\n"),
    );
  });
});
