import { jest } from "@jest/globals";
import { IssueRemoveCommand } from "../../src/commands/IssueRemoveCommand.ts";
import type { IssueFolder } from "../../src/types/Issue.ts";
import type { TrackerRepo } from "../../src/types/Tracker.ts";
import { createMockSystemContext } from "../fixture/MockSystemContext.tsx";

const buildIssueFolder = (
  issueId: string,
  label?: string,
): IssueFolder => ({
  issueId,
  label: label ?? issueId,
  path: `/repo/issues/${issueId}`,
});

const mockRepo: TrackerRepo = {
  name: "proj-a",
  projectPath: "/repo",
  trackerPath: "/repo",
  config: { issue_path: "issues" },
};

describe("IssueRemoveCommand", () => {
  let fileService: ReturnType<typeof createMockSystemContext>["fileService"];
  let issueFinderService: ReturnType<
    typeof createMockSystemContext
  >["issueFinderService"];
  let trackerRepoStore: ReturnType<
    typeof createMockSystemContext
  >["trackerRepoStore"];
  let loggerService: ReturnType<
    typeof createMockSystemContext
  >["loggerService"];

  beforeEach(() => {
    const bundle = createMockSystemContext();
    fileService = bundle.fileService;
    issueFinderService = bundle.issueFinderService;
    trackerRepoStore = bundle.trackerRepoStore;
    loggerService = bundle.loggerService;

    trackerRepoStore.getCurrentTrackerRepo.mockResolvedValue(mockRepo);
    fileService.rm.mockResolvedValue(undefined);
    fileService.rmdir.mockResolvedValue(undefined);
  });

  const buildCommand = () => new IssueRemoveCommand();

  it("returns ISSUE_NOT_FOUND when 0 matches", async () => {
    issueFinderService.find.mockResolvedValue([]);

    const command = buildCommand();
    await expect(command.command("0001")).rejects.toMatchObject({
      status: "error",
      error: { code: "ISSUE_NOT_FOUND" },
    });
    expect(fileService.rmdir).not.toHaveBeenCalled();
    expect(fileService.rm).not.toHaveBeenCalled();
  });

  it("returns ISSUE_MULTI_MATCHED when more than one match", async () => {
    const folders: IssueFolder[] = [
      buildIssueFolder("0001-a", "0001"),
      buildIssueFolder("0001-b", "0001"),
    ];
    issueFinderService.find.mockResolvedValue(folders);

    const command = buildCommand();
    await expect(command.command("0001")).rejects.toMatchObject({
      status: "error",
      error: { code: "ISSUE_MULTI_MATCHED" },
    });
    expect(fileService.rmdir).not.toHaveBeenCalled();
  });

  it("rm issue file then rmdir when folder has only the issue markdown file", async () => {
    const folder = buildIssueFolder("0001-only-md");
    const issueFilePath = "/repo/issues/0001-only-md/issue.md";
    issueFinderService.find.mockResolvedValue([folder]);
    fileService.exists.mockImplementation((p: string) =>
      Promise.resolve(p === issueFilePath),
    );
    fileService.readFile.mockResolvedValue("---\ntitle: Test\n---\n\n");

    const command = buildCommand();
    const result = await command.command("0001");

    expect(result).toMatchObject({
      status: "ok",
      result: {
        removed: [issueFilePath, folder.path],
      },
    });
    expect(fileService.rm).toHaveBeenCalledWith(issueFilePath);
    expect(fileService.rmdir).toHaveBeenCalledWith(folder.path);
    expect(loggerService.info).toHaveBeenCalledTimes(2);
  });

  it("removes attachments then issue markdown and folder", async () => {
    const folder = buildIssueFolder("0001-with-files");
    const issueFilePath = "/repo/issues/0001-with-files/issue.md";
    const filesDir = "/repo/issues/0001-with-files/files";
    const attachmentPath = "/repo/issues/0001-with-files/files/a.png";
    issueFinderService.find.mockResolvedValue([folder]);
    fileService.exists.mockImplementation((p: string) =>
      Promise.resolve(p === issueFilePath || p === attachmentPath),
    );
    fileService.readFile.mockResolvedValue(
      "---\nfiles:\n  - '[[a.png]]'\n---\n\n",
    );

    const command = buildCommand();
    const result = await command.command("0001");

    expect(result).toMatchObject({
      status: "ok",
      result: {
        removed: [attachmentPath, filesDir, issueFilePath, folder.path],
      },
    });
    expect(fileService.rm).toHaveBeenCalledWith(attachmentPath);
    expect(fileService.rm).toHaveBeenCalledWith(issueFilePath);
    expect(fileService.rmdir).toHaveBeenCalledWith(filesDir);
    expect(fileService.rmdir).toHaveBeenCalledWith(folder.path);
  });

  it("dry-run reports paths without deleting", async () => {
    const folder = buildIssueFolder("0001-with-files");
    const issueFilePath = "/repo/issues/0001-with-files/issue.md";
    const filesDir = "/repo/issues/0001-with-files/files";
    const attachmentPath = "/repo/issues/0001-with-files/files/a.png";
    issueFinderService.find.mockResolvedValue([folder]);
    fileService.exists.mockImplementation((p: string) =>
      Promise.resolve(p === issueFilePath || p === attachmentPath),
    );
    fileService.readFile.mockResolvedValue(
      "---\nfiles:\n  - '[[a.png]]'\n---\n\n",
    );

    const command = buildCommand();
    const result = await command.command("0001", undefined, { dryRun: true });

    expect(result).toMatchObject({
      status: "ok",
      result: {
        removed: [attachmentPath, filesDir, issueFilePath, folder.path],
      },
    });
    expect(fileService.rm).not.toHaveBeenCalled();
    expect(fileService.rmdir).not.toHaveBeenCalled();
    expect(loggerService.info).toHaveBeenCalled();
  });
});
