import { jest } from "@jest/globals";
import { IssueArchiveCommand } from "../../../src/commands/IssueArchiveCommand.ts";
import { resetAppStore, useAppStore } from "../../../src/store/AppStore.ts";
import { useConfirmationDialogStore } from "../../../src/store/ConfirmationDialogStore.ts";
import {
  resetCurrentTrackerRepoStore,
  useCurrentTrackerRepoStore,
} from "../../../src/store/CurrentTrackerRepoStore.ts";
import { useToastStore } from "../../../src/store/ToastStore.ts";
import type { IssueFolder } from "../../../src/types/Issue.ts";
import type { TrackerRepo } from "../../../src/types/Tracker.ts";
import {
  INITIAL_NAVIGATION_STACK,
  viewerNavigationStack,
} from "../../fixture/navigationStack.ts";
import { ArchiveSelectedIssuePaletteCommand } from "../../../src/views/PaletteCommands/ArchiveSelectedIssuePaletteCommand.ts";

import { buildIssueFolder } from "../../fixture/buildIssueFolder.ts";

const buildIssue = (issueId: string): IssueFolder =>
  buildIssueFolder(issueId, {
        path: `/repo/issues/${issueId}-test`,
  });

const mockRepo: TrackerRepo = {
  name: "proj-a",
  projectPath: "/repo",
  trackerPath: "/repo",
  config: { issue_path: "issues" },
};

function resetConfirmationDialogStore(): void {
  useConfirmationDialogStore.setState(
    useConfirmationDialogStore.getInitialState(),
    true,
  );
}

function resetToastStore(): void {
  useToastStore.setState(useToastStore.getInitialState(), true);
}

describe("ArchiveSelectedIssuePaletteCommand", () => {
  let toastInfoMock: jest.Mock<
    ReturnType<typeof useToastStore.getState>["info"]
  >;
  let confirmationOpenMock: jest.Mock<
    ReturnType<typeof useConfirmationDialogStore.getState>["open"]
  >;

  beforeEach(() => {
    resetAppStore();
    resetCurrentTrackerRepoStore();
    resetConfirmationDialogStore();
    resetToastStore();

    confirmationOpenMock = jest
      .fn()
      .mockResolvedValue({ type: "accepted" as const });
    useConfirmationDialogStore.setState({ open: confirmationOpenMock });

    toastInfoMock = jest.fn().mockResolvedValue(undefined);
    useToastStore.setState({ info: toastInfoMock });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    resetAppStore();
    resetCurrentTrackerRepoStore();
    resetConfirmationDialogStore();
    resetToastStore();
  });

  it("is not disabled when no issue is selected", () => {
    useAppStore.setState({
      mainIssueLists: [],
      selectedIssueId: null,
      navigationStack: INITIAL_NAVIGATION_STACK,
    });

    const command = new ArchiveSelectedIssuePaletteCommand();
    expect(command.isDisabled).not.toBe(true);
  });

  it("archives the active issue, closes the viewer, and refreshes the list", async () => {
    const issueA = buildIssue("0001");
    const issueB = buildIssue("0002");
    useAppStore.setState({
      mainIssueLists: [issueA, issueB],
      selectedIssueId: issueA.issueId,
      navigationStack: viewerNavigationStack(issueA),
    });

    useCurrentTrackerRepoStore.setState({
      findTrackerRepoForIssueFolder: jest.fn().mockResolvedValue(mockRepo),
    });
    const commandSpy = jest
      .spyOn(IssueArchiveCommand.prototype, "command")
      .mockResolvedValue({
        status: "ok",
        result: {
          oldPath: issueA.path,
          newPath: "/repo/issues/.archive/0001-test",
          label: issueA.issueId,
        },
      });
    const refreshMock = jest.fn().mockImplementation(async () => {
      useAppStore.setState({ mainIssueLists: [issueB] });
      return [issueB];
    });
    const originalCloseIssue = useAppStore.getState().closeIssue;
    const closeMock = jest.fn(() => originalCloseIssue());
    useAppStore.setState({
      refreshIssueLists: refreshMock,
      closeIssue: closeMock,
    });

    await new ArchiveSelectedIssuePaletteCommand().callback();

    expect(commandSpy).toHaveBeenCalledWith(issueA.issueId, mockRepo.name);
    expect(closeMock).toHaveBeenCalled();
    expect(toastInfoMock).toHaveBeenCalled();
    expect(refreshMock).toHaveBeenCalled();
    expect(useAppStore.getState().getCurrentPage().name).toBe("ISSUE_TABLE");
    expect(useAppStore.getState().selectedIssueId).toBe(issueB.issueId);
  });

  it("archives every issue in a table range selection", async () => {
    const issueA = buildIssue("0001");
    const issueB = buildIssue("0002");
    const issueC = buildIssue("0003");
    useAppStore.setState({
      mainIssueLists: [issueA, issueB, issueC],
      selectedIssueId: issueB.issueId,
      tableRangeSelectionAnchorIssueId: issueA.issueId,
      navigationStack: INITIAL_NAVIGATION_STACK,
    });

    useCurrentTrackerRepoStore.setState({
      findTrackerRepoForIssueFolder: jest.fn().mockResolvedValue(mockRepo),
    });
    const commandSpy = jest
      .spyOn(IssueArchiveCommand.prototype, "command")
      .mockResolvedValue({ status: "ok", result: {} });
    const refreshMock = jest.fn().mockImplementation(async () => {
      useAppStore.setState({ mainIssueLists: [issueC] });
      return [issueC];
    });
    useAppStore.setState({ refreshIssueLists: refreshMock });

    await new ArchiveSelectedIssuePaletteCommand().callback();

    expect(commandSpy).toHaveBeenCalledTimes(2);
    expect(commandSpy).toHaveBeenCalledWith(issueA.issueId, mockRepo.name);
    expect(commandSpy).toHaveBeenCalledWith(issueB.issueId, mockRepo.name);
    expect(
      useAppStore.getState().tableRangeSelectionAnchorIssueId,
    ).toBeNull();
    expect(toastInfoMock).toHaveBeenCalled();
  });

  it("does nothing when confirmation is cancelled", async () => {
    const issue = buildIssue("0001");
    useAppStore.setState({
      mainIssueLists: [issue],
      selectedIssueId: issue.issueId,
      navigationStack: INITIAL_NAVIGATION_STACK,
    });

    useCurrentTrackerRepoStore.setState({
      findTrackerRepoForIssueFolder: jest.fn().mockResolvedValue(mockRepo),
    });
    confirmationOpenMock.mockResolvedValue({ type: "cancelled" });
    const commandSpy = jest.spyOn(IssueArchiveCommand.prototype, "command");

    await new ArchiveSelectedIssuePaletteCommand().callback();

    expect(commandSpy).not.toHaveBeenCalled();
  });
});
