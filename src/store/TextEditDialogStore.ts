import { create } from "zustand";
import { PopupNames, usePopupStore } from "./PopupStore.ts";

export type TextEditDialogOpenOptions = {
  filePath: string;
  initialLineIndex?: number;
};

export type TextEditDialogCloseResult = {
  lastUpdatedTimestamp: Date | null;
  lastLogicalLineIndex: number;
};

type TextEditDialogStoreState = {
  isDialogOpen: boolean;
  /** Bumps whenever the dialog opens; remount dependents (e.g. TextInput). */
  openSession: number;
  filePath: string | null;
  initialLineIndex: number;
  pendingResolve: ((result: TextEditDialogCloseResult) => void) | null;
  open: (
    options: TextEditDialogOpenOptions,
  ) => Promise<TextEditDialogCloseResult>;
  close: (result: TextEditDialogCloseResult) => void;
};

export const useTextEditDialogStore = create<TextEditDialogStoreState>(
  (set, get) => ({
    isDialogOpen: false,
    openSession: 0,
    filePath: null,
    initialLineIndex: 0,
    pendingResolve: null,

    open: (options) => {
      if (get().isDialogOpen) {
        return Promise.resolve({
          lastUpdatedTimestamp: null,
          lastLogicalLineIndex: 0,
        });
      }
      usePopupStore.getState().pushPopup(PopupNames.TextEditDialog);
      return new Promise<TextEditDialogCloseResult>((resolve) => {
        set((state) => ({
          isDialogOpen: true,
          openSession: state.openSession + 1,
          filePath: options.filePath,
          initialLineIndex: options.initialLineIndex ?? 0,
          pendingResolve: resolve,
        }));
      });
    },

    close: (result) => {
      if (!get().isDialogOpen) return;
      const { pendingResolve } = get();
      set({
        isDialogOpen: false,
        openSession: get().openSession,
        filePath: null,
        initialLineIndex: 0,
        pendingResolve: null,
      });

      while (
        usePopupStore.getState().latestPopup === PopupNames.TextEditDialog
      ) {
        usePopupStore.getState().popPopup();
      }

      pendingResolve?.(result);
    },
  }),
);
