import { defineMessages } from "react-intl";
import { intl } from "../../intl.ts";
import { useCreateIssueFromFileDialogStore } from "../../store/CreateIssueFromFileDialogStore.ts";
import type { PaletteCommand } from "../../types/PaletteCommand.ts";

const messages = defineMessages({
  label: {
    id: "views.paletteCommands.createIssueFromFile.label",
    defaultMessage: "Import Issue from file",
  },
  description: {
    id: "views.paletteCommands.createIssueFromFile.description",
    defaultMessage: "Create an issue by importing a markdown file",
  },
});

export class CreateIssueFromFilePaletteCommand implements PaletteCommand {
  readonly label = intl.formatMessage(messages.label);
  readonly key = "createIssueFromFile";
  readonly description = intl.formatMessage(messages.description);

  async callback(): Promise<void> {
    await useCreateIssueFromFileDialogStore.getState().open();
  }
}

export const createIssueFromFilePaletteCommand: PaletteCommand =
  new CreateIssueFromFilePaletteCommand();
