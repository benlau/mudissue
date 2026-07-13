import { PopupNames, usePopupStore } from "../../src/store/PopupStore.ts";
import { useToastStore } from "../../src/store/ToastStore.ts";

function resetToastStore(): void {
  useToastStore.setState({
    isToastOpen: false,
    message: "",
    variant: "info",
    duration: 3000,
    position: "top-right",
    persistent: false,
    toastKey: 0,
    pendingResolve: null,
  });
}

describe("useToastStore", () => {
  beforeEach(() => {
    resetToastStore();
    usePopupStore.setState({
      popupStack: [],
      hasPopup: false,
      latestPopup: null,
    });
  });

  it("shows an info toast with default options", async () => {
    const toastClosed = useToastStore.getState().info("Saved");

    expect(useToastStore.getState()).toMatchObject({
      isToastOpen: true,
      message: "Saved",
      variant: "info",
      duration: 3000,
      position: "top-right",
      toastKey: 1,
    });
    expect(usePopupStore.getState()).toMatchObject({
      popupStack: [PopupNames.Toast],
      hasPopup: true,
      latestPopup: PopupNames.Toast,
    });

    useToastStore.getState().close();
    await expect(toastClosed).resolves.toBeUndefined();
  });

  it("shows an error toast with custom options", async () => {
    const toastClosed = useToastStore.getState().error("Failed", {
      duration: 1200,
      position: "bottom-left",
    });

    expect(useToastStore.getState()).toMatchObject({
      isToastOpen: true,
      message: "Failed",
      variant: "error",
      duration: 1200,
      position: "bottom-left",
      toastKey: 1,
    });

    useToastStore.getState().close();
    await expect(toastClosed).resolves.toBeUndefined();
  });

  it("replaces an open toast without pushing a duplicate popup", async () => {
    const firstToastClosed = useToastStore.getState().info("First");
    const secondToastClosed = useToastStore.getState().error("Second", {
      duration: 250,
      position: "top-middle",
    });

    expect(useToastStore.getState()).toMatchObject({
      isToastOpen: true,
      message: "Second",
      variant: "error",
      duration: 250,
      position: "top-middle",
      toastKey: 2,
    });
    expect(usePopupStore.getState().popupStack).toEqual([PopupNames.Toast]);

    await expect(firstToastClosed).resolves.toBeUndefined();
    useToastStore.getState().close();
    await expect(secondToastClosed).resolves.toBeUndefined();
  });

  it("shows a persistent error toast with custom options", async () => {
    const toastClosed = useToastStore.getState().error("Clipboard failed", {
      position: "center",
      persistent: true,
    });

    expect(useToastStore.getState()).toMatchObject({
      isToastOpen: true,
      message: "Clipboard failed",
      variant: "error",
      position: "center",
      persistent: true,
      toastKey: 1,
    });

    useToastStore.getState().close();
    await expect(toastClosed).resolves.toBeUndefined();
  });

  it("closes and pops the toast popup", async () => {
    const toastClosed = useToastStore.getState().info("Saved");

    useToastStore.getState().close();

    expect(useToastStore.getState()).toMatchObject({
      isToastOpen: false,
      message: "",
      variant: "info",
      duration: 3000,
      position: "top-right",
    });
    expect(usePopupStore.getState()).toMatchObject({
      popupStack: [],
      hasPopup: false,
      latestPopup: null,
    });
    await expect(toastClosed).resolves.toBeUndefined();
  });
});
