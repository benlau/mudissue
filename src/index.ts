#!/usr/bin/env node
import yargs, { type Argv } from "yargs";
import { hideBin } from "yargs/helpers";
import { defineMessages } from "react-intl";
import { intl } from "./intl.ts";
import { InitCommand } from "./commands/InitCommand.ts";
import { IssueCreateCommand } from "./commands/IssueCreateCommand.ts";
import { IssueEditCommand } from "./commands/IssueEditCommand.ts";
import { IssueViewCommand } from "./commands/IssueViewCommand.tsx";
import { IssueSetPropertyCommand } from "./commands/IssueSetPropertyCommand.ts";
import { IssueGetPropertyCommand } from "./commands/IssueGetPropertyCommand.ts";
import { IssueCatCommand } from "./commands/IssueCatCommand.ts";
import { IssueSearchCommand } from "./commands/IssueSearchCommand.ts";
import { IssueRemoveCommand } from "./commands/IssueRemoveCommand.ts";
import { IssueArchiveCommand } from "./commands/IssueArchiveCommand.ts";
import { IssueMergeCommand } from "./commands/IssueMergeCommand.ts";
import { IssueLocateCommand } from "./commands/IssueLocateCommand.ts";
import { IssueRenameCommand } from "./commands/IssueRenameCommand.ts";
import { IssueChangeLabelCommand } from "./commands/IssueChangeLabelCommand.ts";
import { IssueAttachCommand } from "./commands/IssueAttachCommand.ts";
import { IssueTagCommand } from "./commands/IssueTagCommand.ts";
import { IssueUntagCommand } from "./commands/IssueUntagCommand.ts";
import { IssueCommentCommand } from "./commands/IssueCommentCommand.ts";
import { IssueAppendCommand } from "./commands/IssueAppendCommand.ts";
import { IssuePrependCommand } from "./commands/IssuePrependCommand.ts";
import { IssueTouchCommand } from "./commands/IssueTouchCommand.ts";
import { IssueLinkCommand } from "./commands/IssueLinkCommand.ts";
import { IssueUnlinkCommand } from "./commands/IssueUnlinkCommand.ts";
import { TrackerRepoOpenCommand } from "./commands/TrackerRepoOpenCommand.ts";
import { TrackerRepoLocateCommand } from "./commands/TrackerRepoLocateCommand.ts";
import { IssueBranchCreateCommand } from "./commands/IssueBranchCreateCommand.ts";
import { IssueBranchGetCommand } from "./commands/IssueBranchGetCommand.ts";
import { IssueBranchRemoveCommand } from "./commands/IssueBranchRemoveCommand.ts";
import { TmuxRunCommand } from "./commands/TmuxRunCommand.ts";
import { IssueWorktreeCreateCommand } from "./commands/IssueWorktreeCreateCommand.ts";
import { IssueWorktreeLocateCommand } from "./commands/IssueWorktreeLocateCommand.ts";
import { IssueWorktreeListCommand } from "./commands/IssueWorktreeListCommand.ts";
import { IssueWorktreeCreateGraphCommand } from "./commands/IssueWorktreeCreateGraphCommand.ts";
import { IssueWorktreeRunCommand } from "./commands/IssueWorktreeRunCommand.ts";
import { IssueWorktreeRebaseCommand } from "./commands/IssueWorktreeRebaseCommand.ts";
import { IssueWorktreeMergeCommand } from "./commands/IssueWorktreeMergeCommand.ts";
import { IssueWorktreePushCommand } from "./commands/IssueWorktreePushCommand.ts";
import { IssueWorktreeRemoveCommand } from "./commands/IssueWorktreeRemoveCommand.ts";
import { ViewCommand } from "./commands/ViewCommand.tsx";
import { VersionCommand } from "./commands/VersionCommand.ts";
import { RegistryGetCommand } from "./commands/RegistryGetCommand.ts";
import { RegistryGetCwdCommand } from "./commands/RegistryGetCwdCommand.ts";
import { RegistryGetProjectCommand } from "./commands/RegistryGetProjectCommand.ts";
import { RegistrySetCommand } from "./commands/RegistrySetCommand.ts";
import { RegistrySetCwdCommand } from "./commands/RegistrySetCwdCommand.ts";
import { RegistrySetProjectCommand } from "./commands/RegistrySetProjectCommand.ts";
import { ConfigEditCommand } from "./commands/ConfigEditCommand.ts";
import { ConfigLocateCommand } from "./commands/ConfigLocateCommand.ts";
import { ScriptSelectIssueCommand } from "./commands/ScriptSelectIssueCommand.tsx";
import { useIssueMetadataChangedPostHookStore } from "./store/IssueMetadataChangedPostHookStore.ts";
import { SystemRuleKey } from "./types/rules.ts";
import { BlockedStatusRule } from "./rules/BlockedStatusRule.ts";
import { DuplicatedStatusRule } from "./rules/DuplicatedStatusRule.ts";

