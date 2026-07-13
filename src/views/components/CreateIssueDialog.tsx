import {
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import stringWidth from "string-width";
import { useInput, Box, Text } from "ink";
import {
  MultilineInteractiveTextInput,
  useMultilineInteractiveTextInputHandle,
} from "./MultilineInteractiveTextInput.tsx";
import { EmptyArea, EMPTY_AREA_EXTRA, EMPTY_AREA_SIDE_MARGIN } from "./EmptyArea.tsx";
import {
  bigDialogLayout,
  useDialogLayout,
} from "../hooks/useDialogLayout.ts";
import { useConfirmationDialogStore } from "../../store/ConfirmationDialogStore.ts";
import { useCreateIssueDialogStore } from "../../store/CreateIssueDialogStore.ts";
import { PopupNames, usePopupStore } from "../../store/PopupStore.ts";
import { CreateIssueHelper } from "../../helpers/CreateIssueHelper.ts";
import { ISSUE_FOLDER_NAME_MAX_LENGTH } from "../../constants.ts";
import { BasicLayouter } from "../../foundation/layouter/BasicLayouter.ts";
import { DefaultTheme, DialogConfirmColor } from "../../types/Theme.ts";

const CREATE_ISSUE_DIALOG_BORDER_ROWS = 2;
const CREATE_ISSUE_DIALOG_ERROR_ROWS = 1;
const CREATE_ISSUE_DIALOG_FOOTER_ROWS = 1;
const CREATE_ISSUE_DIALOG_INNER_FIXED_ROWS =
  CREATE_ISSUE_DIALOG_ERROR_ROWS + CREATE_ISSUE_DIALOG_FOOTER_ROWS;
const CREATE_ISSUE_DIALOG_CONTENT_INSET = 4;
const ISSUE_TITLE_MAX_LENGTH = 64;
/** Reserve typical issue id prefix when previewing folder slug budget. */
const ISSUE_ID_PREFIX_RESERVE = 8;
const CREATE_ISSUE_LABEL_PREFIX = "Create Issue";

export function createIssueDialogInputHeight(dialogHeight: number): number {
  return Math.max(
    1,
    dialogHeight -
      CREATE_ISSUE_DIALOG_BORDER_ROWS -
      CREATE_ISSUE_DIALOG_INNER_FIXED_ROWS,
  );
}

export function deriveIssueTitleFromText(text: string): string {
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (trimmed !== "") return trimmed;
  }
  return "";
}

export function splitIssueText(text: string): { title: string; body?: string } {
  const lines = text.split("\n");
  const titleLineIndex = lines.findIndex((line) => line.trim() !== "");
  if (titleLineIndex < 0) {
    return { title: "" };
  }
  const title = lines[titleLineIndex]!.trim();
  const bodyLines = lines.slice(titleLineIndex + 1);
  const body = bodyLines.join("\n");
  return body.trim() === "" ? { title } : { title, body };
}

function truncateTitleForDialogLabel(
  title: string,
  maxWidth: number,
): string {
  if (title === "") return "";
  const capped =
    title.length <= ISSUE_TITLE_MAX_LENGTH
      ? title
      : title.slice(0, ISSUE_TITLE_MAX_LENGTH);
  const folderSlugBudget = Math.max(
    1,
    ISSUE_FOLDER_NAME_MAX_LENGTH - ISSUE_ID_PREFIX_RESERVE,
  );
  const folderCapped =
    capped.length <= folderSlugBudget
      ? capped
      : capped.slice(0, folderSlugBudget);
  return BasicLayouter.stringWidthTruncateEnd(folderCapped, maxWidth);
}

function hasCreateIssueDialogContent(text: string): boolean {
  return text.trim() !== "";
}

async function requestDismissCreateIssueDialog(options: {
  text: string;
  close: () => void;
}): Promise<void> {
  const { text, close } = options;
  if (!hasCreateIssueDialogContent(text)) {
    close();
    return;
  }
  const result = await useConfirmationDialogStore.getState().open({
    title: "Discard issue?",
    message:
      "Your draft will be lost. Press Enter to discard or Esc to keep editing.",
    confirmLabel: "Discard",
    variant: "destructive",
  });
  if (result.type === "accepted") {
    close();
  }
}

function createIssueBorderLabel(title: string, dialogWidth: number): string {
  if (title === "") return CREATE_ISSUE_LABEL_PREFIX;
  const prefix = `${CREATE_ISSUE_LABEL_PREFIX}: `;
  const labelMaxWidth = Math.max(1, dialogWidth - 4);
  const titleBudget = Math.max(1, labelMaxWidth - stringWidth(prefix));
  const displayTitle = truncateTitleForDialogLabel(title, titleBudget);
  return `${prefix}${displayTitle}`;
}

