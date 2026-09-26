import { jest } from "@jest/globals";
import { ClipboardService } from "../../../src/services/ClipboardService.ts";
import { resetAppStore, useAppStore } from "../../../src/store/AppStore.ts";
import { useToastStore } from "../../../src/store/ToastStore.ts";
import type { IssueFolder } from "../../../src/types/Issue.ts";
import { IssueFolderStorage } from "../../../src/async/storage/IssueFolderStorage.ts";
import {
  PickItemDialogResponseType,
  usePickItemDialogStore,
} from "../../../src/views/components/PickItemDialog.tsx";
import {
  CopyToClipboardPaletteCommand,
  type CopyToClipboardTarget,
} from "../../../src/views/PaletteCommands/CopyToClipboardPaletteCommand.ts";
import { buildIssueFolder } from "../../fixture/buildIssueFolder.ts";

const buildIssue = (issueId: string): IssueFolder =>
  buildIssueFolder(issueId, {
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

function resetToastStore(): void {
  useToastStore.setState(useToastStore.getInitialState(), true);
}

describe("CopyToClipboardPaletteCommand", () => {
  let toastInfoMock: jest.Mock<
    ReturnType<typeof useToastStore.getState>["info"]
  >;
  let toastErrorMock: jest.Mock<
    ReturnType<typeof useToastStore.getState>["error"]
  >;
  let pickOpenMock: jest.Mock<
    ReturnType<typeof usePickItemDialogStore.getState>["open"]
  >;
  let writeTextMock: jest.Mock<
    ReturnType<ClipboardService["writeText"]>
  >;

  beforeEach(() => {
    resetAppStore();
    resetPickItemDialogStore();
    resetToastStore();

    toastInfoMock = jest.fn().mockResolvedValue(undefined);
    toastErrorMock = jest.fn().mockResolvedValue(undefined);
    useToastStore.setState({ info: toastInfoMock, error: toastErrorMock });

    pickOpenMock = jest.fn();
    usePickItemDialogStore.setState({ open: pickOpenMock });

    writeTextMock = jest.fn().mockResolvedValue(undefined);
    jest
      .spyOn(ClipboardService, "getInstance")
      .mockReturnValue({ writeText: writeTextMock } as ClipboardService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    resetAppStore();
    resetPickItemDialogStore();
    resetToastStore();
  });

  it("does not open the pick dialog when no issue is selected", async () => {
    useAppStore.setState({
      mainIssueLists: [],
      selectedIssueId: null,
    });

    await new CopyToClipboardPaletteCommand().callback();

    expect(pickOpenMock).not.toHaveBeenCalled();
  });

  it("opens the pick dialog with both targets when a markdown file exists", async () => {
    const issue = buildIssue("MI0001");
    const filePath = "/repo/issues/MI0001-test/issue.md";
    useAppStore.setState({
      mainIssueLists: [issue],
      selectedIssueId: issue.issueId,
    });
    jest
      .spyOn(IssueFolderStorage.prototype, "findIssueFile")
      .mockResolvedValue(filePath);
    pickOpenMock.mockImplementation(async (items, getDisplay) => {
      expect(items).toHaveLength(2);
      const issueIdTarget = items[0] as CopyToClipboardTarget;
      const filePathTarget = items[1] as CopyToClipboardTarget;
      expect(issueIdTarget).toMatchObject({
        kind: "issueId",
        value: "MI0001",
      });
      expect(filePathTarget).toMatchObject({
        kind: "filePath",
        value: filePath,
      });
      expect(getDisplay(issueIdTarget)).toEqual([
        issueIdTarget.label,
        issue.issueId,
      ]);
      expect(getDisplay(filePathTarget)).toEqual([
        filePathTarget.label,
        filePath,
      ]);
      return { type: PickItemDialogResponseType.Cancelled };
    });

    await new CopyToClipboardPaletteCommand().callback();

    expect(pickOpenMock).toHaveBeenCalled();
    expect(writeTextMock).not.toHaveBeenCalled();
  });

  it("opens the pick dialog with only issue ID when no markdown file exists", async () => {
    const issue = buildIssue("MI0002");
    useAppStore.setState({
      mainIssueLists: [issue],
      selectedIssueId: issue.issueId,
    });
    jest
      .spyOn(IssueFolderStorage.prototype, "findIssueFile")
      .mockResolvedValue(undefined);
    pickOpenMock.mockImplementation(async (items) => {
      expect(items).toHaveLength(1);
      expect(items[0]).toMatchObject({ kind: "issueId", value: "MI0002" });
      return { type: PickItemDialogResponseType.Cancelled };
    });

    await new CopyToClipboardPaletteCommand().callback();

    expect(pickOpenMock).toHaveBeenCalled();
    expect(writeTextMock).not.toHaveBeenCalled();
  });

  it("copies issue ID and shows a success toast when that target is selected", async () => {
    const issue = buildIssue("MI0003");
    useAppStore.setState({
      mainIssueLists: [issue],
      selectedIssueId: issue.issueId,
    });
    jest
      .spyOn(IssueFolderStorage.prototype, "findIssueFile")
      .mockResolvedValue(undefined);
    pickOpenMock.mockResolvedValue({
      type: PickItemDialogResponseType.Accepted,
      acceptedValue: {
        kind: "issueId",
        label: "Issue ID",
        value: issue.issueId,
      },
    });

    await new CopyToClipboardPaletteCommand().callback();

    expect(writeTextMock).toHaveBeenCalledWith(issue.issueId);
    expect(toastInfoMock).toHaveBeenCalled();
    expect(toastErrorMock).not.toHaveBeenCalled();
  });

  it("copies file path and shows a success toast when that target is selected", async () => {
    const issue = buildIssue("MI0004");
    const filePath = "/repo/issues/MI0004-test/issue.md";
    useAppStore.setState({
      mainIssueLists: [issue],
      selectedIssueId: issue.issueId,
    });
    jest
      .spyOn(IssueFolderStorage.prototype, "findIssueFile")
      .mockResolvedValue(filePath);
    pickOpenMock.mockResolvedValue({
      type: PickItemDialogResponseType.Accepted,
      acceptedValue: {
        kind: "filePath",
        label: "Absolute path of markdown file",
        value: filePath,
      },
    });

    await new CopyToClipboardPaletteCommand().callback();

    expect(writeTextMock).toHaveBeenCalledWith(filePath);
    expect(toastInfoMock).toHaveBeenCalled();
    expect(toastErrorMock).not.toHaveBeenCalled();
  });

  it("does not copy when the pick dialog is cancelled", async () => {
    const issue = buildIssue("MI0005");
    useAppStore.setState({
      mainIssueLists: [issue],
      selectedIssueId: issue.issueId,
    });
    jest
      .spyOn(IssueFolderStorage.prototype, "findIssueFile")
      .mockResolvedValue("/repo/issues/MI0005-test/issue.md");
    pickOpenMock.mockResolvedValue({
      type: PickItemDialogResponseType.Cancelled,
    });

    await new CopyToClipboardPaletteCommand().callback();

    expect(writeTextMock).not.toHaveBeenCalled();
    expect(toastInfoMock).not.toHaveBeenCalled();
    expect(toastErrorMock).not.toHaveBeenCalled();
  });

  it("shows an error toast when clipboard write fails", async () => {
    const issue = buildIssue("MI0006");
    useAppStore.setState({
      mainIssueLists: [issue],
      selectedIssueId: issue.issueId,
    });
    jest
      .spyOn(IssueFolderStorage.prototype, "findIssueFile")
      .mockResolvedValue(undefined);
    pickOpenMock.mockResolvedValue({
      type: PickItemDialogResponseType.Accepted,
      acceptedValue: {
        kind: "issueId",
        label: "Issue ID",
        value: issue.issueId,
      },
    });
    writeTextMock.mockRejectedValue(new Error("clipboard unavailable"));

    await new CopyToClipboardPaletteCommand().callback();

    expect(writeTextMock).toHaveBeenCalledWith(issue.issueId);
    expect(toastInfoMock).not.toHaveBeenCalled();
    expect(toastErrorMock).toHaveBeenCalled();
  });
});
