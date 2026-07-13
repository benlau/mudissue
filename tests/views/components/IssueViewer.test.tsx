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
import type { IssueSearchStoreState } from "../../../src/store/IssueSearchStore.ts";
import {
  IssueSearchStoreFactory,
  type IssueSearchStore,
} from "../../../src/store/IssueSearchStore.ts";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

const ISSUE_PATH = "/repo/issues/MI0001-demo/MI0001-demo.md";
const FILE_BODY = `---
title: Demo issue
status: open
priority: high
---
# Heading

Body line
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

function renderIssueViewer(issue: IssueFolder): ReturnType<typeof render> {
  let view: ReturnType<typeof render>;
  act(() => {
    view = render(
      <IntlProvider locale="en" messages={{}}>
        <AppContextProvider>
          <IssueViewer issue={issue} />
        </AppContextProvider>
      </IntlProvider>,
    );
  });
  return view!;
}

afterEach(() => {
  FileService.setInstance(new FileService());
  act(() => {
    cleanup();
  });
  resetAppStore();
  resetFileWatcherStore();
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
      folderName: "MI0001-demo",
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
      selectedFolderName: issue.folderName,
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
      folderName: "MI0001-demo",
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
      selectedFolderName: issue.folderName,
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
});
