import { defineMessages } from "react-intl";
import { intl } from "../../intl.ts";
import { useAppStore } from "../../store/AppStore.ts";
import { useCreateIssueDialogStore } from "../../store/CreateIssueDialogStore.ts";
import type { PaletteCommand } from "../../types/PaletteCommand.ts";

const messages = defineMessages({
  label: {
    id: "views.paletteCommands.createSubissue.label",
    defaultMessage: "Create Sub-issue",
  },
  description: {
    id: "views.paletteCommands.createSubissue.description",
    defaultMessage: "Create a sub-issue linked to the selected issue",
  },
});

export class CreateSubissuePaletteCommand implements PaletteCommand {
  readonly label = intl.formatMessage(messages.label);
  readonly key = "createSubissue";
  readonly description = intl.formatMessage(messages.description);

  async callback(): Promise<void> {
    const issue = useAppStore.getState().getSelectedIssues()[0];
    if (issue == null) {
      return;
    }

    useCreateIssueDialogStore.getState().open(issue);
  }
}

export const createSubissuePaletteCommand: PaletteCommand =
  new CreateSubissuePaletteCommand();
