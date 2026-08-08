import { create } from "zustand";

type ClipboardStoreState = {
  content: string;
  write: (content: string) => void;
  clear: () => void;
};

export const useClipboardStore = create<ClipboardStoreState>((set) => ({
  content: "",

  write: (content) => {
    set({ content });
  },

  clear: () => {
    set({ content: "" });
  },
}));
