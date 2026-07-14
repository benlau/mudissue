import { jest } from "@jest/globals";
import { IssueLinkHelper } from "../../../src/helpers/IssueLinkHelper.ts";
import { resetAppStore, useAppStore } from "../../../src/store/AppStore.ts";
import {
  resetCurrentTrackerRepoStore,
  useCurrentTrackerRepoStore,
} from "../../../src/store/CurrentTrackerRepoStore.ts";
import { useGlobalConfigStore } from "../../../src/store/GlobalConfigStore.ts";
import {
  resetIssueMetadataChangedPostHookStore,
  useIssueMetadataChangedPostHookStore,
} from "../../../src/store/IssueMetadataChangedPostHookStore.ts";
import {
  IssueSearchingDialogResponseType,
  useIssueSearchingDialogStore,
} from "../../../src/store/IssueSearchingDialogStore.ts";
import { useToastStore } from "../../../src/store/ToastStore.ts";
import { DEFAULT_LINK_TYPES, LinkageTypesAccessor } from "../../../src/types/linkage.ts";
import type { IssueFolder } from "../../../src/types/Issue.ts";
import type { TrackerRepo } from "../../../src/types/Tracker.ts";
import { IssueFolderStorage } from "../../../src/utils/storage/IssueFolderStorage.ts";
import { IssueMarkdownFileStorage } from "../../../src/utils/storage/IssueMarkdownFileStorage.ts";
import {
  PickItemDialogResponseType,
  usePickItemDialogStore,
} from "../../../src/views/components/PickItemDialog.tsx";
import { buildIssueFolder } from "../../fixture/buildIssueFolder.ts";
import { LinkPaletteCommand } from "../../../src/views/PaletteCommands/LinkPaletteCommand.ts";
import { useAlertDialogStore } from "../../../src/store/AlertDialogStore.ts";

const buildIssue = (label: string): IssueFolder =>
  buildIssueFolder(`${label}-test`, {
    label,
    path: `/repo/issues/${label}-test`,
  });

const mockRepo: TrackerRepo = {
  name: "proj-a",
  projectPath: "/repo",
  trackerPath: "/repo",
  config: { issue_path: "issues" },
};

