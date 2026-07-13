import { Box, Text, useInput } from "ink";

export type InlinePressAnyKeyProps = {
  prompt: string;
  onDismiss: () => void;
};

export function InlinePressAnyKey(props: InlinePressAnyKeyProps) {
  useInput(() => {
    props.onDismiss();
  });

  return (
    <Box flexDirection="column">
      <Text>{props.prompt}</Text>
    </Box>
  );
}