export type CreateIssueDialogSubmissionOptions = {
  isOpen: boolean;
  onCreate: (title: string, body?: string) => Promise<void>;
  onSuccess?: () => void;
};

export function useCreateIssueDialogState({
  isOpen,
  onCreate,
  onSuccess,
}: CreateIssueDialogSubmissionOptions) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submittingRef = useRef(false);

  useEffect(() => {
    if (isOpen) {
      setText("");
      setError(null);
      setIsSubmitting(false);
      submittingRef.current = false;
      return;
    }
    submittingRef.current = false;
    setIsSubmitting(false);
  }, [isOpen]);

  const handleSubmit = useCallback(
    async (val: string) => {
      if (submittingRef.current) return;

      setError(null);
      const { title, body } = splitIssueText(val);
      if (title === "") return;

      submittingRef.current = true;
      setIsSubmitting(true);
      try {
        await onCreate(title, body);
        setText("");
        onSuccess?.();
      } catch (err) {
        const message =
          err instanceof Error ? err.message : String(err);
        setError(message);
        submittingRef.current = false;
        setIsSubmitting(false);
      }
    },
    [onCreate, onSuccess],
  );

  return {
    text,
    setText,
    error,
    isSubmitting,
    handleSubmit,
  };
}

export function CreateIssueDialog() {
  const isOpen = useCreateIssueDialogStore((s) => s.isDialogOpen);
  const openSession = useCreateIssueDialogStore((s) => s.openSession);
  const parentIssue = useCreateIssueDialogStore((s) => s.parentIssue);
  const close = useCreateIssueDialogStore((s) => s.close);
  const createIssueHelper = useRef(new CreateIssueHelper()).current;
  const textInputHandle = useMultilineInteractiveTextInputHandle();

  const onCreate = useCallback(
    async (title: string, body?: string) => {
      if (parentIssue != null) {
        await createIssueHelper.createSubissue(title, parentIssue, body);
      } else {
        await createIssueHelper.createIssue(title, undefined, body);
      }
    },
    [parentIssue, createIssueHelper],
  );

  const {
    text,
    setText,
    error,
    isSubmitting,
    handleSubmit,
  } = useCreateIssueDialogState({
    isOpen,
    onCreate,
    onSuccess: close,
  });
  const { width, height, left, top } = useDialogLayout(bigDialogLayout);
  const inputHeight = createIssueDialogInputHeight(height);
  const inputWidth = Math.max(4, width - CREATE_ISSUE_DIALOG_CONTENT_INSET);
  const latestPopup = usePopupStore((s) => s.latestPopup);
  const isLatestPopup = latestPopup === PopupNames.CreateIssueDialog;
  const derivedTitle = deriveIssueTitleFromText(text);
  const borderLabel = createIssueBorderLabel(derivedTitle, width);
  const hasTitle = derivedTitle !== "";

  useInput(
    (input, key) => {
      if (!isOpen) return;
      if (isSubmitting) return;
      if (key.escape) {
        void requestDismissCreateIssueDialog({ text, close });
        return;
      }
      if (key.ctrl && input.toLowerCase() === "d") {
        if (!hasTitle) return;
        void handleSubmit(text);
      }
    },
    { isActive: isOpen && isLatestPopup && !isSubmitting },
  );

  if (!isOpen) return null;

  const focusInput = isLatestPopup && !isSubmitting;

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
          <Text color={DefaultTheme.accents.orange}>{borderLabel}</Text>
        </Box>
        {isSubmitting ? (
          <Box
            flexGrow={1}
            flexDirection="column"
            justifyContent="center"
            alignItems="center"
            paddingTop={1}
          >
            <Text>Creating issue…</Text>
          </Box>
        ) : (
          <>
            <Box flexDirection="column" height={inputHeight}>
              <MultilineInteractiveTextInput
                key={openSession}
                handle={textInputHandle}
                isActive={focusInput}
                width={inputWidth}
                height={inputHeight}
                initialValue=""
                onChange={setText}
              />
            </Box>
            <Box height={CREATE_ISSUE_DIALOG_ERROR_ROWS}>
              <Text color="red">{error ? `Error: ${error}` : null}</Text>
            </Box>
            <Box
              height={CREATE_ISSUE_DIALOG_FOOTER_ROWS}
              flexDirection="row"
              justifyContent="flex-end"
            >
              <Text>Cancel(Esc) | </Text>
              <Text
                dimColor={!hasTitle}
                color={hasTitle ? DialogConfirmColor : undefined}
              >
                Confirm(Ctrl+D)
              </Text>
            </Box>
          </>
        )}
      </Box>
    </EmptyArea>
  );
}
