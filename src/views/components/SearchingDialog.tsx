import { useCallback, useMemo, useRef } from "react";
import { useStore } from "zustand/react";
import { Box, Text } from "ink";
import { InteractiveTextInput } from "./InteractiveTextInput.tsx";
import { EmptyArea, EMPTY_AREA_EXTRA, EMPTY_AREA_SIDE_MARGIN } from "./EmptyArea.tsx";
import {
  mediumDialogLayout,
  useDialogLayout,
} from "../hooks/useDialogLayout.ts";
import { ToolBar, type ToolbarConfigItem } from "./ToolBar.tsx";
import { useRecentFilters } from "../hooks/useRecentFilters.ts";
import { RegistryService } from "../../services/RegistryService.ts";
import {
  createSearchingDialogStore,
  type SearchingDialogResponse,
  type SearchingDialogResponseType,
  type SearchingDialogStore,
} from "../../store/SearchingDialogStore.ts";
import { PopupNames, usePopupStore } from "../../store/PopupStore.ts";
import { DefaultTheme, DialogConfirmColor } from "../../types/Theme.ts";

const SEARCHING_DIALOG_BASE_HEIGHT = 6;
const SEARCHING_INPUT_LABEL = "Text: ";

export type { SearchingDialogResponse, SearchingDialogResponseType };

export type UseSearchingDialogHandleOpenOptions = {
  initialValue: string;
};

export type SearchingDialogHandleProps = {
  isDialogOpen: boolean;
  value: string;
  setValue: (v: string) => void;
  close: () => void;
  confirm: () => void;
  /** Recent filters snapshotted when the dialog was opened (latest first). */
  dialogRecentFilters: string[];
  dialogInputKey: number;
  /** Omit vs present follows open() semantics for InteractiveTextInput seeding. */
  dialogInputInitialValue: string | undefined;
};

export function useSearchingDialogHandle(): {
  props: SearchingDialogHandleProps;
  methods: { open: (options: UseSearchingDialogHandleOpenOptions) => Promise<SearchingDialogResponse> };
  /** Per-mount vanilla Zustand store (not a module singleton). */
  store: SearchingDialogStore;
} {
  const { reload, addFilter } = useRecentFilters(
    RegistryService.getInstance(),
  );

  const storeRef = useRef<SearchingDialogStore | null>(null);
  if (storeRef.current === null) {
    storeRef.current = createSearchingDialogStore();
  }
  const store = storeRef.current;

  const isDialogOpen = useStore(store, (s) => s.isDialogOpen);
  const value = useStore(store, (s) => s.value);
  const dialogRecentFilters = useStore(store, (s) => s.dialogRecentFilters);
  const dialogInputKey = useStore(store, (s) => s.dialogInputKey);
  const dialogInputInitialValue = useStore(store, (s) => s.dialogInputInitialValue);
  const setValue = useStore(store, (s) => s.setValue);
  const close = useStore(store, (s) => s.close);

  const open = useCallback(
    async (options: UseSearchingDialogHandleOpenOptions) => {
      const list = await reload();
      return store.getState().open({
        initialValue: options.initialValue,
        recentFilters: list,
      });
    },
    [reload, store],
  );

  const confirm = useCallback(() => {
    const trimmed = store.getState().value.trim();
    void addFilter(trimmed);
    store.getState().confirm();
  }, [addFilter, store]);

  const props = useMemo(
    () => ({
      isDialogOpen,
      value,
      setValue,
      close,
      confirm,
      dialogRecentFilters,
      dialogInputKey,
      dialogInputInitialValue,
    }),
    [
      isDialogOpen,
      value,
      setValue,
      close,
      confirm,
      dialogRecentFilters,
      dialogInputKey,
      dialogInputInitialValue,
    ],
  );

  const methods = useMemo(() => ({ open }), [open]);

  return useMemo(
    () => ({ props, methods, store }),
    [props, methods, store],
  );
}

export type SearchingDialogProps = SearchingDialogHandleProps;

export function SearchingDialog({
  isDialogOpen,
  value: _value,
  setValue,
  close,
  confirm,
  dialogRecentFilters,
  dialogInputKey,
  dialogInputInitialValue,
}: SearchingDialogProps) {
  const { width, height, left, top } = useDialogLayout({
    ...mediumDialogLayout,
    minHeight: SEARCHING_DIALOG_BASE_HEIGHT,
    maxHeight: SEARCHING_DIALOG_BASE_HEIGHT,
  });
  const maxDisplayWidth = Math.max(
    1,
    width - 2 - SEARCHING_INPUT_LABEL.length,
  );
  const latestPopup = usePopupStore((s) => s.latestPopup);
  const isLatestPopup = latestPopup === PopupNames.SearchingDialog;

  const toolbarItems = useMemo<ToolbarConfigItem[]>(
    () => [
      { label: "Cancel", key: "Esc", callback: close },
      {
        label: "Confirm",
        key: "Enter",
        callback: confirm,
        color: DialogConfirmColor,
      },
    ],
    [close, confirm],
  );

  if (!isDialogOpen) return null;

  return (
    <EmptyArea
      position="absolute"
      marginLeft={Math.max(0, left - EMPTY_AREA_SIDE_MARGIN)}
      marginTop={Math.max(0, top - EMPTY_AREA_SIDE_MARGIN)}
      flexDirection="column"
      width={width + EMPTY_AREA_EXTRA}
      height={height + EMPTY_AREA_EXTRA}
    >
      <Box
        flexDirection="column"
        marginLeft={EMPTY_AREA_SIDE_MARGIN}
        marginTop={EMPTY_AREA_SIDE_MARGIN}
        width={width}
        height={height}
        borderStyle="single"
        borderColor={DefaultTheme.accents.green}
        borderTop
        borderBottom
        borderLeft
        borderRight
        paddingX={1}
        paddingTop={0}
        paddingBottom={1}
      >
        <Box position="absolute" marginTop={-1} marginLeft={1}>
          <Text color={DefaultTheme.accents.orange}>Search</Text>
        </Box>
        <Box marginTop={1}>
          <Text>{SEARCHING_INPUT_LABEL}</Text>
          <InteractiveTextInput
            key={dialogInputKey}
            isActive={isDialogOpen && isLatestPopup}
            history={dialogRecentFilters}
            initialValue={dialogInputInitialValue}
            onChange={setValue}
            placeholder="Filter query…"
            maxDisplayWidth={maxDisplayWidth}
          />
        </Box>
        <Box marginTop={1} justifyContent="flex-end">
          <ToolBar
            width={width - 2}
            items={toolbarItems}
            isDisabled={!isLatestPopup}
          />
        </Box>
      </Box>
    </EmptyArea>
  );
}
