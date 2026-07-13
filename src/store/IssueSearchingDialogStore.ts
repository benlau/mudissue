import { create } from "zustand";
import { PopupNames, usePopupStore } from "./PopupStore.ts";
import type { IssueFolder } from "../types/Issue.ts";

export enum IssueSearchingDialogResponseType {
  Accepted,
  Cancelled,
}

export interface IssueSearchingDialogResponse {
  type: IssueSearchingDialogResponseType;
  issue?: IssueFolder;
}

export type IssueSearchingDialogOpenOptions = {
  title: string;
  confirmLabel: string;
  excludeFolderNames?: string[];
};

type PendingResolve = (response: IssueSearchingDialogResponse) => void;

type IssueSearchingDialogStoreState = {
  isOpen: boolean;
  title: string;
  confirmLabel: string;
  excludeFolderNames: string[];
  pendingResolve: PendingResolve | null;
  open: (
    options: IssueSearchingDialogOpenOptions,
  ) => Promise<IssueSearchingDialogResponse>;
  close: () => void;
  accept: (issue: IssueFolder) => void;
};

const initialSlice = {
  isOpen: false,
  title: "",
  confirmLabel: "",
  excludeFolderNames: [] as string[],
  pendingResolve: null as PendingResolve | null,
};

export const useIssueSearchingDialogStore =
  create<IssueSearchingDialogStoreState>((set, get) => ({
    ...initialSlice,

    open: (options) => {
      usePopupStore.getState().pushPopup(PopupNames.IssueSearchingDialog);
      set({
        isOpen: true,
        title: options.title,
        confirmLabel: options.confirmLabel,
        excludeFolderNames: options.excludeFolderNames ?? [],
        pendingResolve: null,
      });
      return new Promise<IssueSearchingDialogResponse>((resolve) => {
        set({ pendingResolve: resolve });
      });
    },

    close: () => {
      const { isOpen, pendingResolve } = get();
      if (isOpen) {
        usePopupStore.getState().popPopup();
      }
      set({ ...initialSlice });
      pendingResolve?.({ type: IssueSearchingDialogResponseType.Cancelled });
    },

    accept: (issue) => {
      const { isOpen, pendingResolve } = get();
      if (isOpen) {
        usePopupStore.getState().popPopup();
      }
      set({ ...initialSlice });
      pendingResolve?.({
        type: IssueSearchingDialogResponseType.Accepted,
        issue,
      });
    },
  }));
