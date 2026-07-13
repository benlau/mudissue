import { useCallback, useEffect } from "react";
import { create } from "zustand";
import terminalSize from "terminal-size";
import { AnsiEscapeCode } from "../../types/ansi.ts";

export type TerminalDimensions = {
  cols: number;
  rows: number;
};

function readTerminalSize(): TerminalDimensions {
  const { columns, rows } = terminalSize();
  return { cols: columns, rows };
}

type TerminalSizeStoreState = TerminalDimensions & {
  syncGeneration: number;
  syncFromTerminal: () => void;
  start: () => void;
};

export const useTerminalSizeStore = create<TerminalSizeStoreState>((set) => {
  const syncFromTerminal = () =>
    set((state) => ({
      ...readTerminalSize(),
      syncGeneration: state.syncGeneration + 1,
    }));

  const initial = readTerminalSize();
  let listening = false;

  const start = () => {
    if (listening) {
      return;
    }
    listening = true;
    process.stdout?.on("resize", syncFromTerminal);
  };

  return {
    cols: initial.cols,
    rows: initial.rows,
    syncGeneration: 0,
    syncFromTerminal,
    start,
  };
});

export function useTerminalSize(): TerminalDimensions {
  const cols = useTerminalSizeStore((s) => s.cols);
  const rows = useTerminalSizeStore((s) => s.rows);
  useTerminalSizeStore((s) => s.syncGeneration);

  useEffect(() => {
    useTerminalSizeStore.getState().start();
  }, []);

  return { cols, rows };
}

export function useRefreshTerminal(): () => void {
  const syncFromTerminal = useTerminalSizeStore((s) => s.syncFromTerminal);
  return useCallback(() => syncFromTerminal(), [syncFromTerminal]);
}

export function useTerminalName(name: string): void {
  useEffect(() => {
    process.stdout.write(
      `${AnsiEscapeCode.OSC_SET_WINDOW_TITLE_PREFIX}${name}${AnsiEscapeCode.BEL}`,
    );
  }, [name]);
}
