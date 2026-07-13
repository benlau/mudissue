import { create } from "zustand";
import { PopupNames, usePopupStore } from "./PopupStore.ts";

export type CreateIssueFromFileDialogResult =
  | { type: "accepted" }
  | { type: "cancelled" };

type CreateIssueFromFileDialogStoreState = {
  isDialogOpen: boolean;
  pendingResolve: ((result: CreateIssueFromFileDialogResult) => void) | null;
  open: () => Promise<CreateIssueFromFileDialogResult>;
  close: () => void;
  confirm: () => void;
};

export const useCreateIssueFromFileDialogStore =
  create<CreateIssueFromFileDialogStoreState>((set, get) => ({
    isDialogOpen: false,
    pendingResolve: null,

    open: () => {
      return new Promise<CreateIssueFromFileDialogResult>((resolve) => {
        usePopupStore
          .getState()
          .pushPopup(PopupNames.CreateIssueFromFileDialog);
        set({
          isDialogOpen: true,
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
        pendingResolve: null,
      });
      pendingResolve?.({ type: "cancelled" });
    },

    confirm: () => {
      const { isDialogOpen, pendingResolve } = get();
      if (isDialogOpen) {
        usePopupStore.getState().popPopup();
      }
      set({
        isDialogOpen: false,
        pendingResolve: null,
      });
      pendingResolve?.({ type: "accepted" });
    },
  }));
