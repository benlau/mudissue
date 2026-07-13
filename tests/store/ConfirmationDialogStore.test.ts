import { useConfirmationDialogStore } from "../../src/store/ConfirmationDialogStore.ts";
import { PopupNames, usePopupStore } from "../../src/store/PopupStore.ts";

describe("useConfirmationDialogStore", () => {
  beforeEach(() => {
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
    usePopupStore.setState({
      popupStack: [],
      hasPopup: false,
      latestPopup: null,
    });
  });

  it("open sets copy and confirm resolves accepted", async () => {
    const p = useConfirmationDialogStore.getState().open({
      title: "Quit MudIssue?",
      message: "Press Enter to quit now.",
      confirmLabel: "Quit",
    });
    expect(useConfirmationDialogStore.getState().isDialogOpen).toBe(true);
    expect(useConfirmationDialogStore.getState().title).toBe("Quit MudIssue?");
    expect(useConfirmationDialogStore.getState().message).toBe(
      "Press Enter to quit now.",
    );
    expect(useConfirmationDialogStore.getState().confirmLabel).toBe("Quit");
    expect(usePopupStore.getState().latestPopup).toBe(
      PopupNames.ConfirmationDialog,
    );
    useConfirmationDialogStore.getState().confirm();
    await expect(p).resolves.toEqual({ type: "accepted" });
    expect(useConfirmationDialogStore.getState().isDialogOpen).toBe(false);
    expect(useConfirmationDialogStore.getState().pendingResolve).toBeNull();
    expect(usePopupStore.getState().hasPopup).toBe(false);
  });

  it("close resolves cancelled", async () => {
    const p = useConfirmationDialogStore.getState().open({
      title: "T",
      message: "M",
    });
    useConfirmationDialogStore.getState().close();
    await expect(p).resolves.toEqual({ type: "cancelled" });
    expect(useConfirmationDialogStore.getState().isDialogOpen).toBe(false);
    expect(usePopupStore.getState().latestPopup).toBeNull();
  });

  it("open keeps confirm label undefined when omitted", async () => {
    useConfirmationDialogStore.getState().open({
      title: "T",
      message: "M",
    });
    expect(useConfirmationDialogStore.getState().confirmLabel).toBeUndefined();
  });

  it("open stores destructive variant when provided", async () => {
    useConfirmationDialogStore.getState().open({
      title: "Remove issue?",
      message: "Cannot undo.",
      confirmLabel: "Remove",
      variant: "destructive",
    });
    expect(useConfirmationDialogStore.getState().variant).toBe("destructive");
  });

  it("open defaults variant to default when omitted", async () => {
    useConfirmationDialogStore.getState().open({
      title: "T",
      message: "M",
    });
    expect(useConfirmationDialogStore.getState().variant).toBe("default");
  });

  it("open stores ctrlCToConfirm when provided and clears on close", async () => {
    const p = useConfirmationDialogStore.getState().open({
      title: "Quit MudIssue?",
      message: "M",
      ctrlCToConfirm: true,
    });
    expect(useConfirmationDialogStore.getState().ctrlCToConfirm).toBe(true);
    useConfirmationDialogStore.getState().close();
    await expect(p).resolves.toEqual({ type: "cancelled" });
    expect(useConfirmationDialogStore.getState().ctrlCToConfirm).toBe(false);
  });

  it("open defaults ctrlCToConfirm to false when omitted", async () => {
    useConfirmationDialogStore.getState().open({
      title: "T",
      message: "M",
    });
    expect(useConfirmationDialogStore.getState().ctrlCToConfirm).toBe(false);
  });

  it("concurrent open shares one popup and both promises resolve on close", async () => {
    const firstOpen = useConfirmationDialogStore.getState().open({
      title: "Quit MudIssue?",
      message: "M",
    });
    const secondOpen = useConfirmationDialogStore.getState().open({
      title: "Other title",
      message: "Other message",
    });

    expect(secondOpen).toBe(firstOpen);
    expect(usePopupStore.getState().popupStack).toHaveLength(1);

    useConfirmationDialogStore.getState().close();

    await expect(firstOpen).resolves.toEqual({ type: "cancelled" });
    await expect(secondOpen).resolves.toEqual({ type: "cancelled" });
    expect(usePopupStore.getState().hasPopup).toBe(false);
    expect(useConfirmationDialogStore.getState().activeOpenPromise).toBeNull();
  });
});
