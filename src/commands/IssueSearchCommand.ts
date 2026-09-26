import type { Argv } from "yargs";
import { defineMessages } from "react-intl";
import { intl } from "../intl.ts";
import { SearchQueryParser } from "../async/search/SearchQueryParser.ts";
import { LoggerService } from "../services/LoggerService.ts";
import { useCurrentTrackerRepoStore } from "../store/CurrentTrackerRepoStore.ts";
import {
  IssueSearchStoreFactory,
  IssueSearchStoreKey,
} from "../store/IssueSearchStore.ts";
import { useGlobalConfigStore } from "../store/GlobalConfigStore.ts";
import { TrackerRepoStorage } from "../async/storage/TrackerRepoStorage.ts";
import { TrackerRepoValidator } from "../async/validators/TrackerRepoValidator.ts";
import { Command, outputJsonMode, type HeadlessArgv } from "./Command.ts";
import type {
  SearchCommandSuccessResult,
  SuccessResponse,
} from "../types/Response.ts";
import {
  accessIssueFolderList,
  type IssueFolder,
  type ProjectIssueFolders,
} from "../types/Issue.ts";
import type { TrackerRepo } from "../types/Tracker.ts";
import {
  SortingOrderListAccessor,
  type SortingOrder,
} from "../types/SortingOrder.ts";

export type IssueSearchCommandSuccessResponse =
  SuccessResponse<SearchCommandSuccessResult>;

export type IssueSearchCommandOptions = {
  project?: string;
  queryParts?: string[];
  sort?: string;
  max?: number;
};

type IssueSearchCommandProps = {
  searchQueryParser?: SearchQueryParser;
};

const msg = defineMessages({
  issueSearchDescribe: {
    id: "cli.issue.search.describe",
    defaultMessage:
      "Search issues by query string (supports negation with -term)",
  },
  issueSearchQuery: {
    id: "cli.issue.search.positional.query",
    defaultMessage:
      "Search terms: field:value, tag:name, text, or -term to exclude",
  },
  issueSearchExamplePriorityNotClosedCmd: {
    id: "cli.issue.search.example.priorityNotClosed.cmd",
    defaultMessage: "$0 issue search priority:high -status:closed",
  },
  issueSearchExamplePriorityNotClosed: {
    id: "cli.issue.search.example.priorityNotClosed",
    defaultMessage: "High-priority issues that are not closed",
  },
  issueSearchExampleNegatedTagCmd: {
    id: "cli.issue.search.example.negatedTag.cmd",
    defaultMessage: "$0 issue search -tag:filterout",
  },
  issueSearchExampleNegatedTag: {
    id: "cli.issue.search.example.negatedTag",
    defaultMessage: "Exclude issues tagged filterout",
  },
  issueSearchExampleSortCmd: {
    id: "cli.issue.search.example.sort.cmd",
    defaultMessage: '$0 issue search --sort "+title,-created_at"',
  },
  issueSearchExampleSort: {
    id: "cli.issue.search.example.sort",
    defaultMessage:
      "Search results sorted by title ascending, then created date descending",
  },
  optionProject: {
    id: "cli.common.option.project",
    defaultMessage: "Project name",
  },
  optionSort: {
    id: "cli.issue.search.option.sort",
    defaultMessage:
      "Comma-separated sort keys; prefix + for ascending, - for descending (default ascending)",
  },
  optionMax: {
    id: "cli.issue.search.option.max",
    defaultMessage: "Maximum number of issues to return",
  },
  sortInvalid: {
    id: "cli.issue.search.error.sort.invalid",
    defaultMessage:
      'Invalid --sort value "{value}". Use a comma-separated list of fields; prefix "+" for ascending or "-" for descending (default ascending). Example: "+title,-created_at". Built-in fields: id, title, status, priority, created_at, updated_at; other names sort by frontmatter.',
  },
  maxInvalid: {
    id: "cli.issue.search.error.max.invalid",
    defaultMessage:
      'Invalid --max value "{value}": must be a positive integer.',
  },
});

export class IssueSearchCommand extends Command {
  name = "issue search";
  private searchQueryParser: SearchQueryParser;

  constructor(props: IssueSearchCommandProps = {}) {
    super();
    this.searchQueryParser = props.searchQueryParser ?? new SearchQueryParser();
  }

