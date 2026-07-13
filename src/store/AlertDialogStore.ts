import { create } from "zustand";
import { PopupNames, usePopupStore } from "./PopupStore.ts";

type AlertDialogStoreState = {
  isDialogOpen: boolean;
  message: string;
  pendingResolve: (() => void) | null;
  open: (message: string) => Promise<void>;
  close: () => void;
};

export const useAlertDialogStore = create<AlertDialogStoreState>(
  (set, get) => ({
    isDialogOpen: false,
    message: "",
    pendingResolve: null,

    open: (message: string) => {
      return new Promise<void>((resolve) => {
        usePopupStore.getState().pushPopup(PopupNames.AlertDialog);
        set({
          isDialogOpen: true,
          message,
          pendingResolve: resolve,
        });
      });
    },

    close: () => {
      const { isDialogOpen, pendingResolve } = get();
      if (isDialogOpen) {
        usePopupStore.getState().popPopup();
      }
      set({
        isDialogOpen: false,
        message: "",
        pendingResolve: null,
      });
      pendingResolve?.();
    },
  }),
);
