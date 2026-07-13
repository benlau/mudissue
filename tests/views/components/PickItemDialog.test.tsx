import { afterEach, beforeEach, describe, expect, it } from "@jest/globals";
import { cleanup } from "ink-testing-library";
import {
  getPositionLabel,
  PickItemDialogResponseType,
  usePickItemDialogStore,
} from "../../../src/views/components/PickItemDialog.tsx";
import { PopupNames, usePopupStore } from "../../../src/store/PopupStore.ts";

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

describe("getPositionLabel", () => {
  it("shows 1-based index over item count", () => {
    expect(getPositionLabel(0, 2)).toBe("1/2");
    expect(getPositionLabel(1, 2)).toBe("2/2");
  });

  it("returns empty when selection is the Cancel row", () => {
    expect(getPositionLabel(2, 2)).toBe("");
  });

  it("returns 0/0 when there are no items", () => {
    expect(getPositionLabel(0, 0)).toBe("0/0");
  });

  it("returns empty when index is past item range", () => {
    expect(getPositionLabel(2, 1)).toBe("");
  });
});

describe("PickItemDialog keyboard actions", () => {
  beforeEach(() => {
    resetPickItemDialogStore();
    usePopupStore.setState({
      popupStack: [],
      hasPopup: false,
      latestPopup: null,
    });
  });

  afterEach(() => {
    cleanup();
    resetPickItemDialogStore();
    usePopupStore.setState({
      popupStack: [],
      hasPopup: false,
      latestPopup: null,
    });
  });

  it("confirms selected item", async () => {
    const openPromise = usePickItemDialogStore
      .getState()
      .open(["alpha", "beta"], (item) => item);
    expect(usePopupStore.getState().latestPopup).toBe(
      PopupNames.PickItemDialog,
    );
    usePickItemDialogStore.getState().confirm(0);

    await expect(openPromise).resolves.toEqual({
      type: PickItemDialogResponseType.Accepted,
      acceptedValue: "alpha",
    });
    expect(usePopupStore.getState().hasPopup).toBe(false);
  });

  it("confirms item at index", async () => {
    const openPromise = usePickItemDialogStore
      .getState()
      .open(["alpha", "beta"], (item) => item);
    usePickItemDialogStore.getState().confirm(1);

    await expect(openPromise).resolves.toEqual({
      type: PickItemDialogResponseType.Accepted,
      acceptedValue: "beta",
    });
  });

  it("cancels dialog", async () => {
    const openPromise = usePickItemDialogStore
      .getState()
      .open(["alpha", "beta"], (item) => item);
    usePickItemDialogStore.getState().close();

    await expect(openPromise).resolves.toEqual({
      type: PickItemDialogResponseType.Cancelled,
    });
  });

  it("cancels when confirming Cancel row index", async () => {
    const openPromise = usePickItemDialogStore
      .getState()
      .open(["alpha", "beta"], (item) => item);
    usePickItemDialogStore.getState().confirm(2);

    await expect(openPromise).resolves.toEqual({
      type: PickItemDialogResponseType.Cancelled,
    });
  });

  it("keeps all items when opening more than the old visible cap", async () => {
    const many = Array.from({ length: 25 }, (_, i) => `item-${i}`);
    const openPromise = usePickItemDialogStore
      .getState()
      .open(many, (item) => item);

    expect(usePickItemDialogStore.getState().items).toEqual(many);

    usePickItemDialogStore.getState().confirm(24);
    await expect(openPromise).resolves.toEqual({
      type: PickItemDialogResponseType.Accepted,
      acceptedValue: "item-24",
    });
  });

  it("stores clamped initialSelectedIndex when opening", async () => {
    const openPromise = usePickItemDialogStore
      .getState()
      .open(["alpha", "beta", "gamma"], (item) => item, {
        initialSelectedIndex: 5,
      });

    expect(usePickItemDialogStore.getState().initialSelectedIndex).toBe(2);

    usePickItemDialogStore.getState().close();
    await expect(openPromise).resolves.toEqual({
      type: PickItemDialogResponseType.Cancelled,
    });
  });

  it("lays out all items with Cancel footer", async () => {
    const many = Array.from({ length: 3 }, (_, i) => `item-${i}`);
    const openPromise = usePickItemDialogStore
      .getState()
      .open(many, (item) => item);

    usePickItemDialogStore.getState().layout(20);

    expect(usePickItemDialogStore.getState().displayRows).toEqual([
      "item-0            ",
      "item-1            ",
      "item-2            ",
      "Cancel<Esc>       ",
    ]);

    usePickItemDialogStore.getState().close();
    await expect(openPromise).resolves.toEqual({
      type: PickItemDialogResponseType.Cancelled,
    });
  });

  it("lays out visible items with table columns", async () => {
    const openPromise = usePickItemDialogStore.getState().open(
      [{ name: "long-name", path: "/very/long/path" }],
      (item) => [item.name, item.path],
      {
        columns: [
          { minWidth: 4, grow: 1, ellipsisDirection: "right" },
          { minWidth: 5, grow: 1, ellipsisDirection: "left" },
        ],
      },
    );

    usePickItemDialogStore.getState().layout(18);

    expect(usePickItemDialogStore.getState().geom).toEqual({
      dialogWidth: 18,
      contentWidth: 16,
      columnWidths: [7, 8],
      tableWidth: 16,
    });
    expect(usePickItemDialogStore.getState().displayRows).toEqual([
      "long-n… …ng/path",
      "Cancel<Esc>     ",
    ]);

    usePickItemDialogStore.getState().close();
    await expect(openPromise).resolves.toEqual({
      type: PickItemDialogResponseType.Cancelled,
    });
  });
});
