import { jest } from "@jest/globals";
import { RegistryService } from "../../../src/services/RegistryService.ts";
import { resetAppStore, useAppStore } from "../../../src/store/AppStore.ts";
import {
  resetCurrentTrackerRepoStore,
  useCurrentTrackerRepoStore,
} from "../../../src/store/CurrentTrackerRepoStore.ts";
import { useToastStore } from "../../../src/store/ToastStore.ts";
import type { IssueFolder } from "../../../src/types/Issue.ts";
import type { TrackerRepo } from "../../../src/types/Tracker.ts";
import { INITIAL_NAVIGATION_STACK } from "../../fixture/navigationStack.ts";
import { TogglePinIssuePaletteCommand } from "../../../src/views/PaletteCommands/TogglePinIssuePaletteCommand.ts";

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

function resetToastStore(): void {
  useToastStore.setState(useToastStore.getInitialState(), true);
}

describe("TogglePinIssuePaletteCommand", () => {
  let toastInfoMock: jest.Mock<
    ReturnType<typeof useToastStore.getState>["info"]
  >;
  let toggleMock: jest.Mock<
    ReturnType<RegistryService["togglePinnedIssueFolderName"]>
  >;
  let refreshIssueListsMock: jest.Mock<
    ReturnType<typeof useAppStore.getState>["refreshIssueLists"]
  >;

  beforeEach(() => {
    resetAppStore();
    resetCurrentTrackerRepoStore();
    resetToastStore();

    toastInfoMock = jest.fn().mockResolvedValue(undefined);
    useToastStore.setState({ info: toastInfoMock });

    toggleMock = jest.fn().mockResolvedValue(true);
    jest
      .spyOn(RegistryService.getInstance(), "togglePinnedIssueFolderName")
      .mockImplementation(toggleMock);

    refreshIssueListsMock = jest.fn().mockResolvedValue([]);
    useAppStore.setState({ refreshIssueLists: refreshIssueListsMock });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    resetAppStore();
    resetCurrentTrackerRepoStore();
    resetToastStore();
  });

  it("is not disabled when no issue is selected", () => {
    useAppStore.setState({
      mainIssueLists: [],
      selectedIssueId: null,
      navigationStack: INITIAL_NAVIGATION_STACK,
    });

    const command = new TogglePinIssuePaletteCommand();
    expect(command.isDisabled).not.toBe(true);
  });

  it("toggles pin state for the selected issue and refreshes the list", async () => {
    const issue = buildIssue("0001");
    useAppStore.setState({
      mainIssueLists: [issue],
      selectedIssueId: issue.issueId,
      navigationStack: INITIAL_NAVIGATION_STACK,
    });

    useCurrentTrackerRepoStore.setState({
      findTrackerRepoForIssueFolder: jest.fn().mockResolvedValue(mockRepo),
      getTrackerRepoList: jest.fn().mockResolvedValue([mockRepo]),
    });

    await new TogglePinIssuePaletteCommand().callback();

    expect(toggleMock).toHaveBeenCalledWith("/repo", issue.issueId);
    expect(refreshIssueListsMock).toHaveBeenCalled();
    expect(toastInfoMock).toHaveBeenCalled();
  });
});
