import React, { act } from "react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals";
import { cleanup, render } from "ink-testing-library";
import { IntlProvider } from "react-intl";
import { FileService } from "../../../src/services/FileService.ts";
import { IssueViewer } from "../../../src/views/components/IssueViewer.tsx";
import { AppContextProvider } from "../../../src/contexts/AppContext.tsx";
import { resetAppStore, useAppStore } from "../../../src/store/AppStore.ts";
import { useConfirmationDialogStore } from "../../../src/store/ConfirmationDialogStore.ts";
import { useTerminalSizeStore } from "../../../src/views/hooks/useTerminal.ts";
import { viewerNavigationStack } from "../../fixture/navigationStack.ts";
import { createMockSystemContext } from "../../fixture/MockSystemContext.tsx";
import { buildIssueFolder } from "../../fixture/buildIssueFolder.ts";
import type { IssueFolder } from "../../../src/types/Issue.ts";
import { IssueFolderStorage } from "../../../src/utils/storage/IssueFolderStorage.ts";
import { EditIssueMarkdownFileHelper } from "../../../src/helpers/EditIssueMarkdownFileHelper.ts";
import {
  resetFileWatcherStore,
  useFileWatcherStore,
} from "../../../src/store/FileWatcherStore.ts";
import { useTextEditDialogStore } from "../../../src/store/TextEditDialogStore.ts";
import type { IssueSearchStoreState } from "../../../src/store/IssueSearchStore.ts";
import {
  IssueSearchStoreFactory,
  type IssueSearchStore,
} from "../../../src/store/IssueSearchStore.ts";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

const ISSUE_PATH = "/repo/issues/MI0001-demo/MI0001-demo.md";
const ATTACHMENT_PATH = "/repo/issues/MI0001-demo/files/notes.md";
const FILE_BODY = `---
title: Demo issue
status: open
priority: high
---
# Heading

Body line
`;
const ATTACHMENT_BODY = `---
title: Attachment title
status: closed
priority: low
---
# Notes

Attachment body
`;

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

async function pressDownAsync(
  view: { stdin: { write: (data: string) => void } },
  times: number,
) {
  for (let i = 0; i < times; i++) {
    await act(async () => {
      view.stdin.write("\x1b[B");
      await Promise.resolve();
    });
  }
}

function renderIssueViewer(
  issue: IssueFolder,
  attachmentPath?: string,
): ReturnType<typeof render> {
  let view: ReturnType<typeof render>;
  act(() => {
    view = render(
      <IntlProvider locale="en" messages={{}}>
        <AppContextProvider>
          <IssueViewer issue={issue} attachmentPath={attachmentPath} />
        </AppContextProvider>
      </IntlProvider>,
    );
  });
  return view!;
}

function attachmentViewerNavigationStack(
  issue: IssueFolder,
  attachmentPath: string,
) {
  return [
    ...viewerNavigationStack(issue),
    {
      name: "ISSUE_VIEWER" as const,
      args: { issue, attachmentPath },
    },
  ];
}

afterEach(() => {
  FileService.setInstance(new FileService());
  act(() => {
    cleanup();
  });
  resetAppStore();
  resetFileWatcherStore();
  useConfirmationDialogStore.setState({
    isDialogOpen: false,
    title: "",
    message: "",
    confirmLabel: undefined,
    variant: "default",
    ctrlCToConfirm: false,
    cancelDisabled: false,
    pendingResolve: null,
    activeOpenPromise: null,
  });
  useTextEditDialogStore.setState({
    isDialogOpen: false,
    openSession: 0,
    filePath: null,
    initialLineIndex: 0,
    pendingResolve: null,
  });
  jest.restoreAllMocks();
});

