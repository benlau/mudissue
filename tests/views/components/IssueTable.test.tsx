import React, { act } from "react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals";
import { Box, useInput } from "ink";
import { cleanup, render } from "ink-testing-library";
import { IntlProvider } from "react-intl";
import { IssueTable } from "../../../src/views/components/IssueTable.tsx";
import { ConfirmationDialog } from "../../../src/views/components/ConfirmationDialog.tsx";
import { useQuit } from "../../../src/views/hooks/useQuit.ts";
import { useConfirmationDialogStore } from "../../../src/store/ConfirmationDialogStore.ts";
import {
  AppContextProvider,
} from "../../../src/contexts/AppContext.tsx";
import { ShellService } from "../../../src/services/ShellService.ts";
import type { IssueSearchStoreState } from "../../../src/store/IssueSearchStore.ts";
import {
  IssueSearchStoreFactory,
  type IssueSearchStore,
} from "../../../src/store/IssueSearchStore.ts";
import { useTerminalSizeStore } from "../../../src/views/hooks/useTerminal.ts";
import { setMockCurrentTrackerRepo } from "../../fixture/MockServiceContext.tsx";
import { resetGlobalConfigStore } from "../../../src/store/GlobalConfigStore.ts";
import {
  useCurrentTrackerRepoStore,
} from "../../../src/store/CurrentTrackerRepoStore.ts";
import { DEFAULT_RESOLVED_STATUS_LIST } from "../../../src/types/status.ts";
import {
  PickItemDialogResponseType,
  usePickItemDialogStore,
} from "../../../src/views/components/PickItemDialog.tsx";
import { resetAppStore, useAppStore } from "../../../src/store/AppStore.ts";
import {
  resetReactSessionStore,
  useReactSessionStore,
} from "../../../src/store/ReactSessionStore.ts";
import {
  PopupNames,
  usePopupStore,
} from "../../../src/store/PopupStore.ts";
import { resetIssueSearchStore } from "../../../src/store/IssueSearchStore.ts";
import { useTextEditDialogStore } from "../../../src/store/TextEditDialogStore.ts";
import { createMockSystemContext } from "../../fixture/MockSystemContext.tsx";
import { buildIssueFolder } from "../../fixture/buildIssueFolder.ts";
import type { IssueFolder } from "../../../src/types/Issue.ts";
import { AnsiEscapeCode } from "../../../src/types/ansi.ts";
import { IssueFolderStorage } from "../../../src/utils/storage/IssueFolderStorage.ts";
import { usePaletteCommandStore } from "../../../src/store/PaletteCommandStore.ts";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

function flushInkInput(): Promise<void> {
  return new Promise((resolve) => {
    globalThis.setImmediate(resolve);
  });
}

function resetPickItemDialogForTest(): void {
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
    pendingResolve: null,
  });
}

function resetTextEditDialogForTest(): void {
  useTextEditDialogStore.setState({
    isDialogOpen: false,
    openSession: 0,
    filePath: null,
    initialLineIndex: 0,
    pendingResolve: null,
  });
}

function resetPaletteCommandStoreForTest(): void {
  usePaletteCommandStore.setState({
    isOpen: false,
    commands: [],
    toolbarItems: [],
    initialFilterQuery: ":",
    lastUsedCommandKey: null,
  });
}

const ISSUE_TABLE_PROJECT_NAME_HEADER_THRESHOLD = 5;

function mockIssueSearchStoreForAppContext(): void {
  jest.spyOn(IssueSearchStoreFactory, "createOrGet").mockReturnValue({
    getState: () =>
      ({
        savedSearchResults: [],
        searchFolders: jest.fn(),
        searchAllFolders: jest.fn().mockResolvedValue([]),
      }) as IssueSearchStoreState,
    setState: jest.fn(),
    subscribe: jest.fn(),
    destroy: jest.fn(),
  } as IssueSearchStore);
}

