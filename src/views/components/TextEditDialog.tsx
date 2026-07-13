import {
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import { useInput, Box, Text } from "ink";
import { defineMessages, useIntl } from "react-intl";
import {
  MultilineInteractiveTextInput,
  useMultilineInteractiveTextInputHandle,
} from "./MultilineInteractiveTextInput.tsx";
import { EmptyArea, EMPTY_AREA_EXTRA, EMPTY_AREA_SIDE_MARGIN } from "./EmptyArea.tsx";
import {
  bigDialogLayout,
  useDialogLayout,
} from "../hooks/useDialogLayout.ts";
import { useDebounce } from "../hooks/useDebounce.ts";
import { useTextEditDialogStore } from "../../store/TextEditDialogStore.ts";
import { PopupNames, usePopupStore } from "../../store/PopupStore.ts";
import { FileService } from "../../services/FileService.ts";
import { SAVE_DEBOUNCE_MS } from "../../constants.ts";
import { DefaultTheme } from "../../types/Theme.ts";

const WATCH_DEBOUNCE_MS = 150;
const RELOAD_SUPPRESS_AFTER_SAVE_MS = 500;

const TEXT_EDIT_DIALOG_BORDER_ROWS = 2;
const TEXT_EDIT_DIALOG_FOOTER_ROWS = 1;
const TEXT_EDIT_DIALOG_CONTENT_INSET = 4;

const messages = defineMessages({
  edit: {
    id: "views.textEditDialog.edit",
    defaultMessage: "Edit",
  },
});
export function textEditDialogInputHeight(dialogHeight: number): number {
  return Math.max(
    1,
    dialogHeight - TEXT_EDIT_DIALOG_BORDER_ROWS - TEXT_EDIT_DIALOG_FOOTER_ROWS,
  );
}

function normalizeFileText(raw: string): string {
  return raw.replace(/\r\n/g, "\n");
}

export function TextEditDialog() {
  const intl = useIntl();
  const isOpen = useTextEditDialogStore((s) => s.isDialogOpen);
  const openSession = useTextEditDialogStore((s) => s.openSession);
  const filePath = useTextEditDialogStore((s) => s.filePath);
  const initialLineIndex = useTextEditDialogStore((s) => s.initialLineIndex);
  const close = useTextEditDialogStore((s) => s.close);

  const fileService = FileService.getInstance();
  const [text, setText] = useState("");
  const [isLoaded, setIsLoaded] = useState(false);
  const textRef = useRef("");
  const lastSavedTextRef = useRef("");
  const lastModifiedAtRef = useRef<Date | null>(null);
  const textInputStore = useMultilineInteractiveTextInputHandle();
  const cancelledRef = useRef(false);
  const reloadSuppressedUntilRef = useRef(0);

  const { width, height, left, top } = useDialogLayout(bigDialogLayout);
  const inputHeight = textEditDialogInputHeight(height);
  const inputWidth = Math.max(4, width - TEXT_EDIT_DIALOG_CONTENT_INSET);
  const latestPopup = usePopupStore((s) => s.latestPopup);
  const isLatestPopup = latestPopup === PopupNames.TextEditDialog;

  const saveToDisk = useCallback(
    async (content: string) => {
      if (!filePath || content === lastSavedTextRef.current) return;
      await fileService.writeFile(filePath, content, "utf-8");
      lastSavedTextRef.current = content;
      lastModifiedAtRef.current = new Date();
    },
    [filePath, fileService],
  );

  const { status: saveStatus, run: debouncedSave, apply: applySave } =
    useDebounce(SAVE_DEBOUNCE_MS, saveToDisk);

  const applyDiskContent = useCallback((normalized: string) => {
    setText(normalized);
    textRef.current = normalized;
    lastSavedTextRef.current = normalized;
    textInputStore.getState().replaceContent(normalized, {
      preserveCursorRow: true,
    });
  }, [textInputStore]);

  const loadFromDisk = useCallback(async () => {
    if (!filePath) return;
    const raw = (await fileService.readFile(filePath, "utf-8")) as string;
    if (cancelledRef.current) return;
    const normalized = normalizeFileText(raw);
    if (normalized === textRef.current) return;
    applyDiskContent(normalized);
  }, [applyDiskContent, filePath, fileService]);

  useEffect(() => {
    if (!isOpen || !filePath) return;

    cancelledRef.current = false;
    setIsLoaded(false);
    setText("");
    textRef.current = "";
    lastSavedTextRef.current = "";
    lastModifiedAtRef.current = null;

    void (async () => {
      const raw = (await fileService.readFile(filePath, "utf-8")) as string;
      if (cancelledRef.current) return;
      const normalized = normalizeFileText(raw);
      textRef.current = normalized;
      lastSavedTextRef.current = normalized;
      setText(normalized);
      setIsLoaded(true);
    })();

    return () => {
      cancelledRef.current = true;
    };
  }, [filePath, fileService, isOpen, openSession]);

  useEffect(() => {
    if (!isOpen || !filePath) return;

    let debounceTimer: ReturnType<typeof globalThis.setTimeout> | null = null;
    const unsubscribe = fileService.watch(filePath, () => {
      if (debounceTimer != null) globalThis.clearTimeout(debounceTimer);
      debounceTimer = globalThis.setTimeout(() => {
        debounceTimer = null;
        if (Date.now() < reloadSuppressedUntilRef.current) return;
        void loadFromDisk();
      }, WATCH_DEBOUNCE_MS);
    });

    return () => {
      if (debounceTimer != null) globalThis.clearTimeout(debounceTimer);
      unsubscribe();
    };
  }, [filePath, fileService, isOpen, loadFromDisk]);

  const handleClose = useCallback(async () => {
    await applySave(textRef.current);
    const lastLogicalLineIndex = textInputStore
      .getState()
      .layouter.getLineIndex();
    close({
      lastUpdatedTimestamp: lastModifiedAtRef.current,
      lastLogicalLineIndex,
    });
  }, [applySave, close, textInputStore]);

  const handleChange = useCallback(
    (next: string) => {
      setText(next);
      textRef.current = next;
      reloadSuppressedUntilRef.current =
        Date.now() + SAVE_DEBOUNCE_MS + RELOAD_SUPPRESS_AFTER_SAVE_MS;
      debouncedSave(next);
    },
    [debouncedSave],
  );

  useInput(
    (input, key) => {
      if (!isOpen || !isLoaded) return;
      if (key.escape) {
        void handleClose();
      }
    },
    { isActive: isOpen && isLatestPopup && isLoaded },
  );

  if (!isOpen) return null;

  const focusInput = isLatestPopup && isLoaded;
  const saveStatusLabel =
    saveStatus === "running"
      ? "Saving…"
      : saveStatus === "pending"
        ? "Pending…"
        : null;

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
        paddingBottom={0}
      >
          <Box position="absolute" marginTop={-1} marginLeft={1}>
            <Text color={DefaultTheme.accents.orange}>{intl.formatMessage(messages.edit)}</Text>
          </Box>
        {!isLoaded ? (
          <Box
            flexGrow={1}
            flexDirection="column"
            justifyContent="center"
            alignItems="center"
            paddingTop={1}
          >
            <Text>Loading…</Text>
          </Box>
        ) : (
          <>
            <Box flexDirection="column" height={inputHeight}>
              <MultilineInteractiveTextInput
                key={openSession}
                handle={textInputStore}
                isActive={focusInput}
                width={inputWidth}
                height={inputHeight}
                initialValue={text}
                initialLineIndex={initialLineIndex}
                onChange={handleChange}
              />
            </Box>
            <Box
              height={TEXT_EDIT_DIALOG_FOOTER_ROWS}
              flexDirection="row"
              justifyContent="flex-end"
            >
              {saveStatusLabel ? (
                <>
                  <Text dimColor>{saveStatusLabel}</Text>
                  <Text> | </Text>
                </>
              ) : null}
              <Text>Close(Esc)</Text>
            </Box>
          </>
        )}
      </Box>
    </EmptyArea>
  );
}
