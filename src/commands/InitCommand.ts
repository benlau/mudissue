import type { Argv } from "yargs";
import * as path from "path";
import { defineMessages } from "react-intl";
import { GIT_MUD_CONFIG_FILENAME, MUD_CONFIG_FILENAME } from "../constants.ts";
import { intl } from "../intl.ts";
import { TemplateGenerator } from "../utils/generators/TemplateGenerator.ts";
import { FileService } from "../services/FileService.ts";
import { ShellService } from "../services/ShellService.ts";
import { LoggerService } from "../services/LoggerService.ts";
import { Command, outputJsonMode, type HeadlessArgv } from "./Command.ts";
import type {
  ErrorResponse,
  InitCommandSuccessResult,
  SuccessResponse,
} from "../types/Response.ts";

export type InitCommandOptions = { insideGit?: boolean };

export type InitCommandSuccessResponse =
  SuccessResponse<InitCommandSuccessResult>;

const msg = defineMessages({
  initDescribe: {
    id: "cli.init.describe",
    defaultMessage: "Initialize the issue repository",
  },
  initInsideGit: {
    id: "cli.init.option.insideGit",
    defaultMessage: "Store mud.conf in .git/mudissue/mud.conf",
  },
});

export class InitCommand extends Command {
  name = "init";

  private readonly templateGenerator = new TemplateGenerator();

  static register(yargs: Argv): Argv {
    const cmd = new InitCommand();
    return yargs.command(
      "init",
      intl.formatMessage(msg.initDescribe),
      (builder) =>
        builder.option("inside-git", {
          type: "boolean",
          describe: intl.formatMessage(msg.initInsideGit),
          default: false,
        }),
      async (argv) => {
        const outputJson = outputJsonMode(argv as HeadlessArgv);
        cmd.preprocessArgument(cmd.name, {
          debug: argv.debug === true,
          json: outputJson,
          interactive: false,
        });
        await cmd.runCommand({ outputJson }, { insideGit: argv["inside-git"] });
      },
    );
  }

  async command(
    options?: InitCommandOptions,
  ): Promise<InitCommandSuccessResponse | ErrorResponse> {
    const insideGit = options?.insideGit === true;
    const fileService = FileService.getInstance();
    const cwd = ShellService.getInstance().cwd();
    let configPath: string = MUD_CONFIG_FILENAME;

    const configFiles = [
      { name: MUD_CONFIG_FILENAME, path: path.join(cwd, MUD_CONFIG_FILENAME) },
      {
        name: GIT_MUD_CONFIG_FILENAME,
        path: path.join(cwd, GIT_MUD_CONFIG_FILENAME),
      },
    ];
    for (const file of configFiles) {
      const exists = await fileService.exists(file.path);
      if (exists) {
        return {
          status: "error",
          error: {
            code: "INIT_CONFIG_EXISTS",
            message: `${file.name} already exists in this repository.`,
          },
        };
      }
    }

    if (insideGit) {
      const gitPath = path.join(cwd, ".git");
      if (!(await fileService.exists(gitPath))) {
        return {
          status: "error",
          error: {
            code: "INIT_NOT_GIT_REPO",
            message:
              "Not inside a git repository. You should run mud init --inside-git from a git repo.",
          },
        };
      }
      const stat = await fileService.stat(gitPath);
      if (!stat.isDirectory()) {
        this.throwException(
          "INIT_GIT_NOT_DIRECTORY",
          ".git is not a directory. Perhaps it is a submodule or worktree?",
        );
      }

      configPath = GIT_MUD_CONFIG_FILENAME;
      const mudissueDir = path.join(cwd, path.dirname(configPath));
      await fileService.mkdir(mudissueDir, { recursive: true });
    }

    const content = this.templateGenerator.getTemplate("mudconf");
    if (content === undefined) {
      return {
        status: "error",
        error: {
          code: "INIT_TEMPLATE_MISSING",
          message: "Template 'mudconf' could not be loaded.",
        },
      };
    }

    const absConfigPath = path.join(cwd, configPath);
    await fileService.writeFile(absConfigPath, content);

    LoggerService.getInstance().info(`${configPath} created successfully.`);
    return {
      status: "ok",
      result: { created: true, configPath: absConfigPath },
    };
  }

  /** Returns cwd if it contains .git, otherwise null. */
  private async findGitRepoRoot(): Promise<string | null> {
    const cwd = ShellService.getInstance().cwd();
    const gitPath = path.join(cwd, ".git");
    return (await FileService.getInstance().exists(gitPath)) ? cwd : null;
  }

  /**
   * Walks up from dir and returns the first directory that contains .git as a
   * directory, or null if none found.
   */
  private async findGitRepoRootWalkingUp(dir: string): Promise<string | null> {
    const fileService = FileService.getInstance();
    let current = path.resolve(dir);
    for (;;) {
      const gitPath = path.join(current, ".git");
      if (await fileService.exists(gitPath)) {
        const stat = await fileService.stat(gitPath);
        if (stat.isDirectory()) return current;
      }
      const parent = path.dirname(current);
      if (parent === current) return null;
      current = parent;
    }
  }
}
