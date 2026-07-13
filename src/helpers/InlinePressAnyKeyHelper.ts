import { createElement } from "react";
import { render } from "ink";
import { AnsiEscapeCode } from "../types/ansi.ts";
import { InlinePressAnyKey } from "../views/components/InlinePressAnyKey.tsx";

export class InlinePressAnyKeyHelper {
  async render(prompt: string): Promise<void> {
    process.stdout.write(AnsiEscapeCode.EXIT_ALTERNATE_SCREEN);
    process.stdout.write("\n");
    return await new Promise<void>((resolve) => {
      const { unmount } = render(
        createElement(InlinePressAnyKey, {
          prompt,
          onDismiss: () => {
            unmount();
            resolve();
          },
        }),
        { stdout: process.stderr },
      );
    });
  }
}
