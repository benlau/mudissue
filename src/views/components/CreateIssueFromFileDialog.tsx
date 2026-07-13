import { useState, useEffect, useCallback, useRef } from "react";
import stringWidth from "string-width";
import { useInput, Box, Text } from "ink";
import { defineMessages, useIntl } from "react-intl";
import { InteractiveTextInput } from "./InteractiveTextInput.tsx";
import {
  EMPTY_AREA_EXTRA,
  EMPTY_AREA_SIDE_MARGIN,
  EmptyArea,
} from "./EmptyArea.tsx";
import { useDialogLayout } from "../hooks/useDialogLayout.ts";
import { useCreateIssueFromFileDialogStore } from "../../store/CreateIssueFromFileDialogStore.ts";
import { PopupNames, usePopupStore } from "../../store/PopupStore.ts";
import { CreateIssueHelper } from "../../helpers/CreateIssueHelper.ts";
import { DefaultTheme, DialogConfirmColor } from "../../types/Theme.ts";

const DIALOG_MIN_WIDTH = 52;
const DIALOG_HEIGHT = 8;

const messages = defineMessages({
  fileInputPrefix: {
    id: "views.createIssueFromFile.input.filePrefix",
    defaultMessage: "File: ",
  },
});

export function CreateIssueFromFileDialog() {
  const isOpen = useCreateIssueFromFileDialogStore((s) => s.isDialogOpen);
  const close = useCreateIssueFromFileDialogStore((s) => s.close);
  const confirm = useCreateIssueFromFileDialogStore((s) => s.confirm);
  const createIssueHelper = useRef(new CreateIssueHelper()).current;
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [inputKey, setInputKey] = useState(0);
  const intl = useIntl();
  const { width, height, left, top } = useDialogLayout({
    minWidth: DIALOG_MIN_WIDTH + EMPTY_AREA_EXTRA,
    minHeight: DIALOG_HEIGHT + EMPTY_AREA_EXTRA,
  });
  const borderedWidth = width - EMPTY_AREA_EXTRA;
  const borderedHeight = height - EMPTY_AREA_EXTRA;
  const latestPopup = usePopupStore((s) => s.latestPopup);
  const isLatestPopup = latestPopup === PopupNames.CreateIssueFromFileDialog;
  const fileInputPrefix = intl.formatMessage(messages.fileInputPrefix);
  const inputMaxDisplayWidth = Math.max(
    4,
    DIALOG_MIN_WIDTH - 2 - stringWidth(fileInputPrefix),
  );

  useEffect(() => {
    if (isOpen) {
      setValue("");
      setError(null);
      setInputKey((k) => k + 1);
    }
  }, [isOpen]);

  const handleSubmit = useCallback(
    async (val: string) => {
      setError(null);
      const trimmed = val.trim();
      if (!trimmed) {
        setError("File path is required.");
        return;
      }
      try {
        await createIssueHelper.createIssue(undefined, trimmed);
        setValue("");
        confirm();
      } catch (err) {
        const message =
          err instanceof Error ? err.message : String(err);
        setError(message);
      }
    },
    [createIssueHelper, confirm],
  );

  useInput(
    (_input, key) => {
      if (!isOpen) return;
      if (key.escape) {
        close();
      }
    },
    { isActive: isOpen && isLatestPopup },
  );

  if (!isOpen) return null;

  return (
    <EmptyArea
      position="absolute"
      marginLeft={left}
      marginTop={top}
      width={width}
      height={height}
      flexDirection="column"
    >
      <Box
        flexDirection="column"
        marginLeft={EMPTY_AREA_SIDE_MARGIN}
        marginTop={EMPTY_AREA_SIDE_MARGIN}
        width={borderedWidth}
        height={borderedHeight}
        borderStyle="single"
        borderColor={DefaultTheme.accents.green}
        borderTop
        borderBottom
        borderLeft
        borderRight
        paddingX={2}
        paddingTop={0}
        paddingBottom={0}
      >
        <Box position="absolute" marginTop={-1} marginLeft={1}>
          <Text color={DefaultTheme.accents.orange}>Create Issue From File</Text>
        </Box>
        <Box marginTop={1}>
          <Text>{fileInputPrefix}</Text>
          <InteractiveTextInput
            key={inputKey}
            isActive={isLatestPopup}
            history={[]}
            initialValue=""
            onChange={setValue}
            onSubmit={() => {
              void handleSubmit(value);
            }}
            placeholder="Path to file"
            maxDisplayWidth={inputMaxDisplayWidth}
          />
        </Box>
        <Box marginTop={1} height={3}>
          <Text color="red">
            {error ? `\nError: ${error}` : null}
          </Text>
        </Box>
        <Box marginTop={1} flexDirection="row" justifyContent="flex-end">
          <Text>Cancel(Esc) | </Text>
          <Text color={DialogConfirmColor}>Create(Enter)</Text>
        </Box>
      </Box>
    </EmptyArea>
  );
}
