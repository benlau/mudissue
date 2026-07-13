import { defineMessages } from "react-intl";
import { intl } from "../intl.ts";
import { InlinePressAnyKeyHelper } from "./InlinePressAnyKeyHelper.ts";
import { useReactSessionStore } from "../store/ReactSessionStore.ts";
import { useAlertDialogStore } from "../store/AlertDialogStore.ts";
import { useAppStore } from "../store/AppStore.ts";
import { useConfirmationDialogStore } from "../store/ConfirmationDialogStore.ts";
import { useCurrentTrackerRepoStore } from "../store/CurrentTrackerRepoStore.ts";
import type { CustomScriptEntry } from "../types/CustomScript.ts";
import type { PaletteCommand } from "../types/PaletteCommand.ts";
import { CustomScriptLauncher } from "../utils/launchers/CustomScriptLauncher.ts";

const messages = defineMessages({
  confirmTitle: {
    id: "views.paletteCommands.runCustomScript.confirmTitle",
    defaultMessage: "Run script?",
  },
  confirmMessage: {
    id: "views.paletteCommands.runCustomScript.confirmMessage",
    defaultMessage: "Run: {runLine}",
  },
  confirmLabel: {
    id: "views.paletteCommands.runCustomScript.confirmLabel",
    defaultMessage: "Run",
  },
  pressAnyKeyPrompt: {
    id: "views.paletteCommands.runCustomScript.pressAnyKeyPrompt",
    defaultMessage: "Press any key to back to mudissue",
  },
});

export class CustomScriptPaletteHelper {
  constructor(
    private readonly customScriptLauncher: CustomScriptLauncher = new CustomScriptLauncher(),
    private readonly inlinePressAnyKeyHelper: InlinePressAnyKeyHelper = new InlinePressAnyKeyHelper(),
  ) {}

  buildPaletteCommands(scripts: CustomScriptEntry[]): PaletteCommand[] {
    return scripts.map((script, index) => ({
      key: this.customScriptPaletteCommandKey(index + 1),
      label: script.name,
      description: script.description ?? "",
      callback: () => this.runScript(script),
    }));
  }

  async runScript(script: CustomScriptEntry): Promise<void> {
    const issues = useAppStore.getState().getSelectedIssues();
    if (issues.length === 0) {
      return;
    }

    const runLine = this.customScriptLauncher.formatRunLine(
      script.command,
      script.args,
    );

    const confirmResult = await useConfirmationDialogStore.getState().open({
      title: intl.formatMessage(messages.confirmTitle),
      message: intl.formatMessage(messages.confirmMessage, { runLine }),
      confirmLabel: intl.formatMessage(messages.confirmLabel),
    });
    if (confirmResult.type !== "accepted") {
      return;
    }

    const executableError = await this.customScriptLauncher.validateExecutable(
      script.command,
    );
    if (executableError != null) {
      await useAlertDialogStore.getState().open(executableError);
      return;
    }

    const repo = await useCurrentTrackerRepoStore
      .getState()
      .getCurrentTrackerRepo();
    const { debug } = useAppStore.getState();

    await useReactSessionStore.getState().suspend();

    try {
      process.stdout.write(`Running ${runLine}\n`);
      await this.customScriptLauncher.run(script, issues, repo, { debug });
    } finally {
      await this.inlinePressAnyKeyHelper.render(
        intl.formatMessage(messages.pressAnyKeyPrompt),
      );
      useReactSessionStore.getState().resume();
    }
  }

  private customScriptPaletteCommandKey(oneBasedIndex: number): string {
    return `custom-script-${oneBasedIndex}`;
  }
}
