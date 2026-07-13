import { useCreateIssueFromFileDialogStore } from "../../src/store/CreateIssueFromFileDialogStore.ts";
import { PopupNames, usePopupStore } from "../../src/store/PopupStore.ts";

describe("useCreateIssueFromFileDialogStore", () => {
  beforeEach(() => {
    useCreateIssueFromFileDialogStore.setState({
      isDialogOpen: false,
      pendingResolve: null,
    });
    usePopupStore.setState({
      popupStack: [],
      hasPopup: false,
      latestPopup: null,
    });
  });

  it("open sets isDialogOpen and confirm resolves accepted", async () => {
    const p = useCreateIssueFromFileDialogStore.getState().open();
    expect(useCreateIssueFromFileDialogStore.getState().isDialogOpen).toBe(
      true,
    );
    expect(usePopupStore.getState().latestPopup).toBe(
      PopupNames.CreateIssueFromFileDialog,
    );
    useCreateIssueFromFileDialogStore.getState().confirm();
    await expect(p).resolves.toEqual({ type: "accepted" });
    expect(useCreateIssueFromFileDialogStore.getState().isDialogOpen).toBe(
      false,
    );
    expect(usePopupStore.getState().hasPopup).toBe(false);
  });

  it("close resolves cancelled", async () => {
    const p = useCreateIssueFromFileDialogStore.getState().open();
    useCreateIssueFromFileDialogStore.getState().close();
    await expect(p).resolves.toEqual({ type: "cancelled" });
    expect(useCreateIssueFromFileDialogStore.getState().isDialogOpen).toBe(
      false,
    );
    expect(usePopupStore.getState().latestPopup).toBeNull();
  });
});
