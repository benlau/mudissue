import { create } from "zustand";
import { PopupNames, usePopupStore } from "./PopupStore.ts";

export type TextInputDialogResult =
  | { type: "accepted"; value: string }
  | { type: "cancelled" };

export type TextInputDialogOpenOptions = {
  title: string;
  prompt: string;
  placeholder?: string;
  initialValue?: string;
  confirmLabel?: string;
  /** Return an error message to keep the dialog open, or null to accept. */
  validate?: (value: string) => string | null;
};

type TextInputDialogStoreState = {
  isDialogOpen: boolean;
  title: string;
  prompt: string;
  placeholder: string;
  confirmLabel?: string;
  value: string;
  error: string | null;
  inputKey: number;
  validate: ((value: string) => string | null) | null;
  pendingResolve: ((result: TextInputDialogResult) => void) | null;
  activeOpenPromise: Promise<TextInputDialogResult> | null;
  setValue: (value: string) => void;
  open: (options: TextInputDialogOpenOptions) => Promise<TextInputDialogResult>;
  close: () => void;
  confirm: () => void;
};

const initialSlice = {
  isDialogOpen: false,
  title: "",
  prompt: "",
  placeholder: "",
  confirmLabel: undefined as string | undefined,
  value: "",
  error: null as string | null,
  inputKey: 0,
  validate: null as TextInputDialogStoreState["validate"],
  pendingResolve: null as TextInputDialogStoreState["pendingResolve"],
  activeOpenPromise: null as TextInputDialogStoreState["activeOpenPromise"],
};

export const useTextInputDialogStore = create<TextInputDialogStoreState>(
  (set, get) => ({
    ...initialSlice,

    setValue: (value) => set({ value, error: null }),

    open: (options) => {
      const { isDialogOpen, activeOpenPromise } = get();
      if (isDialogOpen && activeOpenPromise) {
        return activeOpenPromise;
      }

      let resolveOpen!: (result: TextInputDialogResult) => void;
      const promise = new Promise<TextInputDialogResult>((resolve) => {
        resolveOpen = resolve;
      });

      usePopupStore.getState().pushPopup(PopupNames.TextInputDialog);
      set({
        isDialogOpen: true,
        title: options.title,
        prompt: options.prompt,
        placeholder: options.placeholder ?? "",
        confirmLabel: options.confirmLabel,
        value: options.initialValue ?? "",
        error: null,
        inputKey: get().inputKey + 1,
        validate: options.validate ?? null,
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
        inputKey: get().inputKey,
      });
      pendingResolve?.({ type: "cancelled" });
    },

    confirm: () => {
      const { isDialogOpen, value, validate, pendingResolve } = get();
      const trimmed = value.trim();
      const validationError = validate?.(trimmed) ?? null;
      if (validationError != null) {
        set({ error: validationError });
        return;
      }
      if (isDialogOpen) {
        usePopupStore.getState().popPopup();
      }
      set({
        ...initialSlice,
        inputKey: get().inputKey,
      });
      pendingResolve?.({ type: "accepted", value: trimmed });
    },
  }),
);
