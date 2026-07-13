import { useAlertDialogStore } from "../../src/store/AlertDialogStore.ts";
import { PopupNames, usePopupStore } from "../../src/store/PopupStore.ts";

describe("useAlertDialogStore", () => {
  beforeEach(() => {
    useAlertDialogStore.setState({
      isDialogOpen: false,
      message: "",
      pendingResolve: null,
    });
    usePopupStore.setState({
      popupStack: [],
      hasPopup: false,
      latestPopup: null,
    });
  });

  it("open registers popup and close resolves", async () => {
    const p = useAlertDialogStore.getState().open("No recent projects");

    expect(useAlertDialogStore.getState().isDialogOpen).toBe(true);
    expect(useAlertDialogStore.getState().message).toBe("No recent projects");
    expect(usePopupStore.getState().latestPopup).toBe(PopupNames.AlertDialog);

    useAlertDialogStore.getState().close();

    await expect(p).resolves.toBeUndefined();
    expect(useAlertDialogStore.getState().isDialogOpen).toBe(false);
    expect(usePopupStore.getState().hasPopup).toBe(false);
  });
});
