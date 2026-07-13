import { describe, expect, it } from "@jest/globals";
import { createFilterTextDialogStore } from "../../../src/views/components/FilterTextDialog.tsx";

describe("FilterTextDialog store setChoiceList", () => {
  const onFilterQueryChanged = () => {};

  it("keeps selection and scroll when choice keys are unchanged", () => {
    const store = createFilterTextDialogStore();
    store.getState().open({ onFilterQueryChanged });
    store.getState().setChoiceList([
      { key: "alpha", text: "Alpha v1" },
      { key: "beta", text: "Beta v1" },
      { key: "gamma", text: "Gamma v1" },
    ]);
    store.getState().moveSelection(2);
    store.getState().setListScrollOffset(5);

    store.getState().setChoiceList([
      { key: "alpha", text: "Alpha v2" },
      { key: "beta", text: "Beta v2" },
      { key: "gamma", text: "Gamma v2" },
    ]);

    expect(store.getState()).toMatchObject({
      selectedKey: "gamma",
      listScrollOffset: 5,
    });
  });

  it("resets selection and scroll when choice keys change", () => {
    const store = createFilterTextDialogStore();
    store.getState().open({ onFilterQueryChanged });
    store.getState().setChoiceList([
      { key: "alpha", text: "Alpha" },
      { key: "beta", text: "Beta" },
      { key: "gamma", text: "Gamma" },
    ]);
    store.getState().moveSelection(2);
    store.getState().setListScrollOffset(5);

    store.getState().setChoiceList([
      { key: "delta", text: "Delta" },
      { key: "epsilon", text: "Epsilon" },
    ]);

    expect(store.getState()).toMatchObject({
      selectedKey: "delta",
      listScrollOffset: 0,
    });
  });

  it("resets selection and scroll when choices become empty", () => {
    const store = createFilterTextDialogStore();
    store.getState().open({ onFilterQueryChanged });
    store.getState().setChoiceList([{ key: "alpha", text: "Alpha" }]);
    store.getState().setListScrollOffset(3);

    store.getState().setChoiceList([]);

    expect(store.getState()).toMatchObject({
      selectedKey: null,
      listScrollOffset: 0,
    });
  });

  it("distinguishes adjacent keys that would collide without a separator", () => {
    const store = createFilterTextDialogStore();
    store.getState().open({ onFilterQueryChanged });
    store.getState().setChoiceList([
      { key: "a", text: "A" },
      { key: "bc", text: "BC" },
    ]);
    store.getState().moveSelection(1);

    store.getState().setChoiceList([
      { key: "ab", text: "AB" },
      { key: "c", text: "C" },
    ]);

    expect(store.getState()).toMatchObject({
      selectedKey: "ab",
      listScrollOffset: 0,
    });
  });
});