describe("IssueViewer", () => {
  beforeEach(() => {
    useTerminalSizeStore.setState({ cols: 80, rows: 24 });
    mockIssueSearchStoreForAppContext();
    createMockSystemContext();
  });

  it("does not re-resolve issue file path when metadata updates for the same issue", async () => {
    const issue = buildIssueFolder("MI0001", {
            path: "/repo/issues/MI0001-demo",
      title: "Demo issue",
      status: "open",
      priority: "high",
    });

    const findIssueFileSpy = jest
      .spyOn(IssueFolderStorage.prototype, "findIssueFile")
      .mockResolvedValue(ISSUE_PATH);

    const mockFileService = FileService.getInstance() as jest.Mocked<FileService>;
    mockFileService.readFile.mockResolvedValue(FILE_BODY);
    mockFileService.stat.mockResolvedValue({
      mtime: new Date("2026-05-10T12:00:00Z"),
    } as never);

    useAppStore.setState({
      mainIssueLists: [issue],
      navigationStack: viewerNavigationStack(issue),
      selectedIssueId: issue.issueId,
    });

    let view = renderIssueViewer(issue);

    await act(async () => {
      await Promise.resolve();
    });

    expect(findIssueFileSpy).toHaveBeenCalledTimes(1);

    await pressDownAsync(view, 7);
    expect(view.lastFrame()).toContain("  Body line");

    const updatedAt = new Date("2026-07-08T12:00:00Z");
    const updatedIssue: IssueFolder = {
      ...issue,
      metadata: {
        title: "Demo issue",
        status: "open",
        priority: "high",
        updatedAt,
      },
    };

    await act(async () => {
      useAppStore.getState().applyIssueMetadataUpdate(issue.issueId, {
        title: "Demo issue",
        status: "open",
        priority: "high",
        updatedAt,
      });
      await Promise.resolve();
    });

    await act(async () => {
      view.rerender(
        <IntlProvider locale="en" messages={{}}>
          <AppContextProvider>
            <IssueViewer issue={updatedIssue} />
          </AppContextProvider>
        </IntlProvider>,
      );
      await Promise.resolve();
    });

    expect(findIssueFileSpy).toHaveBeenCalledTimes(1);
    expect(view.lastFrame()).toContain("  Body line");
  });

  it("reloads the markdown viewer content after inline edit closes", async () => {
    const issue = buildIssueFolder("MI0001", {
            path: "/repo/issues/MI0001-demo",
      title: "Demo issue",
      status: "open",
      priority: "high",
    });

    jest
      .spyOn(IssueFolderStorage.prototype, "findIssueFile")
      .mockResolvedValue(ISSUE_PATH);
    jest.spyOn(EditIssueMarkdownFileHelper, "edit").mockResolvedValue({
      isModified: true,
      lastLogicalLineIndex: 3,
    });

    const mockFileService = FileService.getInstance() as jest.Mocked<FileService>;
    mockFileService.readFile.mockResolvedValue(FILE_BODY);
    mockFileService.stat.mockResolvedValue({
      mtime: new Date("2026-05-10T12:00:00Z"),
    } as never);

    useAppStore.setState({
      mainIssueLists: [issue],
      navigationStack: viewerNavigationStack(issue),
      selectedIssueId: issue.issueId,
    });

    const requestReloadSpy = jest.spyOn(
      useFileWatcherStore.getState(),
      "requestReload",
    );
    const cancelReloadSpy = jest.spyOn(
      useFileWatcherStore.getState(),
      "cancelReload",
    );

    const view = renderIssueViewer(issue);

    await act(async () => {
      await Promise.resolve();
    });

    const readCountAfterInitialLoad = mockFileService.readFile.mock.calls.length;

    await act(async () => {
      view.stdin.write("E");
      await Promise.resolve();
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(EditIssueMarkdownFileHelper.edit).toHaveBeenCalledWith(issue, {
      filePath: ISSUE_PATH,
      initialLineIndex: 0,
    });
    expect(cancelReloadSpy).toHaveBeenCalledWith(ISSUE_PATH);
    expect(requestReloadSpy).not.toHaveBeenCalled();
    expect(mockFileService.readFile.mock.calls.length).toBeGreaterThan(
      readCountAfterInitialLoad,
    );
  });

  it("opens TextEditDialog for attachment inline edit without EditIssueMarkdownFileHelper", async () => {
    const issue = buildIssueFolder("MI0001", {
      path: "/repo/issues/MI0001-demo",
      title: "Demo issue",
      status: "open",
      priority: "high",
    });

    const openSpy = jest
      .spyOn(useTextEditDialogStore.getState(), "open")
      .mockResolvedValue({
        lastUpdatedTimestamp: new Date("2026-05-10T12:00:00Z"),
        lastLogicalLineIndex: 2,
      });
    const editHelperSpy = jest.spyOn(EditIssueMarkdownFileHelper, "edit");

    const mockFileService = FileService.getInstance() as jest.Mocked<FileService>;
    mockFileService.readFile.mockResolvedValue(ATTACHMENT_BODY);
    mockFileService.stat.mockResolvedValue({
      mtime: new Date("2026-05-10T12:00:00Z"),
    } as never);

    useAppStore.setState({
      mainIssueLists: [issue],
      navigationStack: attachmentViewerNavigationStack(issue, ATTACHMENT_PATH),
      selectedIssueId: issue.issueId,
    });

    const view = renderIssueViewer(issue, ATTACHMENT_PATH);

    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      view.stdin.write("E");
      await Promise.resolve();
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(openSpy).toHaveBeenCalledWith({
      filePath: ATTACHMENT_PATH,
      initialLineIndex: 0,
    });
    expect(editHelperSpy).not.toHaveBeenCalled();
  });

  it("reloads markdown viewer content after attachment inline edit closes", async () => {
    const issue = buildIssueFolder("MI0001", {
      path: "/repo/issues/MI0001-demo",
      title: "Demo issue",
      status: "open",
      priority: "high",
    });

    jest.spyOn(useTextEditDialogStore.getState(), "open").mockResolvedValue({
      lastUpdatedTimestamp: new Date("2026-05-10T12:00:00Z"),
      lastLogicalLineIndex: 2,
    });

    const mockFileService = FileService.getInstance() as jest.Mocked<FileService>;
    mockFileService.readFile.mockResolvedValue(ATTACHMENT_BODY);
    mockFileService.stat.mockResolvedValue({
      mtime: new Date("2026-05-10T12:00:00Z"),
    } as never);

    useAppStore.setState({
      mainIssueLists: [issue],
      navigationStack: attachmentViewerNavigationStack(issue, ATTACHMENT_PATH),
      selectedIssueId: issue.issueId,
    });

    const cancelReloadSpy = jest.spyOn(
      useFileWatcherStore.getState(),
      "cancelReload",
    );

    const view = renderIssueViewer(issue, ATTACHMENT_PATH);

    await act(async () => {
      await Promise.resolve();
    });

    const readCountAfterInitialLoad = mockFileService.readFile.mock.calls.length;

    await act(async () => {
      view.stdin.write("E");
      await Promise.resolve();
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(cancelReloadSpy).toHaveBeenCalledWith(ATTACHMENT_PATH);
    expect(mockFileService.readFile.mock.calls.length).toBeGreaterThan(
      readCountAfterInitialLoad,
    );
  });

  it("does not apply issue metadata updates when attachment content has frontmatter", async () => {
    const issue = buildIssueFolder("MI0001", {
      path: "/repo/issues/MI0001-demo",
      title: "Demo issue",
      status: "open",
      priority: "high",
    });

    const mockFileService = FileService.getInstance() as jest.Mocked<FileService>;
    mockFileService.readFile.mockResolvedValue(ATTACHMENT_BODY);
    mockFileService.stat.mockResolvedValue({
      mtime: new Date("2026-05-10T12:00:00Z"),
    } as never);

    useAppStore.setState({
      mainIssueLists: [issue],
      navigationStack: attachmentViewerNavigationStack(issue, ATTACHMENT_PATH),
      selectedIssueId: issue.issueId,
    });

    const applyIssueMetadataUpdateSpy = jest.spyOn(
      useAppStore.getState(),
      "applyIssueMetadataUpdate",
    );

    renderIssueViewer(issue, ATTACHMENT_PATH);

    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(applyIssueMetadataUpdateSpy).not.toHaveBeenCalled();
  });

  it("closes the issue viewer when the missing-file dialog is cancelled", async () => {
    const issue = buildIssueFolder("MI0001", {
      path: "/repo/issues/MI0001-demo",
      title: "Demo issue",
      status: "open",
      priority: "high",
    });

    jest
      .spyOn(IssueFolderStorage.prototype, "findIssueFile")
      .mockResolvedValue(ISSUE_PATH);

    const enoent = Object.assign(new Error("ENOENT"), { code: "ENOENT" });
    const mockFileService = FileService.getInstance() as jest.Mocked<FileService>;
    mockFileService.readFile.mockRejectedValue(enoent);

    useAppStore.setState({
      mainIssueLists: [issue],
      navigationStack: viewerNavigationStack(issue),
      selectedIssueId: issue.issueId,
    });

    const confirmationOpenMock = jest
      .fn<
        ReturnType<typeof useConfirmationDialogStore.getState>["open"]
      >()
      .mockResolvedValue({ type: "cancelled" });
    useConfirmationDialogStore.setState({ open: confirmationOpenMock });
    const closeIssueMock = jest.fn();
    useAppStore.setState({ closeIssue: closeIssueMock });

    renderIssueViewer(issue);

    await act(async () => {
      await Promise.resolve();
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(confirmationOpenMock).toHaveBeenCalledTimes(1);
    expect(confirmationOpenMock).toHaveBeenCalledWith(
      expect.objectContaining({
        cancelDisabled: true,
      }),
    );
    expect(closeIssueMock).toHaveBeenCalledTimes(1);
  });

  it("closes the issue viewer when the missing-file confirmation is accepted", async () => {
    const issue = buildIssueFolder("MI0001", {
      path: "/repo/issues/MI0001-demo",
      title: "Demo issue",
      status: "open",
      priority: "high",
    });

    jest
      .spyOn(IssueFolderStorage.prototype, "findIssueFile")
      .mockResolvedValue(ISSUE_PATH);

    const enoent = Object.assign(new Error("ENOENT"), { code: "ENOENT" });
    const mockFileService = FileService.getInstance() as jest.Mocked<FileService>;
    mockFileService.readFile.mockRejectedValue(enoent);

    useAppStore.setState({
      mainIssueLists: [issue],
      navigationStack: viewerNavigationStack(issue),
      selectedIssueId: issue.issueId,
    });

    const confirmationOpenMock = jest
      .fn<
        ReturnType<typeof useConfirmationDialogStore.getState>["open"]
      >()
      .mockResolvedValue({ type: "accepted" });
    useConfirmationDialogStore.setState({ open: confirmationOpenMock });
    const closeIssueMock = jest.fn();
    useAppStore.setState({ closeIssue: closeIssueMock });

    renderIssueViewer(issue);

    await act(async () => {
      await Promise.resolve();
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(confirmationOpenMock).toHaveBeenCalledTimes(1);
    expect(confirmationOpenMock).toHaveBeenCalledWith(
      expect.objectContaining({
        cancelDisabled: true,
      }),
    );
    expect(closeIssueMock).toHaveBeenCalledTimes(1);
  });

  it("does not open the missing-file dialog for non-ENOENT read errors", async () => {
    const issue = buildIssueFolder("MI0001", {
      path: "/repo/issues/MI0001-demo",
      title: "Demo issue",
      status: "open",
      priority: "high",
    });

    jest
      .spyOn(IssueFolderStorage.prototype, "findIssueFile")
      .mockResolvedValue(ISSUE_PATH);

    const mockFileService = FileService.getInstance() as jest.Mocked<FileService>;
    mockFileService.readFile.mockRejectedValue(
      Object.assign(new Error("EACCES"), { code: "EACCES" }),
    );

    useAppStore.setState({
      mainIssueLists: [issue],
      navigationStack: viewerNavigationStack(issue),
      selectedIssueId: issue.issueId,
    });

    const confirmationOpenMock = jest
      .fn<
        ReturnType<typeof useConfirmationDialogStore.getState>["open"]
      >()
      .mockResolvedValue({ type: "cancelled" });
    useConfirmationDialogStore.setState({ open: confirmationOpenMock });

    renderIssueViewer(issue);

    await act(async () => {
      await Promise.resolve();
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(confirmationOpenMock).not.toHaveBeenCalled();
  });
});
