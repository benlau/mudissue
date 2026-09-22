import type { Argv } from "yargs";
import { defineMessages } from "react-intl";
import { MUDISSUE_SCRIPT_VARIABLES_URL } from "../constants.ts";
import { intl } from "../intl.ts";
import { LoggerService } from "../services/LoggerService.ts";
import { RegistryService } from "../services/RegistryService.ts";
import { FrontmatterValidator } from "../utils/validators/FrontmatterValidator.ts";
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
  optionSetVar: {
    id: "cli.script.option.setVar",
    defaultMessage: "Write the selected value to this script variable",
  },
  invalidVarName: {
    id: "cli.script.error.invalidVarName",
    defaultMessage:
      "Invalid variable name. Use only letters, numbers, underscores, and hyphens.",
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
          .option("set-var", {
            type: "string",
            describe: intl.formatMessage(msg.optionSetVar),
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
          argv["set-var"],
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
    setVar?: string,
  ): Promise<ScriptSelectItemCommandSuccessResponse | ErrorResponse> {
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
      if (
        setVar !== undefined &&
        setVar.trim() !== "" &&
        FrontmatterValidator.isValidPropertyKey(setVar)
      ) {
        await RegistryService.getInstance().delete(
          MUDISSUE_SCRIPT_VARIABLES_URL,
          "system",
          setVar,
        );
      }
      return {
        status: "error",
        error: {
          code: "SCRIPT_SELECT_ITEM_CANCELLED",
          message: intl.formatMessage(msg.cancelled),
        },
      };
    }

    if (setVar !== undefined && setVar.trim() !== "") {
      if (!FrontmatterValidator.isValidPropertyKey(setVar)) {
        return {
          status: "error",
          error: {
            code: "SCRIPT_VAR_INVALID_NAME",
            message: intl.formatMessage(msg.invalidVarName),
            details: { name: setVar },
          },
        };
      }
      await RegistryService.getInstance().set(
        setVar,
        picked,
        MUDISSUE_SCRIPT_VARIABLES_URL,
        "system",
      );
    } else {
      loggerService.info(picked);
    }

    return {
      status: "ok",
      result: { selectedItem: picked },
    };
  }
}
