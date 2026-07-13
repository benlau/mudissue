import { create } from "zustand";
import { immer } from "zustand/middleware/immer";

export enum PopupNames {
  AlertDialog = "alertDialog",
  ConfirmationDialog = "confirmationDialog",
  CreateIssueDialog = "createIssueDialog",
  CreateIssueFromFileDialog = "createIssueFromFileDialog",
  PickItemDialog = "pickItemDialog",
  SearchingDialog = "searchingDialog",
  TextInputDialog = "textInputDialog",
  TextEditDialog = "textEditDialog",
  Toast = "toast",
  PaletteCommand = "paletteCommand",
  IssueSearchingDialog = "issueSearchingDialog",
}

type PopupStoreState = {
  popupStack: PopupNames[];
  hasPopup: boolean;
  latestPopup: PopupNames | null;
  pushPopup: (name: PopupNames) => void;
  popPopup: () => void;
};

export const usePopupStore = create<PopupStoreState>()(
  immer((set) => ({
    popupStack: [],
    hasPopup: false,
    latestPopup: null,

    pushPopup: (name: PopupNames) => {
      set((draft) => {
        draft.popupStack.push(name);
        draft.hasPopup = true;
        draft.latestPopup = name;
      });
    },

    popPopup: () => {
      set((draft) => {
        draft.popupStack.pop();
        draft.hasPopup = draft.popupStack.length > 0;
        draft.latestPopup =
          draft.popupStack[draft.popupStack.length - 1] ?? null;
      });
    },
  })),
);
