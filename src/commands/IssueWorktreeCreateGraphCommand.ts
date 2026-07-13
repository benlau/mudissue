import type { Argv } from "yargs";
import * as path from "path";
import { defineMessages } from "react-intl";
import { intl } from "../intl.ts";
import { MermaidService } from "../services/MermaidService.ts";
import { useCurrentTrackerRepoStore } from "../store/CurrentTrackerRepoStore.ts";
import { TrackerRepoValidator } from "../utils/validators/TrackerRepoValidator.ts";
import { GitFolderValidator } from "../utils/validators/GitFolderValidator.ts";
import { Command, outputJsonMode, type HeadlessArgv } from "./Command.ts";
import { WorktreeHelper } from "../helpers/WorktreeHelper.ts";
import { MermaidGitGraphGenerator } from "../utils/generators/MermaidGitGraphGenerator.ts";
import type {
  ErrorResponse,
  IssueWorktreeCreateGraphCommandSuccessResult,
  SuccessResponse,
} from "../types/Response.ts";
import { FileService } from "../services/FileService.ts";
import { ShellService } from "../services/ShellService.ts";
import { GitService } from "../services/GitService.ts";
import { LoggerService, debug } from "../services/LoggerService.ts";

export type IssueWorktreeCreateGraphCommandSuccessResponse =
  SuccessResponse<IssueWorktreeCreateGraphCommandSuccessResult>;

export type IssueWorktreeCreateGraphRunInput = {
  project?: string;
  /** Write Mermaid source to a file instead of rendering PNG. */
  text?: boolean;
  open?: boolean;
  /** Explicit output path; otherwise a temp file (.png or .mmd). */
  output?: string;
  outputJson?: boolean;
};

const msg = defineMessages({
  worktreeGraphDescribe: {
    id: "cli.worktree.graph.describe",
    defaultMessage:
      "Build a Mermaid history graph for issue worktrees and write PNG or Mermaid to a file",
  },
  optionProject: {
    id: "cli.common.option.project",
    defaultMessage: "Project name",
  },
  worktreeGraphOpen: {
    id: "cli.worktree.graph.option.open",
    defaultMessage: "Open the PNG with the default application",
  },
  worktreeGraphText: {
    id: "cli.worktree.graph.option.text",
    defaultMessage: "Write Mermaid source to a file instead of rendering PNG",
  },
  worktreeGraphOutput: {
    id: "cli.worktree.graph.option.output",
    defaultMessage:
      "Output file path (default: temp file; .mmd with --text, .png otherwise)",
  },
});

export class IssueWorktreeCreateGraphCommand extends Command {
  name = "issue worktree create-graph";

  constructor() {
    super();
  }

  static register(yargs: Argv): Argv {
    const cmd = new IssueWorktreeCreateGraphCommand();
    return yargs.command(
      "create-graph",
      intl.formatMessage(msg.worktreeGraphDescribe),
      (builder) =>
        builder
          .option("project", {
            type: "string",
            describe: intl.formatMessage(msg.optionProject),
          })
          .option("open", {
            type: "boolean",
            default: false,
            describe: intl.formatMessage(msg.worktreeGraphOpen),
          })
          .option("text", {
            type: "boolean",
            default: false,
            describe: intl.formatMessage(msg.worktreeGraphText),
          })
          .option("output", {
            type: "string",
            describe: intl.formatMessage(msg.worktreeGraphOutput),
          }),
      async (argv) => {
        const outputJson = outputJsonMode(argv as HeadlessArgv);
        cmd.preprocessArgument(cmd.name, {
          debug: argv.debug === true,
          json: outputJson,
          interactive: false,
        });
        const text = argv.text === true;
        const openFile = argv.open === true && !text;
        await cmd.runCommand(
          { outputJson },
          {
            project: argv.project as string | undefined,
            text,
            open: openFile,
            outputJson,
            output: argv.output as string | undefined,
          },
        );
      },
    );
  }

  async command(
    input: IssueWorktreeCreateGraphRunInput,
  ): Promise<IssueWorktreeCreateGraphCommandSuccessResponse | ErrorResponse> {
    const { project, text, open, outputJson, output: outputPath } = input;

    const loggerService = LoggerService.getInstance();
    const fileService = FileService.getInstance();
    const shellService = ShellService.getInstance();
    const gitService = GitService.getInstance();

    let repo;
    if (project) {
      repo = new TrackerRepoValidator()
        .set(
          await useCurrentTrackerRepoStore
            .getState()
            .getTrackerRepoByProjectName(project),
        )
        .validateProjectNotNone(project)
        .first();
    } else {
      repo = await useCurrentTrackerRepoStore
        .getState()
        .getCurrentTrackerRepo();
    }

    const gitValidator = new GitFolderValidator();
    gitValidator.set(repo.projectPath);
    await gitValidator.validateDotGit();
    await gitValidator.validateGitBinary();

    const checkoutPaths = await gitService.listWorktree(repo.projectPath);
    debug("All git worktrees:", checkoutPaths);

    const mudissuePaths = await WorktreeHelper.filterIssueWorktreeCheckoutPaths(
      repo,
      checkoutPaths,
    );
    debug("Issue worktrees:", mudissuePaths);

    if (mudissuePaths.length === 0) {
      this.throwException(
        "WORKTREE_GRAPH_NO_ISSUE_WORKTREES",
        "No worktrees found for this repository.",
      );
    }

    const mermaidGraph = await new MermaidGitGraphGenerator().generate(
      gitService,
      {
        repoAbsPath: repo.projectPath,
        issueWorktreePaths: mudissuePaths,
      },
    );

    const outPath = outputPath
      ? path.resolve(shellService.cwd(), outputPath)
      : path.join(
          shellService.tmpdir(),
          `mudissue-graph-${Date.now().toString(36)}.${text ? "mmd" : "png"}`,
        );

    if (text) {
      await fileService.writeFile(outPath, `${mermaidGraph}\n`);
      if (!outputJson) {
        loggerService.info(outPath);
      }
      return {
        status: "ok",
        result: { mermaidGraph, path: outPath },
      };
    }

    await MermaidService.getInstance().writeMermaidToPng(
      mermaidGraph,
      outPath,
      fileService,
    );

    if (open) {
      await shellService.open(outPath);
    }

    if (!outputJson) {
      loggerService.info(outPath);
    }

    return {
      status: "ok",
      result: { mermaidGraph, path: outPath },
    };
  }
}
