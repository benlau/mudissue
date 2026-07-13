import { defineMessages } from "react-intl";
import { ExtractContentIntoNewIssueHelper } from "../../helpers/ExtractContentIntoNewIssueHelper.ts";
import { intl } from "../../intl.ts";
import type { PaletteCommand } from "../../types/PaletteCommand.ts";

const messages = defineMessages({
  label: {
    id: "views.paletteCommands.extractContentIntoNewIssue.label",
    defaultMessage: "Extract Content into New Issue",
  },
  description: {
    id: "views.paletteCommands.extractContentIntoNewIssue.description",
    defaultMessage:
      "Cut the selected markdown lines into a new sub-issue of the current issue",
  },
});

export class ExtractContentIntoNewIssuePaletteCommand implements PaletteCommand {
  readonly label = intl.formatMessage(messages.label);
  readonly key = "extractContentIntoNewIssue";
  readonly description = intl.formatMessage(messages.description);

  async callback(): Promise<void> {
    await new ExtractContentIntoNewIssueHelper().extract();
  }
}

export const extractContentIntoNewIssuePaletteCommand: PaletteCommand =
  new ExtractContentIntoNewIssuePaletteCommand();
