import { defineMessages } from "react-intl";
import { intl } from "../../intl.ts";
import { CustomScriptPaletteHelper } from "../../helpers/CustomScriptPaletteHelper.ts";
import { useAlertDialogStore } from "../../store/AlertDialogStore.ts";
import { useAppStore } from "../../store/AppStore.ts";
import { useCurrentTrackerRepoStore } from "../../store/CurrentTrackerRepoStore.ts";
import { useGlobalConfigStore } from "../../store/GlobalConfigStore.ts";
import type { CustomScriptEntry } from "../../types/CustomScript.ts";
import type { PaletteCommand } from "../../types/PaletteCommand.ts";
import { TrackerRepoConfigAccessor } from "../../types/Tracker.ts";
import {
  PickItemDialogResponseType,
  usePickItemDialogStore,
} from "../components/PickItemDialog.tsx";

const messages = defineMessages({
  label: {
    id: "views.paletteCommands.runCustomScript.label",
    defaultMessage: "Run Custom Script",
  },
  description: {
    id: "views.paletteCommands.runCustomScript.description",
    defaultMessage: "Run a predefined script from mud.conf on selected issues",
  },
  pickDialogTitle: {
    id: "views.paletteCommands.runCustomScript.pickDialogTitle",
    defaultMessage: "Run Custom Script",
  },
  pickDialogFooterLabel: {
    id: "views.paletteCommands.runCustomScript.pickDialogFooterLabel",
    defaultMessage: "Cancel'<Esc>'",
  },
  noScriptsAlert: {
    id: "views.paletteCommands.runCustomScript.noScriptsAlert",
    defaultMessage: "No custom scripts configured in mud.conf.",
  },
});

export class RunCustomScriptPaletteCommand implements PaletteCommand {
  readonly label = intl.formatMessage(messages.label);
  readonly key = "runCustomScript";
  readonly description = intl.formatMessage(messages.description);

  constructor(
    private readonly customScriptPaletteHelper: CustomScriptPaletteHelper = new CustomScriptPaletteHelper(),
  ) {}

  async callback(): Promise<void> {
    const issues = useAppStore.getState().getSelectedIssues();
    if (issues.length === 0) {
      return;
    }

    const repo = await useCurrentTrackerRepoStore
      .getState()
      .getCurrentTrackerRepo();
    const globalConfig = await useGlobalConfigStore
      .getState()
      .ensureGlobalConfig();
    const accessor = new TrackerRepoConfigAccessor(repo.config, globalConfig);
    const scripts = accessor.getScripts();
    if (scripts.length === 0) {
      await useAlertDialogStore
        .getState()
        .open(intl.formatMessage(messages.noScriptsAlert));
      return;
    }

    const pickResponse = await usePickItemDialogStore
      .getState()
      .open(scripts, (item) => this.formatScriptDisplay(item), {
        title: intl.formatMessage(messages.pickDialogTitle),
        columns: [
          { minWidth: 20, grow: 1, ellipsisDirection: "right" },
          { minWidth: 24, grow: 2, ellipsisDirection: "left" },
        ],
        footerLabel: intl.formatMessage(messages.pickDialogFooterLabel),
        minWidth: 52,
        maxWidth: 86,
      });

    if (
      pickResponse.type !== PickItemDialogResponseType.Accepted ||
      pickResponse.acceptedValue == null
    ) {
      return;
    }

    await this.customScriptPaletteHelper.runScript(pickResponse.acceptedValue);
  }

  private formatScriptDisplay(script: CustomScriptEntry): string[] {
    const description = script.description?.trim();
    if (description != null && description !== "") {
      return [script.name, description];
    }
    return [script.name];
  }
}

export const runCustomScriptPaletteCommand: PaletteCommand =
  new RunCustomScriptPaletteCommand();
