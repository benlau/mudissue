import { useTextInputDialogStore } from "../../src/store/TextInputDialogStore.ts";
import { PopupNames, usePopupStore } from "../../src/store/PopupStore.ts";

function resetStores(): void {
  useTextInputDialogStore.setState({
    isDialogOpen: false,
    title: "",
    prompt: "",
    placeholder: "",
    confirmLabel: undefined,
    value: "",
    error: null,
    inputKey: 0,
    validate: null,
    pendingResolve: null,
    activeOpenPromise: null,
  });
  usePopupStore.setState({
    popupStack: [],
    hasPopup: false,
    latestPopup: null,
  });
}

describe("useTextInputDialogStore", () => {
  beforeEach(() => {
    resetStores();
  });

  afterEach(() => {
    resetStores();
  });

  it("open sets copy and confirm resolves accepted with trimmed value", async () => {
    const p = useTextInputDialogStore.getState().open({
      title: "Change Issue ID",
      prompt: "New ID: ",
      placeholder: "e.g. MI042",
      initialValue: "  MI001  ",
    });
    expect(useTextInputDialogStore.getState().isDialogOpen).toBe(true);
    expect(useTextInputDialogStore.getState().title).toBe("Change Issue ID");
    expect(useTextInputDialogStore.getState().prompt).toBe("New ID: ");
    expect(useTextInputDialogStore.getState().placeholder).toBe("e.g. MI042");
    expect(useTextInputDialogStore.getState().value).toBe("  MI001  ");
    expect(usePopupStore.getState().latestPopup).toBe(
      PopupNames.TextInputDialog,
    );

    useTextInputDialogStore.getState().confirm();
    await expect(p).resolves.toEqual({ type: "accepted", value: "MI001" });
    expect(useTextInputDialogStore.getState().isDialogOpen).toBe(false);
    expect(useTextInputDialogStore.getState().pendingResolve).toBeNull();
    expect(usePopupStore.getState().hasPopup).toBe(false);
  });

  it("close resolves cancelled", async () => {
    const p = useTextInputDialogStore.getState().open({
      title: "T",
      prompt: "P: ",
    });
    useTextInputDialogStore.getState().close();
    await expect(p).resolves.toEqual({ type: "cancelled" });
    expect(useTextInputDialogStore.getState().isDialogOpen).toBe(false);
    expect(usePopupStore.getState().latestPopup).toBeNull();
  });

  it("confirm with failing validate sets error and keeps dialog open", async () => {
    const p = useTextInputDialogStore.getState().open({
      title: "T",
      prompt: "P: ",
      initialValue: "bad id",
      validate: (value) => (value.includes(" ") ? "Invalid format" : null),
    });

    useTextInputDialogStore.getState().confirm();

    expect(useTextInputDialogStore.getState().isDialogOpen).toBe(true);
    expect(useTextInputDialogStore.getState().error).toBe("Invalid format");
    expect(usePopupStore.getState().latestPopup).toBe(
      PopupNames.TextInputDialog,
    );

    useTextInputDialogStore.getState().setValue("MI042");
    expect(useTextInputDialogStore.getState().error).toBeNull();
    useTextInputDialogStore.getState().confirm();
    await expect(p).resolves.toEqual({ type: "accepted", value: "MI042" });
  });

  it("concurrent open shares one popup and both promises resolve on close", async () => {
    const firstOpen = useTextInputDialogStore.getState().open({
      title: "First",
      prompt: "A: ",
    });
    const secondOpen = useTextInputDialogStore.getState().open({
      title: "Second",
      prompt: "B: ",
    });

    expect(secondOpen).toBe(firstOpen);
    expect(usePopupStore.getState().popupStack).toHaveLength(1);

    useTextInputDialogStore.getState().close();

    await expect(firstOpen).resolves.toEqual({ type: "cancelled" });
    await expect(secondOpen).resolves.toEqual({ type: "cancelled" });
    expect(usePopupStore.getState().hasPopup).toBe(false);
    expect(useTextInputDialogStore.getState().activeOpenPromise).toBeNull();
  });
});
