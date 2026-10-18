import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals";
import matter from "gray-matter";
import { IssueResource } from "../../src/async/resources/IssueResource.ts";
import { CreateIssueHelper } from "../../src/helpers/CreateIssueHelper.ts";
import { ExtractContentIntoNewIssueHelper } from "../../src/helpers/ExtractContentIntoNewIssueHelper.ts";
import { NextIssueIdHelper } from "../../src/helpers/NextIssueIdHelper.ts";
import { FileService } from "../../src/services/FileService.ts";
import { useAlertDialogStore } from "../../src/store/AlertDialogStore.ts";
import { resetAppStore, useAppStore } from "../../src/store/AppStore.ts";
import {
  resetCurrentTrackerRepoStore,
  useCurrentTrackerRepoStore,
} from "../../src/store/CurrentTrackerRepoStore.ts";
import {
  resetGlobalConfigStore,
  useGlobalConfigStore,
} from "../../src/store/GlobalConfigStore.ts";
import {
  createMarkdownViewerHandleStore,
  MarkdownViewerHandleStoreManager,
} from "../../src/store/MarkdownViewerHandleStore.ts";
import { useToastStore } from "../../src/store/ToastStore.ts";
import {
  accessIssueFolderRow,
  type IssueFolder,
} from "../../src/types/Issue.ts";
import { buildIssueFolder } from "../fixture/buildIssueFolder.ts";
import { createMockFileService } from "../fixture/MockServiceContext.tsx";

function resetToastStore(): void {
  useToastStore.setState(useToastStore.getInitialState(), true);
}

function resetAlertDialogStore(): void {
  useAlertDialogStore.setState({
    isDialogOpen: false,
    message: "",
    pendingResolve: null,
  });
}

