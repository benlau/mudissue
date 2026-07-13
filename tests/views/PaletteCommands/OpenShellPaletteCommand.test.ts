import { jest } from "@jest/globals";
import { FileService } from "../../../src/services/FileService.ts";
import { ShellService } from "../../../src/services/ShellService.ts";
import { resetAppStore, useAppStore } from "../../../src/store/AppStore.ts";
import {
  resetCurrentTrackerRepoStore,
  useCurrentTrackerRepoStore,
} from "../../../src/store/CurrentTrackerRepoStore.ts";
import {
  resetReactSessionStore,
  useReactSessionStore,
} from "../../../src/store/ReactSessionStore.ts";
import type { IssueFolder } from "../../../src/types/Issue.ts";
import type { TrackerRepo } from "../../../src/types/Tracker.ts";
import {
  INITIAL_NAVIGATION_STACK,
  viewerNavigationStack,
} from "../../fixture/navigationStack.ts";
import {
  PickItemDialogResponseType,
  usePickItemDialogStore,
} from "../../../src/views/components/PickItemDialog.tsx";
import {
  OpenShellPaletteCommand,
  type OpenShellTarget,
} from "../../../src/views/PaletteCommands/OpenShellPaletteCommand.ts";

const mockRepo: TrackerRepo = {
  name: "proj-a",
  projectPath: "/repo",
  trackerPath: "/repo/tracker",
  config: { issue_path: "issues" },
};

import { buildIssueFolder } from "../../fixture/buildIssueFolder.ts";

const buildIssue = (issueId: string): IssueFolder =>
  buildIssueFolder(issueId, {
    folderName: `${issueId}-test`,
    path: `/repo/issues/${issueId}-test`,
  });

function resetPickItemDialogStore(): void {
  usePickItemDialogStore.setState({
    isDialogOpen: false,
    items: [],
    getDisplay: String,
    title: "Select item",
    columns: [],
    footerLabel: "Cancel<Esc>",
    minWidth: 52,
    maxWidth: 86,
    geom: {
      dialogWidth: 0,
      contentWidth: 0,
      columnWidths: [],
      tableWidth: 0,
    },
    displayRows: [],
    initialSelectedIndex: 0,
    pendingResolve: null,
  });
}

