import { beforeEach, describe, expect, it } from "@jest/globals";
import { PopupNames, usePopupStore } from "../../src/store/PopupStore.ts";
import { usePaletteCommandStore } from "../../src/store/PaletteCommandStore.ts";

describe("usePaletteCommandStore", () => {
  beforeEach(() => {
    usePaletteCommandStore.setState({
      isOpen: false,
      commands: [],
      toolbarItems: [],
      initialFilterQuery: ":",
      lastUsedCommandKey: null,
    });
    usePopupStore.setState({
      popupStack: [],
      hasPopup: false,
      latestPopup: null,
    });
  });

  it("open pushes popup and close clears stack", () => {
    usePaletteCommandStore.getState().open({
      commands: [{ label: "A", key: "a", callback: async () => {} }],
    });
    expect(usePaletteCommandStore.getState().isOpen).toBe(true);
    expect(usePopupStore.getState().latestPopup).toBe(
      PopupNames.PaletteCommand,
    );

    usePaletteCommandStore.getState().close();
    expect(usePaletteCommandStore.getState().isOpen).toBe(false);
    expect(usePopupStore.getState().hasPopup).toBe(false);
    expect(usePopupStore.getState().latestPopup).toBeNull();
  });

  it("open moves last used command key to top", () => {
    usePaletteCommandStore.setState({ lastUsedCommandKey: "b" });
    usePaletteCommandStore.getState().open({
      commands: [
        { label: "A", key: "a", callback: async () => {} },
        { label: "B", key: "b", callback: async () => {} },
      ],
    });
    expect(usePaletteCommandStore.getState().commands.map((c) => c.key)).toEqual(
      ["b", "a"],
    );
    usePaletteCommandStore.getState().close();
  });

  it("replaceCommands updates the open palette list without closing", () => {
    usePaletteCommandStore.getState().open({
      commands: [
        { label: "Old", key: "custom-script-1", callback: async () => {} },
      ],
    });
    usePaletteCommandStore.getState().replaceCommands([
      { label: "New", key: "custom-script-1", callback: async () => {} },
      { label: "Added", key: "custom-script-2", callback: async () => {} },
    ]);
    expect(usePaletteCommandStore.getState().isOpen).toBe(true);
    expect(usePaletteCommandStore.getState().commands.map((c) => c.label)).toEqual(
      ["New", "Added"],
    );
  });

  it("replaceCommands is a no-op when the palette is closed", () => {
    usePaletteCommandStore.getState().replaceCommands([
      { label: "New", key: "custom-script-1", callback: async () => {} },
    ]);
    expect(usePaletteCommandStore.getState().commands).toEqual([]);
  });

  it("open stores toolbar items and initial filter query", () => {
    usePaletteCommandStore.getState().open({
      commands: [{ label: "A", key: "a", callback: async () => {} }],
      toolbarItems: [{ label: "Search", key: "/", callback: () => {} }],
      initialFilterQuery: "?",
    });
    expect(usePaletteCommandStore.getState().toolbarItems).toHaveLength(1);
    expect(usePaletteCommandStore.getState().initialFilterQuery).toBe("?");
    usePaletteCommandStore.getState().close();
    expect(usePaletteCommandStore.getState().toolbarItems).toEqual([]);
    expect(usePaletteCommandStore.getState().initialFilterQuery).toBe(":");
  });
});
