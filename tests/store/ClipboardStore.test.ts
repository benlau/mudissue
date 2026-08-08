import { useClipboardStore } from "../../src/store/ClipboardStore.ts";

describe("useClipboardStore", () => {
  beforeEach(() => {
    useClipboardStore.setState({ content: "" });
  });

  it("starts with empty content", () => {
    expect(useClipboardStore.getState().content).toBe("");
  });

  it("writes content into the store", () => {
    useClipboardStore.getState().write("hello\nworld");

    expect(useClipboardStore.getState().content).toBe("hello\nworld");
  });

  it("replaces previous content on write", () => {
    useClipboardStore.getState().write("first");
    useClipboardStore.getState().write("second");

    expect(useClipboardStore.getState().content).toBe("second");
  });

  it("clears content", () => {
    useClipboardStore.getState().write("to clear");
    useClipboardStore.getState().clear();

    expect(useClipboardStore.getState().content).toBe("");
  });
});
