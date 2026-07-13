import React, { act } from "react";
import { afterEach, describe, expect, it, jest } from "@jest/globals";
import { cleanup, render } from "ink-testing-library";
import { LineListPickerView } from "../../../src/views/components/LineListPickerView.tsx";
import { AnsiEscapeCode } from "../../../src/types/ansi.ts";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

afterEach(() => {
  act(() => {
    cleanup();
  });
});

describe("LineListPickerView", () => {
  it("renders visible lines up to height", () => {
    let view: ReturnType<typeof render>;
    act(() => {
      view = render(
        <LineListPickerView
          lines={["a", "b", "c"]}
          width={4}
          height={2}
          initialSelectedIndex={0}
        />,
      );
    });
    const frame = view!.lastFrame() ?? "";
    expect(frame).toContain("a");
    expect(frame).toContain("b");
    expect(frame).not.toContain("c");
  });

  it("scrolls to show Cancel at end without showing it on first page", async () => {
    const onSelected = jest.fn();
    let view: ReturnType<typeof render>;
    act(() => {
      view = render(
        <LineListPickerView
          lines={["alpha", "beta", "gamma", "Cancel"]}
          width={8}
          height={2}
          initialSelectedIndex={0}
          onSelected={onSelected}
        />,
      );
    });
    const firstFrame = view!.lastFrame() ?? "";
    expect(firstFrame).toContain("alpha");
    expect(firstFrame).not.toContain("Cancel");

    for (let i = 0; i < 3; i++) {
      await act(async () => {
        view!.stdin.write(AnsiEscapeCode.CURSOR_DOWN);
        await Promise.resolve();
      });
    }
    const scrolledFrame = view!.lastFrame() ?? "";
    expect(scrolledFrame).toContain("Cancel");
    expect(scrolledFrame).not.toContain("alpha");

    await act(async () => {
      view!.stdin.write("\r");
      await Promise.resolve();
    });
    expect(onSelected).toHaveBeenCalledTimes(1);
    expect(onSelected).toHaveBeenCalledWith(3);
  });

  it("invokes onSelected with current index on Enter", () => {
    const onSelected = jest.fn();
    let view: ReturnType<typeof render>;
    act(() => {
      view = render(
        <LineListPickerView
          lines={["only"]}
          width={6}
          height={1}
          initialSelectedIndex={0}
          onSelected={onSelected}
        />,
      );
    });
    act(() => {
      view!.stdin.write("\r");
    });
    expect(onSelected).toHaveBeenCalledTimes(1);
    expect(onSelected).toHaveBeenCalledWith(0);
  });
});
