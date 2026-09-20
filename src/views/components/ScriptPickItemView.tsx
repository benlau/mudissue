import { useEffect, useLayoutEffect, useRef } from "react";
import { Box } from "ink";
import { AnsiEscapeCode } from "../../types/ansi.ts";
import {
  PickItemDialog,
  PickItemDialogResponseType,
  usePickItemDialogStore,
} from "./PickItemDialog.tsx";
import { useTerminalSize } from "../hooks/useTerminal.ts";

export type ScriptPickItemViewProps = {
  title: string;
  items: string[];
  defaultItem?: string;
  onSelect: (selected: string | null) => void;
};

export function resolveDefaultItemIndex(
  items: string[],
  defaultItem: string | undefined,
): number {
  if (defaultItem === undefined) {
    return 0;
  }
  const index = items.indexOf(defaultItem);
  return index >= 0 ? index : 0;
}

/**
 * Full-screen alternate-buffer host that opens {@link PickItemDialog} for
 * headless `mud script select-item` (and similar) flows.
 */
export function ScriptPickItemView({
  title,
  items,
  defaultItem,
  onSelect,
}: ScriptPickItemViewProps) {
  const { cols, rows } = useTerminalSize();
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  // Same stream as Command.askUserPickItem ({ stdout: process.stderr }).
  useLayoutEffect(() => {
    process.stderr.write(AnsiEscapeCode.ENTER_ALTERNATE_SCREEN);
    return () => {
      process.stderr.write(AnsiEscapeCode.EXIT_ALTERNATE_SCREEN);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void usePickItemDialogStore
      .getState()
      .open(items, (item) => item, {
        title,
        initialSelectedIndex: resolveDefaultItemIndex(items, defaultItem),
      })
      .then((response) => {
        if (cancelled) {
          return;
        }
        if (
          response.type === PickItemDialogResponseType.Accepted &&
          response.acceptedValue !== undefined
        ) {
          onSelectRef.current(response.acceptedValue);
        } else {
          onSelectRef.current(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [defaultItem, items, title]);

  return (
    <Box width={cols} height={rows}>
      <PickItemDialog />
    </Box>
  );
}