describe("ExtractContentIntoNewIssueHelper", () => {
  let toastInfoMock: jest.Mock<
    ReturnType<typeof useToastStore.getState>["info"]
  >;
  let alertOpenMock: jest.Mock<
    ReturnType<typeof useAlertDialogStore.getState>["open"]
  >;

  beforeEach(() => {
    resetAppStore();
    resetToastStore();
    resetAlertDialogStore();
    MarkdownViewerHandleStoreManager.reset();

    toastInfoMock = jest.fn().mockResolvedValue(undefined);
    useToastStore.setState({ info: toastInfoMock });

    alertOpenMock = jest.fn().mockResolvedValue(undefined);
    useAlertDialogStore.setState({ open: alertOpenMock });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    resetAppStore();
    resetToastStore();
    resetAlertDialogStore();
    MarkdownViewerHandleStoreManager.reset();
  });

  it("does nothing when no issue is selected", async () => {
    useAppStore.setState({
      mainIssueLists: [],
      selectedIssueId: null,
    });
    const createSubissueOnDisk = jest.spyOn(
      CreateIssueHelper.prototype,
      "createSubissueOnDisk",
    );

    await new ExtractContentIntoNewIssueHelper().extract();

    expect(createSubissueOnDisk).not.toHaveBeenCalled();
    expect(toastInfoMock).not.toHaveBeenCalled();
  });

  it("toasts when there is no active selection", async () => {
    const parent = buildIssueFolder("MI0001-parent", {
      path: "/repo/issues/MI0001-parent",
    });
    useAppStore.setState({
      mainIssueLists: [parent].map((issueFolder) =>
        accessIssueFolderRow(issueFolder).get(),
      ),
      selectedIssueId: parent.issueId,
    });

    const store = createMarkdownViewerHandleStore();
    MarkdownViewerHandleStoreManager.register(store);
    const createSubissueOnDisk = jest.spyOn(
      CreateIssueHelper.prototype,
      "createSubissueOnDisk",
    );

    await new ExtractContentIntoNewIssueHelper().extract();

    expect(createSubissueOnDisk).not.toHaveBeenCalled();
    expect(toastInfoMock).toHaveBeenCalled();
  });

  it("replaces selected content with a wikilink to the new sub-issue", async () => {
    const parent = buildIssueFolder("MI0001-parent", {
      path: "/repo/issues/MI0001-parent",
    });
    const created: IssueFolder = buildIssueFolder("MI0002-extracted-title", {
      path: "/repo/issues/MI0002-extracted-title",
    });
    useAppStore.setState({
      mainIssueLists: [parent].map((issueFolder) =>
        accessIssueFolderRow(issueFolder).get(),
      ),
      selectedIssueId: parent.issueId,
    });

    const callOrder: string[] = [];
    jest
      .spyOn(CreateIssueHelper.prototype, "createIssueOnDisk")
      .mockResolvedValue(created);
    jest
      .spyOn(CreateIssueHelper.prototype, "linkSubissueOnDisk")
      .mockImplementation(async () => {
        callOrder.push("link");
      });
    jest
      .spyOn(CreateIssueHelper.prototype, "openCreatedIssue")
      .mockResolvedValue(undefined);

    const store = createMarkdownViewerHandleStore();
    store.getState().setFilePath("/repo/issues/MI0001-parent/issue.md");
    store.getState().setContent({
      content: "Intro\n# Extracted title\nBody line\nTrailing",
    });
    store.getState().setCursor(1, 0, 1);
    store.getState().toggleSelectionMode();
    store.getState().setCursor(2, 0, 2);
    jest.spyOn(store.getState(), "save").mockImplementation(async () => {
      callOrder.push("save");
    });

    MarkdownViewerHandleStoreManager.register(store);

    await new ExtractContentIntoNewIssueHelper().extract();

    expect(CreateIssueHelper.prototype.createIssueOnDisk).toHaveBeenCalledWith(
      "Extracted title",
      undefined,
      "# Extracted title\nBody line",
    );
    expect(callOrder).toEqual(["save", "link"]);
    expect(CreateIssueHelper.prototype.linkSubissueOnDisk).toHaveBeenCalledWith(
      parent,
      created,
    );
    expect(store.getState().content).toEqual(
      "Intro\n[[MI0002-extracted-title]]\nTrailing",
    );
    expect(CreateIssueHelper.prototype.openCreatedIssue).toHaveBeenCalledWith(
      created,
    );
    expect(toastInfoMock).toHaveBeenCalled();
  });

  it("toasts when the selection has no derivable title", async () => {
    const parent = buildIssueFolder("MI0001-parent", {
      path: "/repo/issues/MI0001-parent",
    });
    useAppStore.setState({
      mainIssueLists: [parent].map((issueFolder) =>
        accessIssueFolderRow(issueFolder).get(),
      ),
      selectedIssueId: parent.issueId,
    });

    const store = createMarkdownViewerHandleStore();
    store.getState().setFilePath("/repo/issues/MI0001-parent/issue.md");
    store.getState().setContent({ content: "Intro\n   \nTrailing" });
    store.getState().setCursor(1, 0, 1);
    store.getState().toggleSelectionMode();
    MarkdownViewerHandleStoreManager.register(store);

    const createSubissueOnDisk = jest.spyOn(
      CreateIssueHelper.prototype,
      "createSubissueOnDisk",
    );

    await new ExtractContentIntoNewIssueHelper().extract();

    expect(createSubissueOnDisk).not.toHaveBeenCalled();
    expect(store.getState().content).toEqual("Intro\n   \nTrailing");
    expect(toastInfoMock).toHaveBeenCalled();
  });

  it("keeps the new child in the parent subissues after the viewer saves", async () => {
    const parentPath = "/repo/issues/MI0001-parent";
    const parentFile = `${parentPath}/issue.md`;
    const parentBody = "Intro\n# Extracted title\nBody line\nTrailing";
    const parent = buildIssueFolder("MI0001-parent", { path: parentPath });
    const files = new Map<string, string>([[parentFile, parentBody]]);
    const savedFileService = FileService.getInstance();
    const mockFileService = createMockFileService();
    mockFileService.exists.mockImplementation(async (filePath: string) =>
      files.has(filePath),
    );
    mockFileService.readFile.mockImplementation(async (filePath: string) => {
      const content = files.get(filePath);
      if (content === undefined) {
        throw new Error(`missing ${filePath}`);
      }
      return content;
    });
    mockFileService.writeFile.mockImplementation(
      async (filePath: string, data: string) => {
        files.set(filePath, data);
      },
    );
    mockFileService.stat.mockImplementation(
      async () =>
        ({
          mtime: new Date("2026-01-01T00:00:00.000Z"),
          birthtime: new Date("2026-01-01T00:00:00.000Z"),
        }) as Awaited<ReturnType<FileService["stat"]>>,
    );
    mockFileService.readdir.mockResolvedValue([]);
    FileService.setInstance(mockFileService);

    useAppStore.setState({
      mainIssueLists: [parent].map((issueFolder) =>
        accessIssueFolderRow(issueFolder).get(),
      ),
      selectedIssueId: parent.issueId,
    });
    useCurrentTrackerRepoStore.setState({
      getCurrentTrackerRepo: jest.fn().mockResolvedValue({
        name: "repo",
        projectPath: "/repo",
        trackerPath: "/repo",
        config: { issue_path: "issues" },
      }),
    });
    useGlobalConfigStore.setState({
      ensureGlobalConfig: jest.fn().mockResolvedValue({}),
    });
    jest
      .spyOn(NextIssueIdHelper.prototype, "allocateNextIssueId")
      .mockResolvedValue("MI0002");
    jest
      .spyOn(IssueResource.prototype, "create")
      .mockImplementation(async (issueFolder) => {
        files.set(
          `${issueFolder.path}/issue.md`,
          "---\ntitle: Extracted title\n---\n\n# Extracted title\nBody line\n",
        );
        return issueFolder;
      });
    jest
      .spyOn(CreateIssueHelper.prototype, "openCreatedIssue")
      .mockResolvedValue(undefined);

    const store = createMarkdownViewerHandleStore();
    store.getState().setFilePath(parentFile);
    store.getState().setContent({ content: parentBody });
    store.getState().setCursor(1, 0, 1);
    store.getState().toggleSelectionMode();
    store.getState().setCursor(2, 0, 2);
    MarkdownViewerHandleStoreManager.register(store);

    try {
      await new ExtractContentIntoNewIssueHelper().extract();

      const parentParsed = matter(files.get(parentFile) ?? "");
      expect(parentParsed.data.subissues).toEqual("[[MI0002-extracted-title]]");
      expect(parentParsed.content.trim()).toEqual(
        "Intro\n[[MI0002-extracted-title]]\nTrailing",
      );

      const childFile = files.get(
        "/repo/issues/MI0002-extracted-title/issue.md",
      );
      expect(matter(childFile ?? "").data.parent).toEqual("[[MI0001-parent]]");
    } finally {
      FileService.setInstance(savedFileService);
      resetCurrentTrackerRepoStore();
      resetGlobalConfigStore();
    }
  });
});
