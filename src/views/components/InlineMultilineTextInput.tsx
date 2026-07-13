import { Box, Text, useInput } from "ink";
import {
  MultilineInteractiveTextInput,
  useMultilineInteractiveTextInputHandle,
} from "./MultilineInteractiveTextInput.tsx";
import { useTerminalSize } from "../hooks/useTerminal.ts";

const INLINE_MULTILINE_TEXT_INPUT_HEIGHT = 5;

export type InlineMultilineTextInputProps = {
  prompt: string;
  hint?: string;
  onSubmit: (content: string) => void;
  onCancel: () => void;
};

export function InlineMultilineTextInput({
  prompt,
  hint,
  onSubmit,
  onCancel,
}: InlineMultilineTextInputProps) {
  const { cols } = useTerminalSize();
  const handle = useMultilineInteractiveTextInputHandle();

  useInput((input, key) => {
    if (key.escape || (key.ctrl && input === "c")) {
      onCancel();
      return;
    }
    if (key.ctrl && input.toLowerCase() === "d") {
      onSubmit(handle.getState().getText());
    }
  });

  return (
    <Box flexDirection="column">
      <Text>{prompt}</Text>
      {hint != null && hint !== "" ? <Text dimColor>{hint}</Text> : null}
      <MultilineInteractiveTextInput
        handle={handle}
        isActive
        width={cols}
        height={INLINE_MULTILINE_TEXT_INPUT_HEIGHT}
        onChange={() => {}}
      />
    </Box>
  );
}
