import { create } from "zustand";
import type { IssueFolder } from "../types/Issue.ts";
import { PopupNames, usePopupStore } from "./PopupStore.ts";

type CreateIssueDialogStoreState = {
  isDialogOpen: boolean;
  /** Bumps whenever the dialog opens; remount dependents (e.g. TextInput). */
  openSession: number;
  parentIssue: IssueFolder | null;
  open: (parentIssue?: IssueFolder) => void;
  close: () => void;
};

export const useCreateIssueDialogStore = create<CreateIssueDialogStoreState>(
  (set, get) => ({
    isDialogOpen: false,
    openSession: 0,
    parentIssue: null,

    open: (parentIssue?: IssueFolder) => {
      if (get().isDialogOpen) {
        return;
      }
      usePopupStore.getState().pushPopup(PopupNames.CreateIssueDialog);
      set((state) => ({
        isDialogOpen: true,
        openSession: state.openSession + 1,
        parentIssue: parentIssue ?? null,
      }));
    },

    close: () => {
      if (!get().isDialogOpen) return;
      set({ isDialogOpen: false, parentIssue: null });

      /** Only pop entries that belong to this dialog; never peel another popup (e.g. Toast). */
      while (
        usePopupStore.getState().latestPopup === PopupNames.CreateIssueDialog
      ) {
        usePopupStore.getState().popPopup();
      }
    },
  }),
);