function resetConfirmationDialogForTest(): void {
  useConfirmationDialogStore.setState({
    isDialogOpen: false,
    title: "",
    message: "",
    confirmLabel: undefined,
    variant: "default",
    ctrlCToConfirm: false,
    pendingResolve: null,
    activeOpenPromise: null,
  });
}

function QuitOnCtrlCHarness() {
  const hasPopup = usePopupStore((s) => s.hasPopup);
  const { quitIfConfirmed } = useQuit();

  useInput(
    (input, key) => {
      if (hasPopup) return;
      if (key.ctrl && input === "c") {
        void quitIfConfirmed();
      }
    },
    { isActive: true },
  );

  return null;
}

function renderIssueTable(ui: React.ReactElement): ReturnType<typeof render> {
  let view: ReturnType<typeof render>;
  act(() => {
    view = render(
      <IntlProvider locale="en" messages={{}}>
        <AppContextProvider>{ui}</AppContextProvider>
      </IntlProvider>,
    );
  });
  return view!;
}

describe("IssueTable", () => {
  let refreshIssueListsMock: jest.Mock<
    ReturnType<typeof useAppStore.getState>["refreshIssueLists"]
  > | null = null;
  let pickOpenMock: jest.Mock<
    ReturnType<typeof usePickItemDialogStore.getState>["open"]
  > | null = null;
  let suspendMock: jest.Mock<() => Promise<void>>;
  let resumeMock: jest.Mock<() => void>;

  beforeEach(() => {
    jest.useFakeTimers();
    resetGlobalConfigStore();
    useTerminalSizeStore.setState({ cols: 20, rows: 10 });
    resetAppStore();
    resetReactSessionStore();
    resetIssueSearchStore();
    resetPickItemDialogForTest();
    resetTextEditDialogForTest();
    resetPaletteCommandStoreForTest();
    resetConfirmationDialogForTest();
    mockIssueSearchStoreForAppContext();

    suspendMock = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);
    resumeMock = jest.fn();
    useReactSessionStore.setState({
      suspend: suspendMock,
      resume: resumeMock,
    });

    useAppStore.setState({
      refreshIssueLists: jest.fn().mockImplementation(async () => {
        return useAppStore.getState().mainIssueLists ?? [];
      }),
    });
    usePopupStore.setState({
      popupStack: [],
      hasPopup: false,
      latestPopup: null,
    });
  });

  afterEach(() => {
    refreshIssueListsMock = null;
    pickOpenMock = null;
    act(() => {
      cleanup();
    });
    jest.useRealTimers();
    jest.restoreAllMocks();
    resetAppStore();
    resetReactSessionStore();
    resetIssueSearchStore();
    resetPickItemDialogForTest();
    resetTextEditDialogForTest();
    resetPaletteCommandStoreForTest();
    resetConfirmationDialogForTest();
    usePopupStore.setState({
      popupStack: [],
      hasPopup: false,
      latestPopup: null,
    });
  });

  it("opens TextEditDialog for the selected issue when e is pressed", async () => {
    const bundle = createMockSystemContext();
    bundle.trackerRepoStore.getCurrentTrackerRepo.mockResolvedValue({
      name: "repo-a",
      projectPath: "/tmp/repo-a",
      trackerPath: "/tmp/repo-a",
      config: {},
    });

    const issue = buildIssueFolder("MI0001", {
            path: "/tmp/MI0001-a",
      title: "First",
    });
    const issueFilePath = `${issue.path}/issue.md`;
    bundle.fileService.exists.mockImplementation((p: string) =>
      Promise.resolve(p === issueFilePath),
    );

    useAppStore.setState({
      mainIssueLists: [issue],
      selectedIssueId: issue.issueId,
    });

    let view: ReturnType<typeof render>;
    view = renderIssueTable(
      <Box width={80} height={10}>
        <IssueTable />
      </Box>,
    );

    await act(async () => {
      view.stdin.write("e");
      await Promise.resolve();
    });

    expect(useTextEditDialogStore.getState().isDialogOpen).toBe(true);
    expect(useTextEditDialogStore.getState().filePath).toBe(issueFilePath);
    expect(usePopupStore.getState().latestPopup).toBe(PopupNames.TextEditDialog);
    expect(useAppStore.getState().navigationStack).toHaveLength(1);
    expect(useAppStore.getState().getCurrentPage().name).toBe("ISSUE_TABLE");

    await act(async () => {
      useTextEditDialogStore.getState().close({
        lastUpdatedTimestamp: null,
        lastLogicalLineIndex: 0,
      });
    });
  });

  it("touches updated_at and refreshes issue metadata after TextEditDialog closes with edits", async () => {
    const bundle = createMockSystemContext();
    bundle.trackerRepoStore.getCurrentTrackerRepo.mockResolvedValue({
      name: "repo-a",
      projectPath: "/tmp/repo-a",
      trackerPath: "/tmp/repo-a",
      config: {},
    });

    const issue = buildIssueFolder("MI0001", {
            path: "/tmp/MI0001-a",
      title: "First",
    });
    const issueFilePath = `${issue.path}/issue.md`;
    bundle.fileService.exists.mockImplementation((p: string) =>
      Promise.resolve(p === issueFilePath),
    );

    const editedAt = new Date("2026-07-06T12:00:00+08:00");
    jest
      .spyOn(useTextEditDialogStore.getState(), "open")
      .mockResolvedValue({
        lastUpdatedTimestamp: editedAt,
        lastLogicalLineIndex: 0,
      });
    const touchUpdatedAtSpy = jest
      .spyOn(IssueFolderStorage.prototype, "touchUpdatedAtIfNotSuperseded")
      .mockResolvedValue(editedAt);
    const applyIssueMetadataUpdateSpy = jest.spyOn(
      useAppStore.getState(),
      "applyIssueMetadataUpdate",
    );

    useAppStore.setState({
      mainIssueLists: [issue],
      selectedIssueId: issue.issueId,
    });

    let view: ReturnType<typeof render>;
    view = renderIssueTable(
      <Box width={80} height={10}>
        <IssueTable />
      </Box>,
    );

    await act(async () => {
      view.stdin.write("e");
      await Promise.resolve();
    });

    expect(touchUpdatedAtSpy).toHaveBeenCalledWith(editedAt);
    expect(applyIssueMetadataUpdateSpy).toHaveBeenCalledWith(
      issue.issueId,
      expect.objectContaining({ updatedAt: editedAt }),
    );

    touchUpdatedAtSpy.mockRestore();
    applyIssueMetadataUpdateSpy.mockRestore();
  });

  it("does not refresh issue metadata when updated_at was superseded by a concurrent edit", async () => {
    const bundle = createMockSystemContext();
    bundle.trackerRepoStore.getCurrentTrackerRepo.mockResolvedValue({
      name: "repo-a",
      projectPath: "/tmp/repo-a",
      trackerPath: "/tmp/repo-a",
      config: {},
    });

    const issue = buildIssueFolder("MI0001", {
            path: "/tmp/MI0001-a",
      title: "First",
    });
    const issueFilePath = `${issue.path}/issue.md`;
    bundle.fileService.exists.mockImplementation((p: string) =>
      Promise.resolve(p === issueFilePath),
    );

    const editedAt = new Date("2026-07-06T12:00:00+08:00");
    jest
      .spyOn(useTextEditDialogStore.getState(), "open")
      .mockResolvedValue({
        lastUpdatedTimestamp: editedAt,
        lastLogicalLineIndex: 0,
      });
    const touchUpdatedAtSpy = jest
      .spyOn(IssueFolderStorage.prototype, "touchUpdatedAtIfNotSuperseded")
      .mockResolvedValue(null);
    const applyIssueMetadataUpdateSpy = jest.spyOn(
      useAppStore.getState(),
      "applyIssueMetadataUpdate",
    );

    useAppStore.setState({
      mainIssueLists: [issue],
      selectedIssueId: issue.issueId,
    });

    let view: ReturnType<typeof render>;
    view = renderIssueTable(
      <Box width={80} height={10}>
        <IssueTable />
      </Box>,
    );

    await act(async () => {
      view.stdin.write("e");
      await Promise.resolve();
    });

    expect(touchUpdatedAtSpy).toHaveBeenCalledWith(editedAt);
    expect(applyIssueMetadataUpdateSpy).not.toHaveBeenCalled();

    touchUpdatedAtSpy.mockRestore();
    applyIssueMetadataUpdateSpy.mockRestore();
  });

  it("opens pick editor and launches external editor when ctrl+e is pressed", async () => {
    const bundle = createMockSystemContext();
    bundle.trackerRepoStore.getCurrentTrackerRepo.mockResolvedValue({
      name: "repo-a",
      projectPath: "/tmp/repo-a",
      trackerPath: "/tmp/repo-a",
      config: { issue_path: "issues", editor: "/usr/bin/vim" },
    });
    bundle.shellService.which.mockImplementation(async (editor) => {
      if (editor === "vim" || editor === "/usr/bin/vim") return "/usr/bin/vim";
      if (editor === "nano") return "/usr/bin/nano";
      return null;
    });
    ShellService.setInstance(bundle.shellService);
    const stdoutWriteSpy = jest
      .spyOn(process.stdout, "write")
      .mockImplementation(() => true);

    const issue = buildIssueFolder("MI0001", {
            path: "/tmp/MI0001-a",
      title: "First",
    });
    const issueFilePath = `${issue.path}/issue.md`;
    bundle.fileService.exists.mockImplementation((p: string) =>
      Promise.resolve(p === issueFilePath),
    );

    pickOpenMock = jest.fn().mockResolvedValue({
      type: PickItemDialogResponseType.Accepted,
      acceptedValue: "/usr/bin/nano",
    });
    usePickItemDialogStore.setState({ open: pickOpenMock });

    useAppStore.setState({
      mainIssueLists: [issue],
      selectedIssueId: issue.issueId,
    });

    let view: ReturnType<typeof render>;
    view = renderIssueTable(
      <Box width={80} height={10}>
        <IssueTable />
      </Box>,
    );

    await act(async () => {
      view.stdin.write("\x05");
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(pickOpenMock).toHaveBeenCalled();
    expect(suspendMock).toHaveBeenCalled();
    expect(bundle.shellService.runAndWait).toHaveBeenCalledWith(
      "/usr/bin/nano",
      [issueFilePath],
    );
    expect(resumeMock).toHaveBeenCalled();
    expect(useTextEditDialogStore.getState().isDialogOpen).toBe(false);
    expect(useAppStore.getState().navigationStack).toHaveLength(1);
    expect(useAppStore.getState().getCurrentPage().name).toBe("ISSUE_TABLE");
    expect(stdoutWriteSpy).toHaveBeenCalledWith(
      "/usr/bin/nano /tmp/MI0001-a/issue.md\n",
    );

    stdoutWriteSpy.mockRestore();
  });

  it("resets selected issue to the first row after switching via recent projects", async () => {
    const bundle = createMockSystemContext();
    bundle.trackerRepoStore.getCurrentTrackerRepo.mockResolvedValue({
      name: "repo-a",
      projectPath: "/tmp/repo-a",
      trackerPath: "/tmp/repo-a",
      config: {},
    });
    bundle.registryService.getRecentProjects.mockResolvedValue([
      { name: "repo-b", projectPath: "/tmp/repo-b" },
    ]);
    bundle.trackerRepoStore.loadCurrentTrackerRepoByPath.mockImplementation(
      async (projectPath: string) => {
        setMockCurrentTrackerRepo({
          name: "repo-b",
          projectPath,
          trackerPath: projectPath,
          config: {},
        });
      },
    );

    const issueBeforeA = buildIssueFolder("MI0001", {
            path: "/tmp/repo-a/MI0001-a",
      title: "First",
      status: "open",
    });
    const issueBeforeB = buildIssueFolder("MI0002", {
            path: "/tmp/repo-a/MI0002-b",
      title: "Second",
      status: "open",
    });

    const issuesAfterSwitch: IssueFolder[] = [
      buildIssueFolder("ZZ0001-x", {
        path: "/tmp/repo-b/ZZ0001-x",
        title: "Alpha",
        status: "open",
      }),
      buildIssueFolder("ZZ0002", {
                path: "/tmp/repo-b/ZZ0002-y",
        title: "Beta",
        status: "open",
      }),
    ];

    useAppStore.setState({
      mainIssueLists: [issueBeforeA, issueBeforeB],
      selectedIssueId: "MI0002-b",
      filter: "status:open",
    });

    refreshIssueListsMock = jest.fn().mockImplementation(async () => {
      useAppStore.setState({
        filter: null,
        mainIssueLists: issuesAfterSwitch,
        searchRestoreIssueId: null,
        tableRangeSelectionAnchorIssueId: null,
      });
      return issuesAfterSwitch;
    });
    useAppStore.setState({ refreshIssueLists: refreshIssueListsMock });

    pickOpenMock = jest.fn().mockResolvedValue({
      type: PickItemDialogResponseType.Accepted,
      acceptedValue: { name: "repo-b", projectPath: "/tmp/repo-b" },
    });
    usePickItemDialogStore.setState({ open: pickOpenMock });

    let view: ReturnType<typeof render>;
    view = renderIssueTable(
      <Box width={20} height={10}>
        <IssueTable
          largeTerminalHeightThreshold={
            ISSUE_TABLE_PROJECT_NAME_HEADER_THRESHOLD
          }
        />
      </Box>,
    );

    await act(async () => {
      await Promise.resolve();
    });
    expect(view.lastFrame()).toContain("repo-a");

    await act(async () => {
      view.stdin.write("\x12");
    });

    // Bounded advance: `runAllTimersAsync` can stall when combined with act()
    // and lingering async (e.g. IssueTable’s post-switch 800ms delay).
    await act(async () => {
      await jest.advanceTimersByTimeAsync(2000);
    });

    const state = useAppStore.getState();
    expect(state.selectedIssueId).toBe("ZZ0001-x");
    expect(state.filter).toBeNull();
    expect(state.isLoadingIssueList).toBe(false);
    expect(view.lastFrame()).toContain("repo-b");
    expect(view.lastFrame()).not.toContain("repo-a");
  });

  it("keeps selection on the last folder when label is duplicated", async () => {
    const bundle = createMockSystemContext();
    bundle.trackerRepoStore.getCurrentTrackerRepo.mockResolvedValue({
      name: "repo-a",
      projectPath: "/tmp/repo-a",
      trackerPath: "/tmp/repo-a",
      config: {},
    });

    const duplicateIssues: IssueFolder[] = [
      buildIssueFolder("AB0001-hello-world", {
        path: "/tmp/repo-a/AB0001-hello-world",
        title: "Hello",
        status: "open",
      }),
      buildIssueFolder("AB0001-start", {
        path: "/tmp/repo-a/AB0001-start",
        title: "Start",
        status: "open",
      }),
    ];

    useAppStore.setState({
      mainIssueLists: duplicateIssues,
      selectedIssueId: "AB0001-start",
    });

    let view: ReturnType<typeof render>;
    view = renderIssueTable(
      <Box width={80} height={10}>
        <IssueTable />
      </Box>,
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(useAppStore.getState().selectedIssueId).toBe("AB0001-start");
    expect(view.lastFrame()).toContain("Start");
  });

  it("selects the last row on End when multiple issues share a label", async () => {
    const bundle = createMockSystemContext();
    bundle.trackerRepoStore.getCurrentTrackerRepo.mockResolvedValue({
      name: "repo-a",
      projectPath: "/tmp/repo-a",
      trackerPath: "/tmp/repo-a",
      config: {},
    });

    const duplicateIssues: IssueFolder[] = [
      buildIssueFolder("AB0001-hello-world", {
        path: "/tmp/repo-a/AB0001-hello-world",
        title: "Hello",
        status: "open",
      }),
      buildIssueFolder("AB0001-start", {
        path: "/tmp/repo-a/AB0001-start",
        title: "Start",
        status: "open",
      }),
    ];

    useAppStore.setState({
      mainIssueLists: duplicateIssues,
      selectedIssueId: "AB0001-hello-world",
    });

    let view: ReturnType<typeof render>;
    view = renderIssueTable(
      <Box width={80} height={10}>
        <IssueTable />
      </Box>,
    );

    await act(async () => {
      view.stdin.write(AnsiEscapeCode.DELETE);
      await Promise.resolve();
    });

    expect(useAppStore.getState().selectedIssueId).toBe("AB0001-start");
  });

  it("toggles table range selection when V is pressed", async () => {
    const bundle = createMockSystemContext();
    bundle.trackerRepoStore.getCurrentTrackerRepo.mockResolvedValue({
      name: "repo-a",
      projectPath: "/tmp/repo-a",
      trackerPath: "/tmp/repo-a",
      config: {},
    });

    const issues: IssueFolder[] = [
      buildIssueFolder("MI0001", {
                path: "/tmp/MI0001-a",
        title: "First",
      }),
      buildIssueFolder("MI0002", {
                path: "/tmp/MI0002-b",
        title: "Second",
      }),
    ];

    useAppStore.setState({
      mainIssueLists: issues,
      selectedIssueId: issues[0]!.issueId,
    });

    let view: ReturnType<typeof render>;
    view = renderIssueTable(
      <Box width={80} height={10}>
        <IssueTable />
      </Box>,
    );

    await act(async () => {
      view.stdin.write("v");
      await Promise.resolve();
    });

    expect(
      useAppStore.getState().tableRangeSelectionAnchorIssueId,
    ).toBe(issues[0]!.issueId);
    expect(useAppStore.getState().getSelectedIssues()).toHaveLength(1);

    await act(async () => {
      view.stdin.write(AnsiEscapeCode.CURSOR_DOWN);
      await Promise.resolve();
    });

    expect(useAppStore.getState().selectedIssueId).toBe(issues[1]!.issueId);
    expect(useAppStore.getState().getSelectedIssues()).toEqual(issues);

    await act(async () => {
      view.stdin.write("v");
      await Promise.resolve();
    });

    expect(
      useAppStore.getState().tableRangeSelectionAnchorIssueId,
    ).toBeNull();
    expect(useAppStore.getState().getSelectedIssues()).toHaveLength(1);
  });

  it("opens the command palette when colon is pressed in searching mode", async () => {
    const issue = buildIssueFolder("MI0001", {
            path: "/tmp/MI0001-a",
      title: "First",
      status: "open",
    });

    useAppStore.setState({
      mainIssueLists: [issue],
      selectedIssueId: issue.issueId,
      filter: "status:open",
    });

    let view: ReturnType<typeof render>;
    view = renderIssueTable(
      <Box width={80} height={10}>
        <IssueTable />
      </Box>,
    );

    await act(async () => {
      view.stdin.write(":");
      await Promise.resolve();
    });

    expect(usePaletteCommandStore.getState().isOpen).toBe(true);
  });

  it("opens the command palette when question mark is pressed in searching mode", async () => {
    const issue = buildIssueFolder("MI0001", {
            path: "/tmp/MI0001-a",
      title: "First",
      status: "open",
    });

    useAppStore.setState({
      mainIssueLists: [issue],
      selectedIssueId: issue.issueId,
      filter: "status:open",
    });

    let view: ReturnType<typeof render>;
    view = renderIssueTable(
      <Box width={80} height={10}>
        <IssueTable />
      </Box>,
    );

    await act(async () => {
      view.stdin.write("?");
      await Promise.resolve();
    });

    expect(usePaletteCommandStore.getState().isOpen).toBe(true);
    expect(usePaletteCommandStore.getState().initialFilterQuery).toBe("?");
  });

  it("keeps IssueTable responsive after Ctrl+C quit dialog is cancelled with Esc", async () => {
    jest.useRealTimers();
    try {
    const bundle = createMockSystemContext();
    bundle.trackerRepoStore.getCurrentTrackerRepo.mockResolvedValue({
      name: "repo-a",
      projectPath: "/tmp/repo-a",
      trackerPath: "/tmp/repo-a",
      config: {},
    });

    const issues: IssueFolder[] = [
      buildIssueFolder("MI0001", {
                path: "/tmp/MI0001-a",
        title: "First",
      }),
      buildIssueFolder("MI0002", {
                path: "/tmp/MI0002-b",
        title: "Second",
      }),
    ];

    useAppStore.setState({
      mainIssueLists: issues,
      selectedIssueId: issues[0]!.issueId,
    });

    let view: ReturnType<typeof render>;
    view = renderIssueTable(
      <Box width={80} height={10}>
        <QuitOnCtrlCHarness />
        <IssueTable />
        <ConfirmationDialog />
      </Box>,
    );

    await act(async () => {
      view.stdin.write("\x03");
      await flushInkInput();
    });

    expect(useConfirmationDialogStore.getState().isDialogOpen).toBe(true);
    expect(usePopupStore.getState().hasPopup).toBe(true);
    expect(usePopupStore.getState().popupStack).toHaveLength(1);

    await act(async () => {
      view.stdin.write(AnsiEscapeCode.ESC);
      await flushInkInput();
    });

    expect(useConfirmationDialogStore.getState().isDialogOpen).toBe(false);
    expect(usePopupStore.getState().hasPopup).toBe(false);

    await act(async () => {
      view.stdin.write(AnsiEscapeCode.CURSOR_DOWN);
      await flushInkInput();
    });

    expect(useAppStore.getState().selectedIssueId).toBe(issues[1]!.issueId);
    } finally {
      jest.useFakeTimers();
    }
  });

  it("uses resolved status list from the store when rendering issue rows", async () => {
    createMockSystemContext();
    resetGlobalConfigStore();
    useTerminalSizeStore.setState({ cols: 80, rows: 10 });
    setMockCurrentTrackerRepo({
      name: "repo-a",
      projectPath: "/tmp/repo-a",
      trackerPath: "/tmp/repo-a",
      config: {},
    });
    const getResolvedStatusListSpy = jest
      .spyOn(useCurrentTrackerRepoStore.getState(), "getResolvedStatusList")
      .mockResolvedValue(DEFAULT_RESOLVED_STATUS_LIST);

    const openIssue = buildIssueFolder("MI0001", {
            path: "/tmp/repo-a/MI0001-open",
      title: "Open issue",
      status: "open",
    });
    const closedIssue = buildIssueFolder("MI0002", {
            path: "/tmp/repo-a/MI0002-closed",
      title: "Closed issue",
      status: "closed",
    });

    useAppStore.setState({
      mainIssueLists: [openIssue, closedIssue],
      selectedIssueId: openIssue.issueId,
    });

    let view: ReturnType<typeof render>;
    view = renderIssueTable(
      <Box width={80} height={10}>
        <IssueTable />
      </Box>,
    );

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(getResolvedStatusListSpy).toHaveBeenCalled();
    expect(view.lastFrame()).toContain("MI0001");
    expect(view.lastFrame()).toContain("MI0002");
    getResolvedStatusListSpy.mockRestore();
  });
});