function registerSystemRules(): void {
  const store = useIssueMetadataChangedPostHookStore.getState();
  const blockedRule = new BlockedStatusRule();
  const duplicatedRule = new DuplicatedStatusRule();
  store.registerPostHook(
    SystemRuleKey.BlockedStatusRule,
    (issueFolder, newMetadata, oldMetadata) =>
      blockedRule.onMetadataChanged(issueFolder, newMetadata, oldMetadata),
  );
  store.registerPostHook(
    SystemRuleKey.DuplicatedStatusRule,
    (issueFolder, newMetadata, oldMetadata) =>
      duplicatedRule.onMetadataChanged(issueFolder, newMetadata, oldMetadata),
  );
}

registerSystemRules();

const msg = defineMessages({
  globalOptionJson: {
    id: "cli.global.option.json",
    defaultMessage: "Output JSON to stdout",
  },
  globalOptionDebug: {
    id: "cli.global.option.debug",
    defaultMessage: "Enable debug logging to file and optionally console",
  },
  issueDescribe: {
    id: "cli.issue.describe",
    defaultMessage: "Manage issues",
  },
  trackerDescribe: {
    id: "cli.tracker.describe",
    defaultMessage: "Locate or open the current issue tracker",
  },
  branchDescribe: {
    id: "cli.branch.describe",
    defaultMessage: "Manage git branches for issues",
  },
  tmuxDescribe: {
    id: "cli.tmux.describe",
    defaultMessage: "Run tmux actions for an issue",
  },
  worktreeDescribe: {
    id: "cli.worktree.describe",
    defaultMessage: "Manage git worktrees associated with issues",
  },
  registryDescribe: {
    id: "cli.registry.describe",
    defaultMessage: "Read or write mudissue registry values",
  },
  configDescribe: {
    id: "cli.config.describe",
    defaultMessage: "Manage mudissue configuration",
  },
  scriptDescribe: {
    id: "cli.script.describe",
    defaultMessage: "Script-friendly commands",
  },
  demandTracker: {
    id: "cli.demand.tracker",
    defaultMessage: "Specify 'open' or 'locate'",
  },
  demandBranch: {
    id: "cli.demand.branch",
    defaultMessage: "Specify 'create', 'get', or 'remove'",
  },
  demandTmux: {
    id: "cli.demand.tmux",
    defaultMessage: "Specify 'run'",
  },
  demandWorktree: {
    id: "cli.demand.worktree",
    defaultMessage:
      "Specify 'create', 'locate', 'list', 'run', 'rebase', 'merge', 'push', or 'remove'",
  },
  demandIssue: {
    id: "cli.demand.issue",
    defaultMessage:
      "Specify 'create', 'edit', 'view', 'cat', 'set-property', 'get-property', 'search', 'remove', 'archive', 'merge', 'locate', 'rename', 'change-label', 'attach', 'tag', 'untag', 'comment', 'append', 'prepend', 'touch', 'link', 'unlink', 'branch', 'tmux', or 'worktree'",
  },
  demandRegistry: {
    id: "cli.demand.registry",
    defaultMessage: "Specify 'get' or 'set'",
  },
  demandConfig: {
    id: "cli.demand.config",
    defaultMessage: "Specify 'edit' or 'locate'",
  },
  demandScript: {
    id: "cli.demand.script",
    defaultMessage: "Specify 'select-issue'",
  },
  demandRoot: {
    id: "cli.demand.root",
    defaultMessage: "Specify a command. Use --help for usage.",
  },
});

const ISSUE_LEAF_COMMANDS = [
  IssueCreateCommand,
  IssueEditCommand,
  IssueViewCommand,
  IssueSetPropertyCommand,
  IssueGetPropertyCommand,
  IssueCatCommand,
  IssueSearchCommand,
  IssueRemoveCommand,
  IssueArchiveCommand,
  IssueMergeCommand,
  IssueLocateCommand,
  IssueRenameCommand,
  IssueChangeLabelCommand,
  IssueAttachCommand,
  IssueTagCommand,
  IssueUntagCommand,
  IssueCommentCommand,
  IssueAppendCommand,
  IssuePrependCommand,
  IssueTouchCommand,
  IssueLinkCommand,
  IssueUnlinkCommand,
] as const;

