import { PopupNames, usePopupStore } from "../../src/store/PopupStore.ts";

describe("usePopupStore", () => {
  beforeEach(() => {
    usePopupStore.setState({
      popupStack: [],
      hasPopup: false,
      latestPopup: null,
    });
  });

  it("starts without an active popup", () => {
    expect(usePopupStore.getState()).toMatchObject({
      popupStack: [],
      hasPopup: false,
      latestPopup: null,
    });
  });

  it("pushes a popup and exposes it as the latest popup", () => {
    usePopupStore.getState().pushPopup(PopupNames.AlertDialog);

    expect(usePopupStore.getState()).toMatchObject({
      popupStack: [PopupNames.AlertDialog],
      hasPopup: true,
      latestPopup: PopupNames.AlertDialog,
    });
  });

  it("tracks nested popups as a stack", () => {
    usePopupStore.getState().pushPopup(PopupNames.AlertDialog);
    usePopupStore.getState().pushPopup(PopupNames.PickItemDialog);

    expect(usePopupStore.getState()).toMatchObject({
      popupStack: [PopupNames.AlertDialog, PopupNames.PickItemDialog],
      hasPopup: true,
      latestPopup: PopupNames.PickItemDialog,
    });

    usePopupStore.getState().popPopup();

    expect(usePopupStore.getState()).toMatchObject({
      popupStack: [PopupNames.AlertDialog],
      hasPopup: true,
      latestPopup: PopupNames.AlertDialog,
    });
  });

  it("clears popup state when popping the last popup", () => {
    usePopupStore.getState().pushPopup(PopupNames.ConfirmationDialog);
    usePopupStore.getState().popPopup();

    expect(usePopupStore.getState()).toMatchObject({
      popupStack: [],
      hasPopup: false,
      latestPopup: null,
    });
  });
});
