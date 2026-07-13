import { jest } from "@jest/globals";
import { EditIssueMarkdownFileHelper } from "../../src/helpers/EditIssueMarkdownFileHelper.ts";
import { resetAppStore, useAppStore } from "../../src/store/AppStore.ts";
import { useTextEditDialogStore } from "../../src/store/TextEditDialogStore.ts";
import type { IssueFolder } from "../../src/types/Issue.ts";
import { IssueFolderStorage } from "../../src/utils/storage/IssueFolderStorage.ts";
import { buildIssueFolder } from "../fixture/buildIssueFolder.ts";

const buildIssue = (issueId: string): IssueFolder =>
  buildIssueFolder(issueId, {
    folderName: `${issueId}-test`,
    path: `/repo/issues/${issueId}-test`,
    status: "open",
    priority: "normal",
    title: "Test issue",
  });

describe("EditIssueMarkdownFileHelper", () => {
  beforeEach(() => {
    resetAppStore();
    useTextEditDialogStore.setState({
      isDialogOpen: false,
      openSession: 0,
      filePath: null,
      initialLineIndex: 0,
      pendingResolve: null,
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    resetAppStore();
    useTextEditDialogStore.setState({
      isDialogOpen: false,
      openSession: 0,
      filePath: null,
      initialLineIndex: 0,
      pendingResolve: null,
    });
  });

  it("returns unmodified when the issue file cannot be resolved", async () => {
    const issue = buildIssue("0001");
    const openMock = jest.fn();
    useTextEditDialogStore.setState({ open: openMock });

    jest
      .spyOn(IssueFolderStorage.prototype, "findIssueFile")
      .mockResolvedValue(undefined);

    await expect(EditIssueMarkdownFileHelper.edit(issue)).resolves.toEqual({
      isModified: false,
      lastLogicalLineIndex: 0,
    });
    expect(openMock).not.toHaveBeenCalled();
  });

  it("opens the text edit dialog and updates metadata when the file changes", async () => {
    const issue = buildIssue("0001");
    const filePath = "/repo/issues/0001-test/issue.md";
    const lastUpdatedTimestamp = new Date("2026-05-24T11:00:00.000Z");
    const updatedAt = new Date("2026-05-24T12:00:00.000Z");

    useAppStore.setState({
      mainIssueLists: [issue],
      selectedFolderName: issue.folderName,
    });

    const openMock = jest.fn().mockResolvedValue({
      lastUpdatedTimestamp,
      lastLogicalLineIndex: 5,
    });
    useTextEditDialogStore.setState({ open: openMock });

    jest
      .spyOn(IssueFolderStorage.prototype, "findIssueFile")
      .mockResolvedValue(filePath);
    jest
      .spyOn(IssueFolderStorage.prototype, "touchUpdatedAtIfNotSuperseded")
      .mockResolvedValue(updatedAt);

    await expect(EditIssueMarkdownFileHelper.edit(issue)).resolves.toEqual({
      isModified: true,
      lastLogicalLineIndex: 5,
    });

    expect(openMock).toHaveBeenCalledWith({
      filePath,
      initialLineIndex: 0,
    });
    expect(
      IssueFolderStorage.prototype.touchUpdatedAtIfNotSuperseded,
    ).toHaveBeenCalledWith(lastUpdatedTimestamp);
    expect(useAppStore.getState().mainIssueLists?.[0]?.metadata?.updatedAt).toEqual(
      updatedAt,
    );
  });

  it("returns unmodified with the cursor line when the dialog closes without changes", async () => {
    const issue = buildIssue("0001");
    const filePath = "/repo/issues/0001-test/custom.md";

    const openMock = jest.fn().mockResolvedValue({
      lastUpdatedTimestamp: null,
      lastLogicalLineIndex: 4,
    });
    useTextEditDialogStore.setState({ open: openMock });

    jest
      .spyOn(IssueFolderStorage.prototype, "findIssueFile")
      .mockResolvedValue(filePath);

    await expect(
      EditIssueMarkdownFileHelper.edit(issue, {
        filePath,
        initialLineIndex: 4,
      }),
    ).resolves.toEqual({
      isModified: false,
      lastLogicalLineIndex: 4,
    });

    expect(openMock).toHaveBeenCalledWith({
      filePath,
      initialLineIndex: 4,
    });
  });
});
