import { useIssueSearchingDialogStore } from "../../src/store/IssueSearchingDialogStore.ts";
import { IssueSearchingDialogResponseType } from "../../src/store/IssueSearchingDialogStore.ts";
import { PopupNames, usePopupStore } from "../../src/store/PopupStore.ts";
import type { IssueFolder } from "../../src/types/Issue.ts";

const sampleIssue: IssueFolder = { issueId: "0002-target", label: "0002", path: "/repo/issues/0002-target",
 };

describe("useIssueSearchingDialogStore", () => {
  beforeEach(() => {
    useIssueSearchingDialogStore.setState({
      isOpen: false,
      title: "",
      confirmLabel: "",
      excludeFolderNames: [],
      pendingResolve: null,
    });
    usePopupStore.setState({
      popupStack: [],
      hasPopup: false,
      latestPopup: null,
    });
  });

  it("open sets title and confirm label and pushes popup", async () => {
    const p = useIssueSearchingDialogStore.getState().open({
      title: "blocking",
      confirmLabel: "Link",
      excludeFolderNames: ["0001-src"],
    });
    expect(useIssueSearchingDialogStore.getState().isOpen).toBe(true);
    expect(useIssueSearchingDialogStore.getState().title).toBe("blocking");
    expect(useIssueSearchingDialogStore.getState().confirmLabel).toBe("Link");
    expect(useIssueSearchingDialogStore.getState().excludeFolderNames).toEqual([
      "0001-src",
    ]);
    expect(usePopupStore.getState().latestPopup).toBe(
      PopupNames.IssueSearchingDialog,
    );
    useIssueSearchingDialogStore.getState().close();
    await expect(p).resolves.toEqual({
      type: IssueSearchingDialogResponseType.Cancelled,
    });
  });

  it("accept resolves with issue", async () => {
    const p = useIssueSearchingDialogStore.getState().open({
      title: "parent",
      confirmLabel: "Unlink",
    });
    useIssueSearchingDialogStore.getState().accept(sampleIssue);
    await expect(p).resolves.toEqual({
      type: IssueSearchingDialogResponseType.Accepted,
      issue: sampleIssue,
    });
    expect(useIssueSearchingDialogStore.getState().isOpen).toBe(false);
    expect(usePopupStore.getState().hasPopup).toBe(false);
  });

  it("close resolves cancelled", async () => {
    const p = useIssueSearchingDialogStore.getState().open({
      title: "related",
      confirmLabel: "Link",
    });
    useIssueSearchingDialogStore.getState().close();
    await expect(p).resolves.toEqual({
      type: IssueSearchingDialogResponseType.Cancelled,
    });
    expect(useIssueSearchingDialogStore.getState().isOpen).toBe(false);
    expect(usePopupStore.getState().latestPopup).toBeNull();
  });
});
