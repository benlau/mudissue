import { create } from "zustand";
import type { PaletteCommand } from "../types/PaletteCommand.ts";
import { accessPaletteCommandList } from "../types/PaletteCommand.ts";
import type { ToolbarConfigItem } from "../types/Toolbar.ts";
import { PopupNames, usePopupStore } from "./PopupStore.ts";

export type PaletteCommandOpenOptions = {
  commands: PaletteCommand[];
  toolbarItems?: ToolbarConfigItem[];
  initialFilterQuery?: string;
};

export type PaletteCommandStoreState = {
  isOpen: boolean;
  commands: PaletteCommand[];
  toolbarItems: ToolbarConfigItem[];
  initialFilterQuery: string;
  lastUsedCommandKey: string | null;
  open: (options: PaletteCommandOpenOptions) => void;
  replaceCommands: (commands: PaletteCommand[]) => void;
  close: () => void;
  dismissEscape: () => void;
};

function closedContentSlice(): Pick<
  PaletteCommandStoreState,
  "commands" | "toolbarItems" | "initialFilterQuery"
> {
  return {
    commands: [],
    toolbarItems: [],
    initialFilterQuery: ":",
  };
}

export const usePaletteCommandStore = create<PaletteCommandStoreState>()(
  (set, get) => ({
    isOpen: false,
    lastUsedCommandKey: null,
    ...closedContentSlice(),

    open: (options) => {
      usePopupStore.getState().pushPopup(PopupNames.PaletteCommand);
      const list = accessPaletteCommandList(
        options.commands,
      ).withLastUsedKeyFirst(get().lastUsedCommandKey);
      set({
        isOpen: true,
        commands: list,
        toolbarItems: [...(options.toolbarItems ?? [])],
        initialFilterQuery: options.initialFilterQuery ?? ":",
      });
    },

    replaceCommands: (commands) => {
      if (!get().isOpen) return;
      const list = accessPaletteCommandList(commands).withLastUsedKeyFirst(
        get().lastUsedCommandKey,
      );
      set({ commands: list });
    },

    close: () => {
      if (!get().isOpen) return;
      usePopupStore.getState().popPopup();
      set({
        isOpen: false,
        ...closedContentSlice(),
      });
    },

    dismissEscape: () => {
      get().close();
    },
  }),
);