describe("OpenShellPaletteCommand", () => {
  let fileExistsMock: jest.Mock<FileService["exists"]>;
  let getGitWorktreePathMock: jest.Mock<
    ReturnType<typeof useCurrentTrackerRepoStore.getState>["getGitWorktreePath"]
  >;
  let pickOpenMock: jest.Mock<
    ReturnType<typeof usePickItemDialogStore.getState>["open"]
  >;
  let openShellMock: jest.Mock<ShellService["openShell"]>;
  let suspendMock: jest.Mock<() => Promise<void>>;
  let resumeMock: jest.Mock<() => void>;

  beforeEach(() => {
    jest.clearAllMocks();
    resetAppStore();
    resetCurrentTrackerRepoStore();
    resetPickItemDialogStore();
    resetReactSessionStore();

    suspendMock = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);
    resumeMock = jest.fn();
    useReactSessionStore.setState({
      suspend: suspendMock,
      resume: resumeMock,
    });

    fileExistsMock = jest.fn();
    FileService.setInstance({ exists: fileExistsMock } as unknown as FileService);

    getGitWorktreePathMock = jest
      .fn()
      .mockResolvedValue("/repo/.worktrees/0001-test");
    useCurrentTrackerRepoStore.setState({
      getCurrentTrackerRepo: jest.fn().mockResolvedValue(mockRepo),
      getGitWorktreePath: getGitWorktreePathMock,
    });

    pickOpenMock = jest.fn();
    usePickItemDialogStore.setState({ open: pickOpenMock });

    openShellMock = jest.fn<ShellService["openShell"]>().mockReturnValue({ status: 0 });
    ShellService.setInstance({
      openShell: openShellMock,
    } as unknown as ShellService);
  });

  afterEach(() => {
    ShellService.setInstance(null);
    FileService.setInstance(null);
    resetAppStore();
    resetCurrentTrackerRepoStore();
    resetPickItemDialogStore();
    resetReactSessionStore();
  });

  it("includes only project and tracker folders on the issue table", async () => {
    useAppStore.setState({ navigationStack: INITIAL_NAVIGATION_STACK });
    pickOpenMock.mockImplementation(async (items) => {
      const targets = items as OpenShellTarget[];
      expect(targets).toHaveLength(2);
      expect(targets[0]?.path).toBe("/repo");
      expect(targets[1]?.path).toBe("/repo/tracker");
      return { type: PickItemDialogResponseType.Cancelled };
    });

    await new OpenShellPaletteCommand().callback();

    expect(pickOpenMock).toHaveBeenCalled();
  });

  it("includes the issue folder when the issue viewer is open", async () => {
    const issue = buildIssue("0001");
    useAppStore.setState({
      mainIssueLists: [issue],
      selectedFolderName: issue.folderName,
      navigationStack: viewerNavigationStack(issue),
    });
    fileExistsMock.mockResolvedValue(false);
    pickOpenMock.mockImplementation(async (items) => {
      const targets = items as OpenShellTarget[];
      expect(targets).toHaveLength(3);
      expect(targets[2]?.path).toBe("/repo/issues/0001-test");
      return { type: PickItemDialogResponseType.Cancelled };
    });

    await new OpenShellPaletteCommand().callback();

    expect(getGitWorktreePathMock).toHaveBeenCalledWith(issue.folderName);
    expect(pickOpenMock).toHaveBeenCalled();
  });

  it("includes the worktree folder when it exists on disk", async () => {
    const issue = buildIssue("0001");
    useAppStore.setState({
      mainIssueLists: [issue],
      selectedFolderName: issue.folderName,
      navigationStack: viewerNavigationStack(issue),
    });
    fileExistsMock.mockResolvedValue(true);
    pickOpenMock.mockImplementation(async (items) => {
      const targets = items as OpenShellTarget[];
      expect(targets).toHaveLength(4);
      expect(targets[3]?.path).toBe("/repo/.worktrees/0001-test");
      return { type: PickItemDialogResponseType.Cancelled };
    });

    await new OpenShellPaletteCommand().callback();

    expect(fileExistsMock).toHaveBeenCalledWith("/repo/.worktrees/0001-test");
    expect(pickOpenMock).toHaveBeenCalled();
  });

  it("omits the worktree folder when it does not exist on disk", async () => {
    const issue = buildIssue("0001");
    useAppStore.setState({
      mainIssueLists: [issue],
      selectedFolderName: issue.folderName,
      navigationStack: viewerNavigationStack(issue),
    });
    fileExistsMock.mockResolvedValue(false);
    pickOpenMock.mockImplementation(async (items) => {
      const targets = items as OpenShellTarget[];
      expect(targets).toHaveLength(3);
      expect(targets.map((t) => t.path)).not.toContain(
        "/repo/.worktrees/0001-test",
      );
      return { type: PickItemDialogResponseType.Cancelled };
    });

    await new OpenShellPaletteCommand().callback();

    expect(pickOpenMock).toHaveBeenCalled();
  });

  it("does not open a shell when the pick dialog is cancelled", async () => {
    pickOpenMock.mockResolvedValue({
      type: PickItemDialogResponseType.Cancelled,
    });

    await new OpenShellPaletteCommand().callback();

    expect(suspendMock).not.toHaveBeenCalled();
    expect(openShellMock).not.toHaveBeenCalled();
    expect(resumeMock).not.toHaveBeenCalled();
  });

  it("opens a shell after suspending the session when a folder is selected", async () => {
    useAppStore.setState({ navigationStack: INITIAL_NAVIGATION_STACK });
    pickOpenMock.mockResolvedValue({
      type: PickItemDialogResponseType.Accepted,
      acceptedValue: { label: "Project folder", path: "/repo" },
    });
    const stdoutWriteSpy = jest
      .spyOn(process.stdout, "write")
      .mockImplementation(() => true);

    await new OpenShellPaletteCommand().callback();

    expect(pickOpenMock).toHaveBeenCalled();
    expect(suspendMock).toHaveBeenCalled();
    expect(openShellMock).toHaveBeenCalledWith("/repo");
    expect(resumeMock).toHaveBeenCalled();
    expect(stdoutWriteSpy).toHaveBeenCalledWith("/repo\n");

    stdoutWriteSpy.mockRestore();
  });
});
