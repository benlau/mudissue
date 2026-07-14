import { jest } from "@jest/globals";
import { resetAppStore, useAppStore } from "../../../src/store/AppStore.ts";
import { useTextEditDialogStore } from "../../../src/store/TextEditDialogStore.ts";
import type { IssueFolder } from "../../../src/types/Issue.ts";
import { INITIAL_NAVIGATION_STACK } from "../../fixture/navigationStack.ts";
import { IssueFolderStorage } from "../../../src/utils/storage/IssueFolderStorage.ts";
import { EditIssuePaletteCommand } from "../../../src/views/PaletteCommands/EditIssuePaletteCommand.ts";
import { buildIssueFolder } from "../../fixture/buildIssueFolder.ts";

const buildIssue = (issueId: string): IssueFolder =>
  buildIssueFolder(issueId, {
        path: `/repo/issues/${issueId}-test`,
  });

describe("EditIssuePaletteCommand", () => {
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

  it("is not disabled when no issue is selected", () => {
    useAppStore.setState({
      mainIssueLists: [],
      selectedIssueId: null,
      navigationStack: INITIAL_NAVIGATION_STACK,
    });

    const command = new EditIssuePaletteCommand();
    expect(command.isDisabled).not.toBe(true);
  });

  it("does nothing when no issue is selected", async () => {
    const openMock = jest.fn();
    useTextEditDialogStore.setState({ open: openMock });

    useAppStore.setState({
      mainIssueLists: [],
      selectedIssueId: null,
      navigationStack: INITIAL_NAVIGATION_STACK,
    });

    await new EditIssuePaletteCommand().callback();

    expect(openMock).not.toHaveBeenCalled();
  });

  it("opens the text edit dialog for the selected issue", async () => {
    const issue = buildIssue("0001");
    const filePath = "/repo/issues/0001-test/issue.md";
    const openMock = jest
      .fn()
      .mockResolvedValue({
        lastUpdatedTimestamp: null,
        lastLogicalLineIndex: 0,
      });

    useAppStore.setState({
      mainIssueLists: [issue],
      selectedIssueId: issue.issueId,
      navigationStack: INITIAL_NAVIGATION_STACK,
    });
    useTextEditDialogStore.setState({ open: openMock });

    jest
      .spyOn(IssueFolderStorage.prototype, "findIssueFile")
      .mockResolvedValue(filePath);

    await new EditIssuePaletteCommand().callback();

    expect(openMock).toHaveBeenCalledWith({
      filePath,
      initialLineIndex: 0,
    });
  });
});
