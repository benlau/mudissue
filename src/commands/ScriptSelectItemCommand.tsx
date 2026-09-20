import type { Argv } from "yargs";
import { defineMessages } from "react-intl";
import { intl } from "../intl.ts";
import { FileService } from "../services/FileService.ts";
import { LoggerService } from "../services/LoggerService.ts";
import { Command, outputJsonMode, type HeadlessArgv } from "./Command.ts";
import type {
  ErrorResponse,
  ScriptSelectItemCommandSuccessResult,
  SuccessResponse,
} from "../types/Response.ts";

export type ScriptSelectItemCommandSuccessResponse =
  SuccessResponse<ScriptSelectItemCommandSuccessResult>;

const DEFAULT_SEPARATOR = ",";
const DEFAULT_TITLE = "Select item";

const msg = defineMessages({
  scriptSelectItemDescribe: {
    id: "cli.script.selectItem.describe",
    defaultMessage: "Select an item from a list for use in shell scripts",
  },
  optionItems: {
    id: "cli.script.selectItem.option.items",
    defaultMessage: "Separator-joined list of items to choose from",
  },
  optionSeparator: {
    id: "cli.script.selectItem.option.separator",
    defaultMessage: "Separator used to split --items",
  },
  optionDefault: {
    id: "cli.script.selectItem.option.default",
    defaultMessage: "Item initially selected in the picker UI",
  },
  optionTitle: {
    id: "cli.script.selectItem.option.title",
    defaultMessage: "Picker title",
  },
  optionOutput: {
    id: "cli.script.selectItem.option.output",
    defaultMessage: "Write the selected item to this file",
  },
  itemsEmpty: {
    id: "cli.script.selectItem.itemsEmpty",
    defaultMessage: "--items must contain at least one item",
  },
  cancelled: {
    id: "cli.script.selectItem.cancelled",
    defaultMessage: "Item selection cancelled",
  },
});

export function splitItems(raw: string, separator: string): string[] {
  return raw.split(separator).filter((item) => item.length > 0);
}

export class ScriptSelectItemCommand extends Command {
  name = "script select-item";

  static register(yargs: Argv): Argv {
    const cmd = new ScriptSelectItemCommand();
    return yargs.command(
      "select-item",
      intl.formatMessage(msg.scriptSelectItemDescribe),
      (builder) =>
        builder
          .option("items", {
            type: "string",
            demandOption: true,
            describe: intl.formatMessage(msg.optionItems),
          })
          .option("separator", {
            type: "string",
            default: DEFAULT_SEPARATOR,
            describe: intl.formatMessage(msg.optionSeparator),
          })
          .option("default", {
            type: "string",
            describe: intl.formatMessage(msg.optionDefault),
          })
          .option("title", {
            type: "string",
            describe: intl.formatMessage(msg.optionTitle),
          })
          .option("output", {
            type: "string",
            describe: intl.formatMessage(msg.optionOutput),
          }),
      async (argv) => {
        const outputJson = outputJsonMode(argv as HeadlessArgv);
        cmd.preprocessArgument(cmd.name, {
          debug: argv.debug === true,
          json: outputJson,
          interactive: true,
        });
        const result = await cmd.runCommand(
          { outputJson },
          argv.items,
          argv.separator,
          argv.default,
          argv.title,
          argv.output,
        );
        if (result && typeof result === "object" && result.status === "error") {
          process.exitCode = 1;
        }
      },
    );
  }

  async command(
    itemsRaw: string,
    separator: string = DEFAULT_SEPARATOR,
    defaultItem?: string,
    title?: string,
    outputPath?: string,
  ): Promise<ScriptSelectItemCommandSuccessResponse | ErrorResponse> {
    const fileService = FileService.getInstance();
    const loggerService = LoggerService.getInstance();

    const items = splitItems(itemsRaw, separator);
    if (items.length === 0) {
      this.throwException(
        "COMMAND_INVALID_ARG",
        intl.formatMessage(msg.itemsEmpty),
        { argument: "items", value: itemsRaw },
      );
    }

    const pickerTitle =
      title !== undefined && title.trim() !== "" ? title : DEFAULT_TITLE;
    const picked = await this.askUserPickItem(items, {
      title: pickerTitle,
      defaultItem,
    });
    if (picked == null) {
      return {
        status: "error",
        error: {
          code: "SCRIPT_SELECT_ITEM_CANCELLED",
          message: intl.formatMessage(msg.cancelled),
        },
      };
    }

    if (outputPath !== undefined && outputPath.trim() !== "") {
      await fileService.writeFile(outputPath, `${picked}\n`, "utf-8");
    } else {
      loggerService.info(picked);
    }

    return {
      status: "ok",
      result: { selectedItem: picked },
    };
  }
}
