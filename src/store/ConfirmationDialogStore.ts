import { create } from "zustand";
import { PopupNames, usePopupStore } from "./PopupStore.ts";

export type ConfirmationDialogResult =
  | { type: "accepted" }
  | { type: "cancelled" };

export type ConfirmationDialogVariant = "default" | "destructive";

export type ConfirmationDialogOpenOptions = {
  title: string;
  message: string;
  /** Optional toolbar label. When omitted, UI uses localized default. */
  confirmLabel?: string;
  variant?: ConfirmationDialogVariant;
  /** When true, Ctrl+C confirms the dialog. */
  ctrlCToConfirm?: boolean;
};

type ConfirmationDialogStoreState = {
  isDialogOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  variant: ConfirmationDialogVariant;
  ctrlCToConfirm: boolean;
  pendingResolve: ((result: ConfirmationDialogResult) => void) | null;
  activeOpenPromise: Promise<ConfirmationDialogResult> | null;
  open: (
    options: ConfirmationDialogOpenOptions,
  ) => Promise<ConfirmationDialogResult>;
  close: () => void;
  confirm: () => void;
};

const initialSlice = {
  isDialogOpen: false,
  title: "",
  message: "",
  confirmLabel: undefined,
  variant: "default" as ConfirmationDialogVariant,
  ctrlCToConfirm: false,
  pendingResolve: null as ConfirmationDialogStoreState["pendingResolve"],
  activeOpenPromise: null as ConfirmationDialogStoreState["activeOpenPromise"],
};

export const useConfirmationDialogStore = create<ConfirmationDialogStoreState>(
  (set, get) => ({
    ...initialSlice,

    open: (options) => {
      const { isDialogOpen, activeOpenPromise } = get();
      if (isDialogOpen && activeOpenPromise) {
        return activeOpenPromise;
      }

      let resolveOpen!: (result: ConfirmationDialogResult) => void;
      const promise = new Promise<ConfirmationDialogResult>((resolve) => {
        resolveOpen = resolve;
      });

      usePopupStore.getState().pushPopup(PopupNames.ConfirmationDialog);
      set({
        isDialogOpen: true,
        title: options.title,
        message: options.message,
        confirmLabel: options.confirmLabel,
        variant: options.variant ?? "default",
        ctrlCToConfirm: options.ctrlCToConfirm ?? false,
        pendingResolve: resolveOpen,
        activeOpenPromise: promise,
      });
      return promise;
    },

    close: () => {
      const { isDialogOpen, pendingResolve } = get();
      if (isDialogOpen) {
        usePopupStore.getState().popPopup();
      }
      set({
        ...initialSlice,
      });
      pendingResolve?.({ type: "cancelled" });
    },

    confirm: () => {
      const { isDialogOpen, pendingResolve } = get();
      if (isDialogOpen) {
        usePopupStore.getState().popPopup();
      }
      set({
        ...initialSlice,
      });
      pendingResolve?.({ type: "accepted" });
    },
  }),
);
