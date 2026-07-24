import { jest } from "@jest/globals";
import { IssueChangeLabelCommand } from "../../src/commands/IssueChangeLabelCommand.ts";
import type { IssueChangeLabelCommandSuccessResult } from "../../src/types/Response.ts";
import type { IssueFolder } from "../../src/types/Issue.ts";
import type { TrackerRepo } from "../../src/types/Tracker.ts";
import { createMockSystemContext } from "../fixture/MockSystemContext.tsx";

const buildIssueFolder = (issueId: string, label?: string): IssueFolder => ({
  issueId,
  label: label ?? extractIssueLabel(issueId),
  path: `/repo/issues/${issueId}`,
});

const extractIssueLabel = (issueId: string): string => {
  const m = issueId.trim().match(/^([a-zA-Z_-]*)(\d+)(?:-(.*))?$/);
  return m ? `${m[1]}${m[2]}` : issueId;
};

const mockRepo: TrackerRepo = {
  name: "proj-a",
  projectPath: "/repo",
  trackerPath: "/repo",
  config: { issue_path: "issues" },
};

const issueMdFixture = "---\ntitle: Summary\n---\n\nBody\n";

describe("IssueChangeLabelCommand", () => {
  let fileService: ReturnType<typeof createMockSystemContext>["fileService"];
  let issueFinderService: ReturnType<typeof createMockSystemContext>["issueFinderService"];
  let trackerRepoStore: ReturnType<typeof createMockSystemContext>["trackerRepoStore"];

  beforeEach(() => {
    const bundle = createMockSystemContext();
    fileService = bundle.fileService;
    issueFinderService = bundle.issueFinderService;
    trackerRepoStore = bundle.trackerRepoStore;

    fileService.readdir.mockResolvedValue([] as any);
    fileService.rename.mockResolvedValue(undefined);
    fileService.readFile.mockResolvedValue(issueMdFixture);
    fileService.writeFile.mockResolvedValue(undefined);
    fileService.exists.mockResolvedValue(false);
    trackerRepoStore.getCurrentTrackerRepo.mockResolvedValue(mockRepo);

    jest.clearAllMocks();

    fileService.readdir.mockResolvedValue([] as any);
    fileService.rename.mockResolvedValue(undefined);
    fileService.readFile.mockResolvedValue(issueMdFixture);
    fileService.writeFile.mockResolvedValue(undefined);
    fileService.exists.mockResolvedValue(false);
    trackerRepoStore.getCurrentTrackerRepo.mockResolvedValue(mockRepo);
  });

  const buildCommand = () => new IssueChangeLabelCommand();

  it("throws ISSUE_NOT_FOUND when 0 matches", async () => {
    (issueFinderService.find as jest.Mock).mockResolvedValue([]);

    const command = buildCommand();
    await expect(command.command("43", "PR45")).rejects.toMatchObject({
      status: "error",
      error: { code: "ISSUE_NOT_FOUND" },
    });
    expect(fileService.rename).not.toHaveBeenCalled();
  });

  it("throws ISSUE_MULTI_MATCHED when more than one match", async () => {
    const folders: IssueFolder[] = [
      buildIssueFolder("0043-one", "0043"),
      buildIssueFolder("0043-two", "0043"),
    ];
    (issueFinderService.find as jest.Mock).mockResolvedValue(folders);

    const command = buildCommand();
    await expect(command.command("43", "PR45")).rejects.toMatchObject({
      status: "error",
      error: { code: "ISSUE_MULTI_MATCHED" },
    });
    expect(fileService.rename).not.toHaveBeenCalled();
  });

  it("throws CHANGE_ISSUE_LABEL_UNCHANGED when new label matches current label", async () => {
    (issueFinderService.find as jest.Mock).mockResolvedValue([
      buildIssueFolder("43-summary", "43"),
    ]);

    const command = buildCommand();
    await expect(command.command("43", "43")).rejects.toMatchObject({
      status: "error",
      error: { code: "CHANGE_ISSUE_LABEL_UNCHANGED" },
    });
    expect(fileService.rename).not.toHaveBeenCalled();
  });

  it("throws CHANGE_ISSUE_LABEL_TARGET_EXISTS when target folder exists", async () => {
    (issueFinderService.find as jest.Mock).mockImplementation(
      (selector: string) =>
        Promise.resolve(
          selector === "43" ? [buildIssueFolder("43-summary", "43")] : [],
        ),
    );
    fileService.exists.mockImplementation((p: string) =>
      Promise.resolve(p === "/repo/issues/PR45-summary"),
    );

    const command = buildCommand();
    await expect(command.command("43", "PR45")).rejects.toMatchObject({
      status: "error",
      error: { code: "CHANGE_ISSUE_LABEL_TARGET_EXISTS" },
    });
    expect(fileService.rename).not.toHaveBeenCalled();
  });

  it("changes issue label and returns success result", async () => {
    const folder = buildIssueFolder("43-summary", "43");
    (issueFinderService.find as jest.Mock).mockImplementation(
      (selector: string) =>
        Promise.resolve(selector === "43" ? [folder] : []),
    );
    fileService.exists.mockImplementation((p: string) =>
      Promise.resolve(p === "/repo/issues/43-summary/43-summary.md"),
    );

    const command = buildCommand();
    const result = await command.command("43", "PR45");

    expect(result?.status).toBe("ok");
    expect(
      (result as { result: IssueChangeLabelCommandSuccessResult }).result,
    ).toEqual({
      oldIssueFolderName: "43-summary",
      newIssueFolderName: "PR45-summary",
    });
    expect(fileService.rename).toHaveBeenCalledTimes(2);
    expect(fileService.rename).toHaveBeenNthCalledWith(
      1,
      "/repo/issues/43-summary",
      "/repo/issues/PR45-summary",
    );
    expect(fileService.rename).toHaveBeenNthCalledWith(
      2,
      "/repo/issues/PR45-summary/43-summary.md",
      "/repo/issues/PR45-summary/PR45-summary.md",
    );
  });
});