const TRACKER_REPO_COMMANDS = [
  TrackerRepoOpenCommand,
  TrackerRepoLocateCommand,
] as const;

const BRANCH_COMMANDS = [
  IssueBranchCreateCommand,
  IssueBranchGetCommand,
  IssueBranchRemoveCommand,
] as const;

const WORKTREE_COMMANDS = [
  IssueWorktreeCreateCommand,
  IssueWorktreeLocateCommand,
  IssueWorktreeListCommand,
  IssueWorktreeCreateGraphCommand,
  IssueWorktreeRunCommand,
  IssueWorktreeRebaseCommand,
  IssueWorktreeMergeCommand,
  IssueWorktreePushCommand,
  IssueWorktreeRemoveCommand,
] as const;

const REGISTRY_COMMANDS = [
  RegistryGetCommand,
  RegistrySetCommand,
  RegistryGetCwdCommand,
  RegistrySetCwdCommand,
  RegistryGetProjectCommand,
  RegistrySetProjectCommand,
] as const;

const CONFIG_COMMANDS = [ConfigEditCommand, ConfigLocateCommand] as const;

let yargsInstance: Argv = yargs(hideBin(process.argv))
  .option("json", {
    type: "boolean",
    global: true,
    default: false,
    describe: intl.formatMessage(msg.globalOptionJson),
  })
  .option("debug", {
    type: "boolean",
    global: true,
    default: false,
    describe: intl.formatMessage(msg.globalOptionDebug),
  });

yargsInstance = InitCommand.register(yargsInstance);
yargsInstance = ViewCommand.register(yargsInstance);
yargsInstance = VersionCommand.register(yargsInstance);

yargsInstance = yargsInstance.command(
  "issue",
  intl.formatMessage(msg.issueDescribe),
  (issueYargs) => {
    let y: Argv = issueYargs;
    for (const Command of ISSUE_LEAF_COMMANDS) {
      y = Command.register(y);
    }
    y = y.command(
      "branch",
      intl.formatMessage(msg.branchDescribe),
      (branchYargs) => {
        let by: Argv = branchYargs;
        for (const Command of BRANCH_COMMANDS) {
          by = Command.register(by);
        }
        return by.demandCommand(1, intl.formatMessage(msg.demandBranch));
      },
    );
    y = y.command("tmux", intl.formatMessage(msg.tmuxDescribe), (tmuxYargs) => {
      let ty: Argv = TmuxRunCommand.register(tmuxYargs);
      return ty.demandCommand(1, intl.formatMessage(msg.demandTmux));
    });
    y = y.command(
      "worktree",
      intl.formatMessage(msg.worktreeDescribe),
      (worktreeYargs) => {
        let wy: Argv = worktreeYargs;
        for (const Command of WORKTREE_COMMANDS) {
          wy = Command.register(wy);
        }
        return wy.demandCommand(1, intl.formatMessage(msg.demandWorktree));
      },
    );
    return y.demandCommand(1, intl.formatMessage(msg.demandIssue));
  },
);

yargsInstance = yargsInstance.command(
  "tracker",
  intl.formatMessage(msg.trackerDescribe),
  (trackerYargs) => {
    let y: Argv = trackerYargs;
    for (const Command of TRACKER_REPO_COMMANDS) {
      y = Command.register(y);
    }
    return y.demandCommand(1, intl.formatMessage(msg.demandTracker));
  },
);

yargsInstance = yargsInstance.command(
  "registry",
  intl.formatMessage(msg.registryDescribe),
  (registryYargs) => {
    let y: Argv = registryYargs;
    for (const Command of REGISTRY_COMMANDS) {
      y = Command.register(y);
    }
    return y.demandCommand(1, intl.formatMessage(msg.demandRegistry));
  },
);

yargsInstance = yargsInstance.command(
  "config",
  intl.formatMessage(msg.configDescribe),
  (configYargs) => {
    let y: Argv = configYargs;
    for (const Command of CONFIG_COMMANDS) {
      y = Command.register(y);
    }
    return y.demandCommand(1, intl.formatMessage(msg.demandConfig));
  },
);

yargsInstance = yargsInstance.command(
  "script",
  intl.formatMessage(msg.scriptDescribe),
  (scriptYargs) => {
    let y: Argv = ScriptSelectIssueCommand.register(scriptYargs);
    return y.demandCommand(1, intl.formatMessage(msg.demandScript));
  },
);

yargsInstance
  .completion()
  .help()
  .version()
  .strict()
  .demandCommand(1, intl.formatMessage(msg.demandRoot))
  .parse();