const targetIssue = buildIssueFolder("0003-target", {
  label: "0003",
  path: "/repo/issues/0003-target",
  title: "Target issue",
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

function resetIssueSearchingDialogStore(): void {
  useIssueSearchingDialogStore.setState({
    isOpen: false,
    title: "",
    confirmLabel: "",
    excludeFolderNames: [],
    pendingResolve: null,
  });
}

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

describe("LinkPaletteCommand", () => {
  let toastInfoMock: jest.Mock<
    ReturnType<typeof useToastStore.getState>["info"]
  >;
  let pickOpenMock: jest.Mock<
    ReturnType<typeof usePickItemDialogStore.getState>["open"]
  >;
  let issueSearchOpenMock: jest.Mock<
    ReturnType<typeof useIssueSearchingDialogStore.getState>["open"]
  >;
  let refreshIssueListsMock: jest.Mock<
    ReturnType<typeof useAppStore.getState>["refreshIssueLists"]
  >;
  let linkMock: jest.SpiedFunction<typeof IssueLinkHelper.link>;
  let notifySpy: jest.Mock;

  beforeEach(() => {
    resetAppStore();
    resetCurrentTrackerRepoStore();
    resetIssueMetadataChangedPostHookStore();
    resetPickItemDialogStore();
    resetIssueSearchingDialogStore();
    resetToastStore();
    resetAlertDialogStore();

    toastInfoMock = jest.fn().mockResolvedValue(undefined);
    useToastStore.setState({ info: toastInfoMock });

    pickOpenMock = jest.fn();
    usePickItemDialogStore.setState({ open: pickOpenMock });

    issueSearchOpenMock = jest.fn();
    useIssueSearchingDialogStore.setState({ open: issueSearchOpenMock });

    refreshIssueListsMock = jest.fn().mockResolvedValue([]);
    useAppStore.setState({ refreshIssueLists: refreshIssueListsMock });

    useCurrentTrackerRepoStore.setState({
      findTrackerRepoForIssueFolder: jest.fn().mockResolvedValue(mockRepo),
    });

    useGlobalConfigStore.setState({
      ensureGlobalConfig: jest.fn().mockResolvedValue({}),
    });

    notifySpy = jest.fn().mockResolvedValue(undefined);
    useIssueMetadataChangedPostHookStore.setState({
      notifyMetadataChanged: notifySpy,
    });

    jest
      .spyOn(IssueFolderStorage.prototype, "findIssueFile")
      .mockResolvedValue("/repo/issues/issue.md");
    jest.spyOn(IssueMarkdownFileStorage.prototype, "load").mockResolvedValue();
    jest.spyOn(IssueMarkdownFileStorage.prototype, "getParsed").mockReturnValue({
      frontmatter: { title: "Test" },
      content: "",
      raw: "",
      parseError: false,
    });

    linkMock = jest.spyOn(IssueLinkHelper, "link").mockResolvedValue({
      srcIssue: buildIssue("0001"),
      dstIssue: targetIssue,
      dstNotFound: false,
      linkType: "blocking",
      srcField: "blocking",
      dstField: "blocked_by",
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    resetAppStore();
    resetCurrentTrackerRepoStore();
    resetIssueMetadataChangedPostHookStore();
    resetPickItemDialogStore();
    resetIssueSearchingDialogStore();
    resetToastStore();
    resetAlertDialogStore();
  });

  it("returns early when no issue is selected", async () => {
    useAppStore.setState({
      mainIssueLists: [],
      selectedIssueId: null,
    });

    await new LinkPaletteCommand().callback();

    expect(pickOpenMock).not.toHaveBeenCalled();
  });

  it("links all selected issues to the picked target", async () => {
    const src1 = buildIssue("0001");
    const src2 = buildIssue("0002");
    useAppStore.setState({
      mainIssueLists: [src1, src2],
      selectedIssueId: src2.issueId,
      tableRangeSelectionAnchorIssueId: src1.issueId,
    });

    pickOpenMock.mockResolvedValue({
      type: PickItemDialogResponseType.Accepted,
      acceptedValue: "blocking",
    });
    issueSearchOpenMock.mockResolvedValue({
      type: IssueSearchingDialogResponseType.Accepted,
      issue: targetIssue,
    });

    await new LinkPaletteCommand().callback();

    expect(pickOpenMock).toHaveBeenCalledTimes(1);
    expect(issueSearchOpenMock).toHaveBeenCalledWith({
      title: "blocking",
      confirmLabel: "Link",
      excludeFolderNames: [src1.issueId, src2.issueId],
    });
    expect(linkMock).toHaveBeenCalledTimes(2);
    expect(linkMock).toHaveBeenCalledWith(
      src1.issueId,
      "blocking",
      targetIssue.issueId,
      mockRepo.name,
    );
    expect(linkMock).toHaveBeenCalledWith(
      src2.issueId,
      "blocking",
      targetIssue.issueId,
      mockRepo.name,
    );
    // Once per linked source: notify src + dst
    expect(notifySpy).toHaveBeenCalledTimes(4);
    expect(notifySpy).toHaveBeenCalledWith(
      expect.objectContaining({ issueId: "0001-test" }),
      { title: "Test" },
      { title: "Test" },
    );
    expect(notifySpy).toHaveBeenCalledWith(
      targetIssue,
      { title: "Test" },
      { title: "Test" },
    );
    expect(refreshIssueListsMock).toHaveBeenCalled();
    expect(toastInfoMock).toHaveBeenCalled();
  });

  it("stops when link type pick is cancelled", async () => {
    const src = buildIssue("0001");
    useAppStore.setState({
      mainIssueLists: [src],
      selectedIssueId: src.issueId,
    });

    pickOpenMock.mockResolvedValue({
      type: PickItemDialogResponseType.Cancelled,
    });

    await new LinkPaletteCommand().callback();

    expect(issueSearchOpenMock).not.toHaveBeenCalled();
    expect(linkMock).not.toHaveBeenCalled();
  });

  it("offers linkage types from effective config", async () => {
    const src = buildIssue("0001");
    useAppStore.setState({
      mainIssueLists: [src],
      selectedIssueId: src.issueId,
    });

    const customLinkTypes = ["custom_a/custom_b"];
    useCurrentTrackerRepoStore.setState({
      findTrackerRepoForIssueFolder: jest.fn().mockResolvedValue({
        ...mockRepo,
        config: { issue_path: "issues", link_types: customLinkTypes },
      }),
    });

    pickOpenMock.mockImplementationOnce(async (items) => {
      expect(items).toEqual(["custom_a", "custom_b"]);
      return { type: PickItemDialogResponseType.Cancelled };
    });

    await new LinkPaletteCommand().callback();

    expect(pickOpenMock).toHaveBeenCalledTimes(1);
  });

  it("falls back to default link types when config has none", async () => {
    const src = buildIssue("0001");
    useAppStore.setState({
      mainIssueLists: [src],
      selectedIssueId: src.issueId,
    });

    pickOpenMock.mockImplementationOnce(async (items) => {
      const expected = LinkageTypesAccessor.fromPairs(
        DEFAULT_LINK_TYPES,
      ).getAllFieldNames();
      expect(items).toEqual(expected);
      return { type: PickItemDialogResponseType.Cancelled };
    });

    await new LinkPaletteCommand().callback();
  });

  it("shows alert when link helper throws error response", async () => {
    const src = buildIssue("0001");
    useAppStore.setState({
      mainIssueLists: [src],
      selectedIssueId: src.issueId,
    });

    const alertOpenMock = jest.fn().mockResolvedValue(undefined);
    useAlertDialogStore.setState({ open: alertOpenMock });

    pickOpenMock.mockResolvedValue({
      type: PickItemDialogResponseType.Accepted,
      acceptedValue: "blocking",
    });
    issueSearchOpenMock.mockResolvedValue({
      type: IssueSearchingDialogResponseType.Accepted,
      issue: targetIssue,
    });
    linkMock.mockRejectedValue({
      status: "error",
      error: { code: "LINK_SELF_REFERENCE", message: "Cannot link to self." },
    });

    await new LinkPaletteCommand().callback();

    expect(alertOpenMock).toHaveBeenCalled();
    expect(refreshIssueListsMock).not.toHaveBeenCalled();
    expect(toastInfoMock).not.toHaveBeenCalled();
  });
});
