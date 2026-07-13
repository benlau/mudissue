import { create } from "zustand";
import { PopupNames, usePopupStore } from "./PopupStore.ts";

export type ToastPosition =
  | "top-right"
  | "top-middle"
  | "top-left"
  | "bottom-right"
  | "bottom-left"
  | "center";

export type ToastOptions = {
  duration?: number;
  position?: ToastPosition;
  persistent?: boolean;
};

export type ToastVariant = "info" | "error";

type ToastStoreState = {
  isToastOpen: boolean;
  message: string;
  variant: ToastVariant;
  duration: number;
  position: ToastPosition;
  persistent: boolean;
  toastKey: number;
  pendingResolve: (() => void) | null;
  info: (message: string, options?: ToastOptions) => Promise<void>;
  error: (message: string, options?: ToastOptions) => Promise<void>;
  close: () => void;
};

const DEFAULT_TOAST_DURATION = 3000;
const DEFAULT_TOAST_POSITION: ToastPosition = "top-right";

const initialSlice = {
  isToastOpen: false,
  message: "",
  variant: "info" as ToastVariant,
  duration: DEFAULT_TOAST_DURATION,
  position: DEFAULT_TOAST_POSITION,
  persistent: false,
  toastKey: 0,
  pendingResolve: null as ToastStoreState["pendingResolve"],
};

function normalizeOptions(
  options?: ToastOptions,
): Pick<ToastStoreState, "duration" | "position" | "persistent"> {
  return {
    duration: options?.duration ?? DEFAULT_TOAST_DURATION,
    position: options?.position ?? DEFAULT_TOAST_POSITION,
    persistent: options?.persistent ?? false,
  };
}

export const useToastStore = create<ToastStoreState>((set, get) => {
  const open = async (
    variant: ToastVariant,
    message: string,
    options?: ToastOptions,
  ): Promise<void> => {
    const { isToastOpen, pendingResolve } = get();
    if (isToastOpen) {
      pendingResolve?.();
    } else {
      usePopupStore.getState().pushPopup(PopupNames.Toast);
    }
    return new Promise<void>((resolve) => {
      set((state) => ({
        isToastOpen: true,
        message,
        variant,
        ...normalizeOptions(options),
        toastKey: state.toastKey + 1,
        pendingResolve: resolve,
      }));
    });
  };

  return {
    ...initialSlice,

    info: (message, options) => open("info", message, options),

    error: (message, options) => open("error", message, options),

    close: () => {
      const { isToastOpen, pendingResolve, toastKey } = get();
      if (isToastOpen) {
        usePopupStore.getState().popPopup();
      }
      set({
        ...initialSlice,
        toastKey,
      });
      pendingResolve?.();
    },
  };
});
