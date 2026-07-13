import { beforeEach, describe, expect, it } from "@jest/globals";
import { useCreateIssueDialogStore } from "../../src/store/CreateIssueDialogStore.ts";
import {
  PopupNames,
  usePopupStore,
} from "../../src/store/PopupStore.ts";

describe("useCreateIssueDialogStore", () => {
  beforeEach(() => {
    usePopupStore.setState({
      popupStack: [],
      hasPopup: false,
      latestPopup: null,
    });
    useCreateIssueDialogStore.setState({
      isDialogOpen: false,
      openSession: 0,
      parentIssue: null,
    });
  });

  it("does not stack duplicate CreateIssue entries when opened twice without closing", () => {
    useCreateIssueDialogStore.getState().open();
    useCreateIssueDialogStore.getState().open();
    expect(usePopupStore.getState().popupStack).toEqual([
      PopupNames.CreateIssueDialog,
    ]);

    useCreateIssueDialogStore.getState().close();
    expect(usePopupStore.getState().popupStack).toEqual([]);
  });

  it("closes only CreateIssue dialogs that are atop the popup stack when Toast overlays", () => {
    usePopupStore.getState().pushPopup(PopupNames.Toast);
    expect(usePopupStore.getState().latestPopup).toBe(PopupNames.Toast);

    useCreateIssueDialogStore.getState().open();
    expect(usePopupStore.getState().popupStack).toEqual([
      PopupNames.Toast,
      PopupNames.CreateIssueDialog,
    ]);
    expect(usePopupStore.getState().latestPopup).toBe(
      PopupNames.CreateIssueDialog,
    );

    useCreateIssueDialogStore.getState().close();
    expect(useCreateIssueDialogStore.getState().isDialogOpen).toBe(false);

    expect(usePopupStore.getState().popupStack).toEqual([PopupNames.Toast]);
    expect(usePopupStore.getState().latestPopup).toBe(PopupNames.Toast);
  });

  it("pops all consecutive duplicate CreateIssue dialog entries off the top when closing", () => {
    usePopupStore.getState().pushPopup(PopupNames.CreateIssueDialog);
    usePopupStore.getState().pushPopup(PopupNames.CreateIssueDialog);

    useCreateIssueDialogStore.setState({ isDialogOpen: true, openSession: 1 });

    useCreateIssueDialogStore.getState().close();
    expect(usePopupStore.getState().popupStack).toEqual([]);
    expect(useCreateIssueDialogStore.getState().openSession).toBe(1);
  });

  it("stores parent issue when open is called with a parent", () => {
    const parentIssue = {
      issueId: "0001",
      folderName: "0001-parent",
      path: "/repo/issues/0001-parent",
    };

    useCreateIssueDialogStore.getState().open(parentIssue);

    expect(useCreateIssueDialogStore.getState().parentIssue).toEqual(
      parentIssue,
    );
    expect(useCreateIssueDialogStore.getState().isDialogOpen).toBe(true);
  });

  it("clears parent issue when close is called", () => {
    const parentIssue = {
      issueId: "0001",
      folderName: "0001-parent",
      path: "/repo/issues/0001-parent",
    };

    useCreateIssueDialogStore.getState().open(parentIssue);
    useCreateIssueDialogStore.getState().close();

    expect(useCreateIssueDialogStore.getState().parentIssue).toBeNull();
  });
});
