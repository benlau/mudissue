import stringWidth from "string-width";
import { useInput, Box, Text } from "ink";
import { defineMessages, useIntl } from "react-intl";
import { InteractiveTextInput } from "./InteractiveTextInput.tsx";
import {
  EMPTY_AREA_EXTRA,
  EMPTY_AREA_SIDE_MARGIN,
  EmptyArea,
} from "./EmptyArea.tsx";
import {
  mediumDialogLayout,
  useDialogLayout,
} from "../hooks/useDialogLayout.ts";
import { useTextInputDialogStore } from "../../store/TextInputDialogStore.ts";
import { PopupNames, usePopupStore } from "../../store/PopupStore.ts";
import { DefaultTheme, DialogConfirmColor } from "../../types/Theme.ts";

const DIALOG_HEIGHT = 8;

const messages = defineMessages({
  cancelHint: {
    id: "views.textInputDialog.cancelHint",
    defaultMessage: "Cancel(Esc)",
  },
  confirmHint: {
    id: "views.textInputDialog.confirmHint",
    defaultMessage: "Confirm(Enter)",
  },
});

export function TextInputDialog() {
  const intl = useIntl();
  const isOpen = useTextInputDialogStore((s) => s.isDialogOpen);
  const title = useTextInputDialogStore((s) => s.title);
  const prompt = useTextInputDialogStore((s) => s.prompt);
  const placeholder = useTextInputDialogStore((s) => s.placeholder);
  const confirmLabel = useTextInputDialogStore((s) => s.confirmLabel);
  const value = useTextInputDialogStore((s) => s.value);
  const error = useTextInputDialogStore((s) => s.error);
  const inputKey = useTextInputDialogStore((s) => s.inputKey);
  const setValue = useTextInputDialogStore((s) => s.setValue);
  const close = useTextInputDialogStore((s) => s.close);
  const confirm = useTextInputDialogStore((s) => s.confirm);
  const latestPopup = usePopupStore((s) => s.latestPopup);
  const isLatestPopup = latestPopup === PopupNames.TextInputDialog;

  const { width, height, left, top } = useDialogLayout({
    ...mediumDialogLayout,
    minHeight: DIALOG_HEIGHT,
    maxHeight: DIALOG_HEIGHT,
  });
  const inputMaxDisplayWidth = Math.max(4, width - 4 - stringWidth(prompt));
  const confirmHint =
    confirmLabel != null
      ? `${confirmLabel}(Enter)`
      : intl.formatMessage(messages.confirmHint);

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
      marginLeft={Math.max(0, left - EMPTY_AREA_SIDE_MARGIN)}
      marginTop={Math.max(0, top - EMPTY_AREA_SIDE_MARGIN)}
      width={width + EMPTY_AREA_EXTRA}
      height={height + EMPTY_AREA_EXTRA}
      flexDirection="column"
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
        paddingX={2}
        paddingTop={0}
        paddingBottom={0}
      >
        <Box position="absolute" marginTop={-1} marginLeft={1}>
          <Text color={DefaultTheme.accents.orange}>{title}</Text>
        </Box>
        <Box marginTop={1}>
          <Text>{prompt}</Text>
          <InteractiveTextInput
            key={inputKey}
            isActive={isLatestPopup}
            history={[]}
            initialValue={value}
            onChange={setValue}
            onSubmit={confirm}
            placeholder={placeholder}
            maxDisplayWidth={inputMaxDisplayWidth}
          />
        </Box>
        <Box marginTop={1} height={2}>
          <Text color="red">{error ? `Error: ${error}` : null}</Text>
        </Box>
        <Box marginTop={1} flexDirection="row" justifyContent="flex-end">
          <Text>{intl.formatMessage(messages.cancelHint)} | </Text>
          <Text color={DialogConfirmColor}>{confirmHint}</Text>
        </Box>
      </Box>
    </EmptyArea>
  );
}
