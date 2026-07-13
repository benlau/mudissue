import { beforeEach, describe, expect, it } from "@jest/globals";
import { useTextEditDialogStore } from "../../src/store/TextEditDialogStore.ts";
import {
  PopupNames,
  usePopupStore,
} from "../../src/store/PopupStore.ts";

const unchangedClose = {
  lastUpdatedTimestamp: null,
  lastLogicalLineIndex: 0,
};

describe("useTextEditDialogStore", () => {
  beforeEach(() => {
    usePopupStore.setState({
      popupStack: [],
      hasPopup: false,
      latestPopup: null,
    });
    useTextEditDialogStore.setState({
      isDialogOpen: false,
      openSession: 0,
      filePath: null,
      initialLineIndex: 0,
      pendingResolve: null,
    });
  });

  it("does not stack duplicate TextEdit entries when opened twice without closing", async () => {
    void useTextEditDialogStore
      .getState()
      .open({ filePath: "/repo/issues/0001/issue.md" });
    const secondOpen = await useTextEditDialogStore
      .getState()
      .open({ filePath: "/repo/issues/0002/issue.md" });
    expect(secondOpen).toEqual(unchangedClose);
    expect(usePopupStore.getState().popupStack).toEqual([
      PopupNames.TextEditDialog,
    ]);

    useTextEditDialogStore.getState().close(unchangedClose);
    expect(usePopupStore.getState().popupStack).toEqual([]);
  });

  it("closes only TextEdit dialogs that are atop the popup stack when Toast overlays", () => {
    usePopupStore.getState().pushPopup(PopupNames.Toast);
    expect(usePopupStore.getState().latestPopup).toBe(PopupNames.Toast);

    void useTextEditDialogStore.getState().open({
      filePath: "/repo/issues/0001/issue.md",
      initialLineIndex: 3,
    });
    expect(usePopupStore.getState().popupStack).toEqual([
      PopupNames.Toast,
      PopupNames.TextEditDialog,
    ]);
    expect(usePopupStore.getState().latestPopup).toBe(PopupNames.TextEditDialog);

    useTextEditDialogStore.getState().close(unchangedClose);
    expect(useTextEditDialogStore.getState().isDialogOpen).toBe(false);
    expect(usePopupStore.getState().popupStack).toEqual([PopupNames.Toast]);
    expect(usePopupStore.getState().latestPopup).toBe(PopupNames.Toast);
  });

  it("stores file path, border label, and initial line index when open is called", async () => {
    void useTextEditDialogStore.getState().open({
      filePath: "/repo/issues/0001/my-issue.md",
      initialLineIndex: 5,
    });

    expect(useTextEditDialogStore.getState().filePath).toBe(
      "/repo/issues/0001/my-issue.md",
    );
    expect(useTextEditDialogStore.getState().initialLineIndex).toBe(5);
    expect(useTextEditDialogStore.getState().isDialogOpen).toBe(true);
    expect(useTextEditDialogStore.getState().openSession).toBe(1);

    useTextEditDialogStore.getState().close(unchangedClose);
    await Promise.resolve();
  });

  it("clears file state when close is called", async () => {
    void useTextEditDialogStore.getState().open({
      filePath: "/repo/issues/0001/issue.md",
      initialLineIndex: 2,
    });
    useTextEditDialogStore.getState().close(unchangedClose);

    expect(useTextEditDialogStore.getState().filePath).toBeNull();
    expect(useTextEditDialogStore.getState().initialLineIndex).toBe(0);
    await Promise.resolve();
  });

  it("resolves open promise with lastUpdatedTimestamp and lastLogicalLineIndex on close", async () => {
    const editedAt = new Date("2026-07-06T10:00:00+08:00");
    const openPromise = useTextEditDialogStore.getState().open({
      filePath: "/repo/issues/0001/issue.md",
    });

    useTextEditDialogStore.getState().close({
      lastUpdatedTimestamp: editedAt,
      lastLogicalLineIndex: 7,
    });

    await expect(openPromise).resolves.toEqual({
      lastUpdatedTimestamp: editedAt,
      lastLogicalLineIndex: 7,
    });
  });

  it("resolves open promise with null lastUpdatedTimestamp when nothing changed", async () => {
    const openPromise = useTextEditDialogStore.getState().open({
      filePath: "/repo/issues/0001/issue.md",
    });

    useTextEditDialogStore.getState().close({
      lastUpdatedTimestamp: null,
      lastLogicalLineIndex: 3,
    });

    await expect(openPromise).resolves.toEqual({
      lastUpdatedTimestamp: null,
      lastLogicalLineIndex: 3,
    });
  });
});
