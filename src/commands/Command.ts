import * as path from "path";
import {
  isErrorResponse,
  ErrorResponseAccessor,
  type SuccessResponse,
  type ErrorResponse,
} from "../types/Response.ts";
import type { ErrorCode, ErrorPayload } from "../types/errors.ts";
import { render } from "ink";
import { createElement } from "react";
import { InlineMultilineTextInput } from "../views/components/InlineMultilineTextInput.tsx";
import { InlineConfirmation } from "../views/components/InlineConfirmation.tsx";
import { InlineIssuePicker } from "../views/components/InlineIssuePicker.tsx";
import { ScriptPickItemView } from "../views/components/ScriptPickItemView.tsx";
import type { IssueFolder } from "../types/Issue.ts";
import { ShellService } from "../services/ShellService.ts";
import {
  DebugLoggerService,
  LoggerService,
  SilentLogger,
} from "../services/LoggerService.ts";
import { defineMessages } from "react-intl";
import { intl } from "../intl.ts";

export type CommandResponse = SuccessResponse<unknown> | ErrorResponse;

export type CommandRunOptions = { outputJson: boolean };

export type CommandPreprocessArgumentOptions = {
  debug: boolean;
  json: boolean;
  interactive: boolean;
};

export type HeadlessArgv = {
  debug?: boolean;
  json?: boolean;
};

export function outputJsonMode(argv: HeadlessArgv): boolean {
  return argv.json === true || process.env.MUDISSUE_OUTPUT_JSON === "true";
}

const msg = defineMessages({
  errorJsonInteractive: {
    id: "cli.error.json.interactive",
    defaultMessage: 'Command "{command}" does not support --json',
  },
});

/** The common command interface
 *
 * Remarks
 * - Never call process.exit(), you should throw an error instead.
 */

export abstract class Command {
  abstract name: string;

  constructor() {}

  /**
   * Validates CLI mode (e.g. `--json` vs interactive TUI) and configures
   * {@link LoggerService} for this invocation.
   */
  preprocessArgument(
    commandName: string,
    opts: CommandPreprocessArgumentOptions,
  ): void {
    if (opts.json && opts.interactive) {
      throw new Error(
        intl.formatMessage(msg.errorJsonInteractive, { command: commandName }),
      );
    }

    const debug = opts.debug;
    const json = opts.json;
    const interactive = opts.interactive;

    let loggerService: LoggerService;
    if (debug) {
      const debugLogger = new DebugLoggerService();
      const logPath = path.join(
        ShellService.getInstance().cwd(),
        "mudissue-debug.log",
      );
      debugLogger.setOutputFile(logPath);
      debugLogger.setOutputFileEnabled(true);
      debugLogger.setOutputConsoleEnabled(!json && !interactive);
      loggerService = debugLogger;
      LoggerService.setInstance(loggerService);
    } else if (json) {
      loggerService = new SilentLogger();
      LoggerService.setInstance(loggerService);
    }
    // Non-debug, non-json: use existing LoggerService singleton (no setInstance).
  }

  abstract command(...args: unknown[]): Promise<CommandResponse | void>;

  async runCommand(
    option: CommandRunOptions,
    ...args: unknown[]
  ): Promise<CommandResponse | void> {
    let result: CommandResponse | void;
    try {
      result = await this.command(...args);
    } catch (err) {
      if (isErrorResponse(err)) {
        result = err;
      } else {
        const error = err instanceof Error ? err : new Error(String(err));
        result = ErrorResponseAccessor.fromError(error).get();
      }
    }

    if (!option.outputJson && result && isErrorResponse(result)) {
      process.stderr.write(result.error.message + "\n");
      process.exitCode = 1;
    }

    if (option.outputJson) {
      process.stdout.write(JSON.stringify(result));
    }
    return result;
  }

  protected throwException<K extends ErrorCode>(
    code: K,
    message: string,
    details?: ErrorPayload<K>,
  ): never {
    const response: ErrorResponse = {
      status: "error",
      error: { code, message, ...(details && { details }) },
    };
    throw response;
  }

  protected async askUserTextContent(
    prompt: string,
    hint?: string,
  ): Promise<string | null> {
    return await new Promise<string | null>((resolve) => {
      const { unmount } = render(
        createElement(InlineMultilineTextInput, {
          prompt,
          hint,
          onSubmit: (content) => {
            unmount();
            resolve(content);
          },
          onCancel: () => {
            unmount();
            resolve(null);
          },
        }),
        { stdout: process.stderr },
      );
    });
  }

  protected async askUserConfirmation(message: string): Promise<boolean> {
    return await new Promise<boolean>((resolve) => {
      const { unmount } = render(
        createElement(InlineConfirmation, {
          message,
          onSelect: (value: boolean) => {
            unmount();
            resolve(value);
          },
        }),
        { stdout: process.stderr },
      );
    });
  }

  protected async askUserPickIssue(
    issues: IssueFolder[],
    title: string,
  ): Promise<IssueFolder | null> {
    return await new Promise((resolve) => {
      const { unmount } = render(
        createElement(InlineIssuePicker, {
          title,
          issues,
          onSelect: (issue: IssueFolder | null) => {
            unmount();
            if (issue == null) {
              process.exitCode = 1;
            }
            resolve(issue);
          },
        }),
        { stdout: process.stderr },
      );
    });
  }

  protected async askUserPickItem(
    items: string[],
    options: { title: string; defaultItem?: string },
  ): Promise<string | null> {
    return await new Promise((resolve) => {
      const { unmount } = render(
        createElement(ScriptPickItemView, {
          title: options.title,
          items,
          defaultItem: options.defaultItem,
          onSelect: (selected: string | null) => {
            unmount();
            if (selected == null) {
              process.exitCode = 1;
            }
            resolve(selected);
          },
        }),
        { stdout: process.stderr },
      );
    });
  }
}
