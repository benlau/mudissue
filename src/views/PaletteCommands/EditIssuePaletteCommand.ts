import { defineMessages } from "react-intl";
import { EditIssueMarkdownFileHelper } from "../../helpers/EditIssueMarkdownFileHelper.ts";
import { intl } from "../../intl.ts";
import { useAppStore } from "../../store/AppStore.ts";
import type { PaletteCommand } from "../../types/PaletteCommand.ts";

const messages = defineMessages({
  label: {
    id: "views.paletteCommands.editIssue.label",
    defaultMessage: "Edit",
  },
  description: {
    id: "views.paletteCommands.editIssue.description",
    defaultMessage: "Edit the selected issue in the text editor",
  },
});

export class EditIssuePaletteCommand implements PaletteCommand {
  readonly label = intl.formatMessage(messages.label);
  readonly key = "editIssue";
  readonly shortcutKey = "e";
  readonly description = intl.formatMessage(messages.description);

  async callback(): Promise<void> {
    const issue = useAppStore.getState().getSelectedIssues()[0];
    if (issue == null) {
      return;
    }

    await EditIssueMarkdownFileHelper.edit(issue);
  }
}

export const editIssuePaletteCommand: PaletteCommand =
  new EditIssuePaletteCommand();
