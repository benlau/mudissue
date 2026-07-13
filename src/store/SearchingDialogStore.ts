import { createStore } from "zustand/vanilla";
import type { StoreApi } from "zustand/vanilla";
import { PopupNames, usePopupStore } from "./PopupStore.ts";

export type SearchingDialogResponseType = "Accepted" | "Cancelled";

export interface SearchingDialogResponse {
  type: SearchingDialogResponseType;
  value?: string;
}

export type SearchingDialogOpenOptions = {
  initialValue: string;
  /** Snapshot from registry; caller loads via reload before open(). */
  recentFilters: string[];
};

type PendingResolve = (response: SearchingDialogResponse) => void;

export type SearchingDialogStoreState = {
  isDialogOpen: boolean;
  value: string;
  dialogRecentFilters: string[];
  dialogInputKey: number;
  dialogInputInitialValue: string | undefined;
  pendingResolve: PendingResolve | null;
  setValue: (v: string) => void;
  open: (
    options: SearchingDialogOpenOptions,
  ) => Promise<SearchingDialogResponse>;
  close: () => void;
  confirm: () => void;
};

export type SearchingDialogStore = StoreApi<SearchingDialogStoreState>;

export function createSearchingDialogStore(): SearchingDialogStore {
  const initial = (): Pick<
    SearchingDialogStoreState,
    | "isDialogOpen"
    | "value"
    | "dialogRecentFilters"
    | "dialogInputKey"
    | "dialogInputInitialValue"
    | "pendingResolve"
  > => ({
    isDialogOpen: false,
    value: "",
    dialogRecentFilters: [],
    dialogInputKey: 0,
    dialogInputInitialValue: undefined,
    pendingResolve: null,
  });

  return createStore<SearchingDialogStoreState>((set, get) => ({
    ...initial(),

    setValue: (v) => set({ value: v }),

    open: (options) => {
      const list = options.recentFilters;
      const searchActive = options.initialValue.trim() !== "";
      let initialText: string;
      let initialValueForInput: string | undefined;
      if (list.length === 0) {
        if (searchActive) {
          initialText = options.initialValue;
          initialValueForInput = options.initialValue;
        } else {
          initialText = "";
          initialValueForInput = undefined;
        }
      } else if (searchActive) {
        initialText = list[0] ?? "";
        initialValueForInput = undefined;
      } else {
        initialText = "";
        initialValueForInput = "";
      }
      usePopupStore.getState().pushPopup(PopupNames.SearchingDialog);
      set({
        isDialogOpen: true,
        dialogRecentFilters: [...list],
        dialogInputInitialValue: initialValueForInput,
        dialogInputKey: get().dialogInputKey + 1,
        value: initialText,
        pendingResolve: null,
      });
      return new Promise<SearchingDialogResponse>((resolve) => {
        set({ pendingResolve: resolve });
      });
    },

    close: () => {
      const { isDialogOpen, pendingResolve } = get();
      if (isDialogOpen) {
        usePopupStore.getState().popPopup();
      }
      set(initial());
      pendingResolve?.({ type: "Cancelled" });
    },

    confirm: () => {
      const { isDialogOpen, value, pendingResolve } = get();
      const trimmed = value.trim();
      if (isDialogOpen) {
        usePopupStore.getState().popPopup();
      }
      set(initial());
      pendingResolve?.({
        type: "Accepted",
        value: trimmed === "" ? undefined : trimmed,
      });
    },
  }));
}
