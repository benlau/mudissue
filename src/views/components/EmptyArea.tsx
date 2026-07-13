import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentProps,
  type MutableRefObject,
  type Ref,
} from "react";
import { Box, Text, measureElement, type DOMElement } from "ink";

export type EmptyAreaProps = ComponentProps<typeof Box>;

/** One terminal column/row of margin outside bordered dialog chrome on each side. */
export const EMPTY_AREA_SIDE_MARGIN = 1;
/** Total width/height added to bordered dialog size for the EmptyArea wrapper. */
export const EMPTY_AREA_EXTRA = EMPTY_AREA_SIDE_MARGIN * 2;

function assignRef<T>(ref: Ref<T> | undefined, value: T | null): void {
  if (!ref) return;
  if (typeof ref === "function") {
    ref(value);
  } else {
    (ref as MutableRefObject<T | null>).current = value;
  }
}

/**
 * Borderless Box that measures its laid-out size and paints a full-bleed layer of
 * spaces (default terminal styling) so underlying output does not show through.
 */
export function EmptyArea({ children, ref: userRef, ...boxProps }: EmptyAreaProps) {
  const innerRef = useRef<DOMElement>(null);
  const [dims, setDims] = useState({ width: 0, height: 0 });

  const setRefs = useCallback(
    (node: DOMElement | null) => {
      innerRef.current = node;
      assignRef(userRef, node);
    },
    [userRef],
  );

  // Re-measure after every commit that may change layout; setDims is a no-op when size unchanged.
  // eslint-disable-next-line react-hooks/exhaustive-deps -- measureElement after layout, deps would be incomplete
  useLayoutEffect(() => {
    const node = innerRef.current;
    if (!node) return;
    const next = measureElement(node);
    setDims((prev) =>
      prev.width === next.width && prev.height === next.height ? prev : next,
    );
  });

  const { width, height } = dims;
  const fillRows =
    width > 0 && height > 0
      ? Array.from({ length: height }, (_, row) => (
          <Text key={row}>{" ".repeat(width)}</Text>
        ))
      : null;

  return (
    <Box ref={setRefs} {...boxProps}>
      {fillRows ? (
        <Box
          position="absolute"
          marginTop={0}
          marginLeft={0}
          width={width}
          height={height}
          flexDirection="column"
        >
          {fillRows}
        </Box>
      ) : null}
      {children}
    </Box>
  );
}
