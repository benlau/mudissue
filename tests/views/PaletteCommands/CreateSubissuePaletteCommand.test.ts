import { jest } from "@jest/globals";
import { resetAppStore, useAppStore } from "../../../src/store/AppStore.ts";
import { useCreateIssueDialogStore } from "../../../src/store/CreateIssueDialogStore.ts";
import type { IssueFolder } from "../../../src/types/Issue.ts";
import { INITIAL_NAVIGATION_STACK } from "../../fixture/navigationStack.ts";
import { CreateSubissuePaletteCommand } from "../../../src/views/PaletteCommands/CreateSubissuePaletteCommand.ts";

import { buildIssueFolder } from "../../fixture/buildIssueFolder.ts";

const buildIssue = (issueId: string): IssueFolder =>
  buildIssueFolder(issueId, {
    folderName: `${issueId}-test`,
    path: `/repo/issues/${issueId}-test`,
  });

describe("CreateSubissuePaletteCommand", () => {
  beforeEach(() => {
    resetAppStore();
    useCreateIssueDialogStore.setState({
      isDialogOpen: false,
      openSession: 0,
      parentIssue: null,
    });
  });

  afterEach(() => {
    resetAppStore();
    useCreateIssueDialogStore.setState({
      isDialogOpen: false,
      openSession: 0,
      parentIssue: null,
    });
  });

  it("is not disabled when no issue is selected", () => {
    useAppStore.setState({
      mainIssueLists: [],
      selectedFolderName: null,
      navigationStack: INITIAL_NAVIGATION_STACK,
    });

    const command = new CreateSubissuePaletteCommand();
    expect(command.isDisabled).not.toBe(true);
  });

  it("opens the create issue dialog with the displaying issue as parent", async () => {
    const issue = buildIssue("0001");
    useAppStore.setState({
      mainIssueLists: [issue],
      selectedFolderName: issue.folderName,
      navigationStack: INITIAL_NAVIGATION_STACK,
    });

    const openMock = jest.fn();
    useCreateIssueDialogStore.setState({ open: openMock });

    await new CreateSubissuePaletteCommand().callback();

    expect(openMock).toHaveBeenCalledWith(issue);
  });
});
