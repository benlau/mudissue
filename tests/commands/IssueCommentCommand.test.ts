import { jest } from "@jest/globals";
import { IssueCommentCommand } from "../../src/commands/IssueCommentCommand.ts";
import { IssueFolderStorage } from "../../src/utils/storage/IssueFolderStorage.ts";
import { createMockSystemContext } from "../fixture/MockSystemContext.tsx";

describe("IssueCommentCommand", () => {
  let fileService: ReturnType<typeof createMockSystemContext>["fileService"];
  let issueFinderService: ReturnType<
    typeof createMockSystemContext
  >["issueFinderService"];

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 4, 31, 10, 14, 0));

    const bundle = createMockSystemContext();
    fileService = bundle.fileService;
    issueFinderService = bundle.issueFinderService;
    issueFinderService.find.mockResolvedValue([]);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("throws COMMENT_ARGS_INVALID when issue selector is empty", async () => {
    const cmd = new IssueCommentCommand();

    await expect(
      cmd.command({ issueSelector: "", content: "hi", author: "A" }),
    ).rejects.toMatchObject({
      status: "error",
      error: { code: "COMMENT_ARGS_INVALID" },
    });
  });

  it("throws COMMENT_CONTENT_EMPTY when interactive input is cancelled", async () => {
    class TestCommand extends IssueCommentCommand {
      protected override async askUserTextContent(): Promise<string | null> {
        return null;
      }
    }
    const cmd = new TestCommand();

    await expect(cmd.command({ issueSelector: "0001" })).rejects.toMatchObject({
      status: "error",
      error: { code: "COMMENT_CONTENT_EMPTY" },
    });
  });

  it("throws ISSUE_NOT_FOUND when selector matches none", async () => {
    issueFinderService.find.mockResolvedValue([]);
    const cmd = new IssueCommentCommand();

    await expect(
      cmd.command({
        issueSelector: "999",
        content: "hi",
        author: "Ben",
      }),
    ).rejects.toMatchObject({
      status: "error",
      error: { code: "ISSUE_NOT_FOUND" },
    });
  });

  it("throws ISSUE_MULTI_MATCHED when selector matches multiple", async () => {
    issueFinderService.find.mockResolvedValue([
      { issueId: "0001-a", label: "0001", path: "/repo/issues/0001-a",
       },
      { issueId: "0001-b", label: "0001", path: "/repo/issues/0001-b",
       },
    ]);
    const cmd = new IssueCommentCommand();

    await expect(
      cmd.command({
        issueSelector: "0001",
        content: "hi",
        author: "Ben",
      }),
    ).rejects.toMatchObject({
      status: "error",
      error: { code: "ISSUE_MULTI_MATCHED" },
    });
  });

    it("throws ISSUE_MD_MISSING when issue file cannot be found", async () => {
    issueFinderService.find.mockResolvedValue([
      { issueId: "0001-test", label: "0001", path: "/repo/issues/0001-test",
       },
    ]);
    fileService.exists.mockResolvedValue(false);
    fileService.readdir.mockResolvedValue([]);

    const cmd = new IssueCommentCommand();
    await expect(
      cmd.command({
        issueSelector: "0001",
        content: "hi",
        author: "Ben",
      }),
    ).rejects.toMatchObject({
      status: "error",
      error: { code: "ISSUE_MD_MISSING" },
    });
  });

  it("appends formatted comment block to issue body", async () => {
    issueFinderService.find.mockResolvedValue([
      { issueId: "0001-test", label: "0001", path: "/repo/issues/0001-test",
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

    const cmd = new IssueCommentCommand();
    const result = await cmd.command({
      issueSelector: "0001",
      author: "Ben Lau",
      content: "New comment line",
    });

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.result).toEqual({
        author: "Ben Lau",
        issueFolder: "/repo/issues/0001-test",
        issueFilePath: expect.any(String),
        timestamp: "2026-05-31 10:14 AM",
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
        "",
        "Existing body",
        "",
        "  > **Ben Lau** @ *2026-05-31 10:14 AM*",
        "  >",
        "  > New comment line",
        "",
      ].join("\n"),
    );

    const finalWritten = fileService.writeFile.mock.calls[1][1] as string;
    expect(finalWritten).toEqual(
      expect.stringMatching(/updated_at:/),
    );
    expect(finalWritten).toContain("  > New comment line");
  });

  it("uses askUserTextContent when --content is omitted", async () => {
    issueFinderService.find.mockResolvedValue([
      { issueId: "0001-test", label: "0001", path: "/repo/issues/0001-test",
       },
    ]);
    fileService.exists.mockResolvedValue(true);
    let fileContent = "---\ntitle: Test\n---\n\n";
    fileService.readFile.mockImplementation(() => Promise.resolve(fileContent));
    fileService.writeFile.mockImplementation((_path, content) => {
      fileContent = content as string;
      return Promise.resolve();
    });

    class TestCommand extends IssueCommentCommand {
      protected override async askUserTextContent(): Promise<string | null> {
        return "From prompt";
      }
    }
    const cmd = new TestCommand();
    const result = await cmd.command({
      issueSelector: "0001",
      author: "Ben",
    });

    expect(result.status).toBe("ok");
    const written = fileService.writeFile.mock.calls[0][1] as string;
    expect(written).toEqual(
      [
        "---",
        "title: Test",
        "---",
        "  > **Ben** @ *2026-05-31 10:14 AM*",
        "  >",
        "  > From prompt",
        "",
      ].join("\n"),
    );
  });
});
