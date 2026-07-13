import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { CreateIssueHelper } from "../../src/helpers/CreateIssueHelper.ts";
import { ExtractContentIntoNewIssueHelper } from "../../src/helpers/ExtractContentIntoNewIssueHelper.ts";
import { useAlertDialogStore } from "../../src/store/AlertDialogStore.ts";
import { resetAppStore, useAppStore } from "../../src/store/AppStore.ts";
import {
  createMarkdownViewerHandleStore,
  MarkdownViewerHandleStoreManager,
} from "../../src/store/MarkdownViewerHandleStore.ts";
import { useToastStore } from "../../src/store/ToastStore.ts";
import type { IssueFolder } from "../../src/types/Issue.ts";
import { buildIssueFolder } from "../fixture/buildIssueFolder.ts";

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
      selectedFolderName: null,
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
    const parent = buildIssueFolder("0001", {
      folderName: "MI0001-parent",
      path: "/repo/issues/MI0001-parent",
    });
    useAppStore.setState({
      mainIssueLists: [parent],
      selectedFolderName: parent.folderName,
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
    const parent = buildIssueFolder("0001", {
      folderName: "MI0001-parent",
      path: "/repo/issues/MI0001-parent",
    });
    const created: IssueFolder = buildIssueFolder("0002", {
      folderName: "MI0002-extracted-title",
      path: "/repo/issues/MI0002-extracted-title",
    });
    useAppStore.setState({
      mainIssueLists: [parent],
      selectedFolderName: parent.folderName,
    });

    jest
      .spyOn(CreateIssueHelper.prototype, "createSubissueOnDisk")
      .mockResolvedValue(created);
    jest
      .spyOn(CreateIssueHelper.prototype, "openCreatedIssue")
      .mockResolvedValue(undefined);

    const store = createMarkdownViewerHandleStore();
    store
      .getState()
      .setFilePath("/repo/issues/MI0001-parent/issue.md");
    store.getState().setContent({
      content: "Intro\n# Extracted title\nBody line\nTrailing",
    });
    store.getState().setCursor(1, 0, 1);
    store.getState().toggleSelectionMode();
    store.getState().setCursor(2, 0, 2);
    jest.spyOn(store.getState(), "save").mockResolvedValue(undefined);

    MarkdownViewerHandleStoreManager.register(store);

    await new ExtractContentIntoNewIssueHelper().extract();

    expect(CreateIssueHelper.prototype.createSubissueOnDisk).toHaveBeenCalledWith(
      "Extracted title",
      parent,
      "# Extracted title\nBody line",
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
    const parent = buildIssueFolder("0001", {
      folderName: "MI0001-parent",
      path: "/repo/issues/MI0001-parent",
    });
    useAppStore.setState({
      mainIssueLists: [parent],
      selectedFolderName: parent.folderName,
    });

    const store = createMarkdownViewerHandleStore();
    store
      .getState()
      .setFilePath("/repo/issues/MI0001-parent/issue.md");
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
});