  static register(yargs: Argv): Argv {
    const cmd = new IssueSearchCommand();
    return yargs.command(
      "search [query..]",
      intl.formatMessage(msg.issueSearchDescribe),
      (builder) =>
        builder
          .parserConfiguration({ "unknown-options-as-args": true })
          .option("project", {
            type: "string",
            describe: intl.formatMessage(msg.optionProject),
          })
          .option("sort", {
            type: "string",
            describe: intl.formatMessage(msg.optionSort),
          })
          .option("max", {
            type: "number",
            describe: intl.formatMessage(msg.optionMax),
          })
          .positional("query", {
            describe: intl.formatMessage(msg.issueSearchQuery),
            type: "string",
          })
          .example(
            intl.formatMessage(msg.issueSearchExamplePriorityNotClosedCmd),
            intl.formatMessage(msg.issueSearchExamplePriorityNotClosed),
          )
          .example(
            intl.formatMessage(msg.issueSearchExampleNegatedTagCmd),
            intl.formatMessage(msg.issueSearchExampleNegatedTag),
          )
          .example(
            intl.formatMessage(msg.issueSearchExampleSortCmd),
            intl.formatMessage(msg.issueSearchExampleSort),
          ),
      async (argv) => {
        const queryParts = (argv.query ?? []) as string[];
        const outputJson = outputJsonMode(argv as HeadlessArgv);
        cmd.preprocessArgument(cmd.name, {
          debug: argv.debug === true,
          json: outputJson,
          interactive: false,
        });
        await cmd.runCommand(
          { outputJson },
          {
            project: argv.project,
            sort: argv.sort,
            max: argv.max,
            queryParts,
          },
        );
      },
    );
  }

  async command(
    projectOrOptions: string | IssueSearchCommandOptions | undefined,
    ...queryParts: string[]
  ): Promise<IssueSearchCommandSuccessResponse> {
    const options: IssueSearchCommandOptions =
      typeof projectOrOptions === "object" && projectOrOptions != null
        ? projectOrOptions
        : {
            project: projectOrOptions,
            queryParts,
          };

    const project = options.project;
    const parts = options.queryParts ?? queryParts;
    const sortOrders = this.parseSortOption(options.sort);
    this.validateMaxOption(options.max);

    const loggerService = LoggerService.getInstance();
    const query = parts
      .map((part) =>
        part.includes(" ") ? `"${part.replace(/"/g, '\\"')}"` : part,
      )
      .join(" ")
      .trim();
    const parsedTerms = this.searchQueryParser.parse(query);

    let repoList: TrackerRepo[];
    if (project) {
      const repo = new TrackerRepoValidator()
        .set(
          await useCurrentTrackerRepoStore
            .getState()
            .getTrackerRepoByProjectName(project),
        )
        .validateProjectNotNone(project)
        .first();
      repoList = [repo];
    } else {
      repoList = await useCurrentTrackerRepoStore
        .getState()
        .getTrackerRepoList();
    }

    const globalConfig = await useGlobalConfigStore
      .getState()
      .ensureGlobalConfig();
    const trackerRepoStore = useCurrentTrackerRepoStore.getState();
    const projects: ProjectIssueFolders[] = [];
    for (const repo of repoList) {
      const storage = new TrackerRepoStorage(repo, globalConfig);
      const issues = await storage.listIssues();
      const resolvedStatusList =
        await trackerRepoStore.getResolvedStatusList(repo);
      let results = await IssueSearchStoreFactory.createOrGet(
        IssueSearchStoreKey.Headless,
      )
        .getState()
        .searchFolders(issues, parsedTerms, { resolvedStatusList });
      if (sortOrders != null) {
        const statusList = await trackerRepoStore.getStatusList(repo);
        const priorityList = (await trackerRepoStore.getPriorityTable(repo))
          .priorities;
        results = accessIssueFolderList(results)
          .sortBy({
            orders: sortOrders,
            pinnedIssueIds: [],
            statusList,
            priorityList,
          })
          .get();
      }
      projects.push({
        name: repo.name,
        projectPath: repo.projectPath,
        issues: results,
      });
    }

    let projectsWithMatches = projects.filter((p) => p.issues.length > 0);
    let allMatches = projectsWithMatches.flatMap((p) => p.issues);

    if (options.max != null) {
      const capped = allMatches.slice(0, options.max);
      const cappedKeys = new Set(capped.map(issueKey));
      projectsWithMatches = projectsWithMatches
        .map((projectEntry) => ({
          ...projectEntry,
          issues: projectEntry.issues.filter((issue) =>
            cappedKeys.has(issueKey(issue)),
          ),
        }))
        .filter((projectEntry) => projectEntry.issues.length > 0);
      allMatches = capped;
    }

    for (const issue of allMatches) {
      loggerService.info(issue.issueId);
    }

    return { status: "ok", result: { projects: projectsWithMatches } };
  }

  private parseSortOption(
    sort: string | undefined,
  ): SortingOrder[] | undefined {
    if (sort == null || sort.trim() === "") {
      return undefined;
    }
    const orders = SortingOrderListAccessor.parse(sort).get();
    if (orders.length === 0) {
      this.throwException(
        "COMMAND_INVALID_ARG",
        intl.formatMessage(msg.sortInvalid, { value: sort }),
        { argument: "sort", value: sort },
      );
    }
    return orders;
  }

  private validateMaxOption(max: number | undefined): void {
    if (max == null) {
      return;
    }
    if (!Number.isInteger(max) || max <= 0) {
      this.throwException(
        "COMMAND_INVALID_ARG",
        intl.formatMessage(msg.maxInvalid, { value: String(max) }),
        { argument: "max", value: String(max) },
      );
    }
  }
}

function issueKey(issue: IssueFolder): string {
  return issue.path;
}
