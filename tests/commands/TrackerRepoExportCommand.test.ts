import { jest } from "@jest/globals";
import { TrackerRepoExportCommand } from "../../src/commands/TrackerRepoExportCommand.ts";
import {
  resetGlobalConfigStore,
  useGlobalConfigStore,
} from "../../src/store/GlobalConfigStore.ts";
import type { IssueFolder } from "../../src/types/Issue.ts";
import type { TrackerRepo } from "../../src/types/Tracker.ts";
import { IssueSearcher } from "../../src/utils/search/IssueSearcher.ts";
import { IssueFolderStorage } from "../../src/utils/storage/IssueFolderStorage.ts";
import { TrackerRepoStorage } from "../../src/utils/storage/TrackerRepoStorage.ts";
import { createMockSystemContext } from "../fixture/MockSystemContext.tsx";

function issueFolder(
  issueId: string,
  label: string,
  overrides: Partial<IssueFolder> = {},
): IssueFolder {
  return {
    issueId,
    label,
    path: `/workspace/issues/${issueId}`,
    ...overrides,
  };
}

describe("TrackerRepoExportCommand", () => {
  let trackerRepoStore: ReturnType<typeof createMockSystemContext>["trackerRepoStore"];
  let loggerService: ReturnType<typeof createMockSystemContext>["loggerService"];
  let fileService: ReturnType<typeof createMockSystemContext>["fileService"];
  let shellService: ReturnType<typeof createMockSystemContext>["shellService"];
  let listIssuesSpy: jest.SpiedFunction<TrackerRepoStorage["listIssues"]>;
  let findIssueFileSpy: jest.SpiedFunction<IssueFolderStorage["findIssueFile"]>;
  let searchSpy: jest.SpiedFunction<IssueSearcher["search"]>;

  const currentRepo: TrackerRepo = {
    name: "root",
    projectPath: "/workspace/root",
    trackerPath: "/workspace/root",
    config: {
      issue_path: "issues",
      status_list: ["inbox", "in_progress"],
    },
  };

  const enrichedIssues = [
    issueFolder("0001", "0001", {
      metadata: { status: "inbox", priority: "medium" },
    }),
    issueFolder("0002", "0002", {
      metadata: { status: "in_progress", priority: "high" },
    }),
  ];

  const expectedKanbanBoard = [
    "---",
    "kanban-plugin: board",
    "---",
    "",
    "",
    "## inbox",
    "",
    "",
    "- [ ] [[0001]]",
    "",
    "",
    "",
    "## in_progress",
    "",
    "",
    "- [ ] [[0002]]",
    "",
    "",
    "",
    "%% kanban:settings",
    "```",
    '{"kanban-plugin":"board","list-collapse":[false,false]}',
    "```",
    "%%",
    "",
  ].join("\n");

  beforeEach(() => {
    const bundle = createMockSystemContext();
    trackerRepoStore = bundle.trackerRepoStore;
    loggerService = bundle.loggerService;
    fileService = bundle.fileService;
    shellService = bundle.shellService;

    shellService.cwd.mockReturnValue("/workspace/root");
    trackerRepoStore.getCurrentTrackerRepo.mockResolvedValue(currentRepo);

    resetGlobalConfigStore();
    useGlobalConfigStore.setState({ globalConfig: {} });

    listIssuesSpy = jest
      .spyOn(TrackerRepoStorage.prototype, "listIssues")
      .mockResolvedValue(enrichedIssues);
    findIssueFileSpy = jest
      .spyOn(IssueFolderStorage.prototype, "findIssueFile")
      .mockImplementation(async function (this: IssueFolderStorage) {
        const folder = (
          this as unknown as { issueFolder: IssueFolder }
        ).issueFolder;
        return `/workspace/issues/${folder.issueId}/${folder.issueId}.md`;
      });
    searchSpy = jest
      .spyOn(IssueSearcher.prototype, "search")
      .mockResolvedValue(enrichedIssues);

    jest.clearAllMocks();
    listIssuesSpy.mockResolvedValue(enrichedIssues);
    searchSpy.mockResolvedValue(enrichedIssues);
  });

  afterEach(() => {
    listIssuesSpy.mockRestore();
    findIssueFileSpy.mockRestore();
    searchSpy.mockRestore();
  });

  const buildCommand = () => new TrackerRepoExportCommand();

  it("writes the rendered board to stdout when no output file is given", async () => {
    await buildCommand().command({
      format: "obsidian-kanban",
    });

    expect(listIssuesSpy).toHaveBeenCalled();
    expect(loggerService.info).toHaveBeenCalled();
    const loggedContent = loggerService.info.mock.calls[0]?.[0] as string;
    expect(loggedContent).toEqual(expectedKanbanBoard);
    expect(fileService.writeFile).not.toHaveBeenCalled();
  });

  it("writes the rendered board to the requested output file", async () => {
    await buildCommand().command({
      format: "obsidian-kanban",
      output: "kanban.md",
    });

    expect(fileService.writeFile).toHaveBeenCalledWith(
      "/workspace/root/kanban.md",
      `${expectedKanbanBoard}\n`,
    );
    expect(loggerService.info).toHaveBeenCalled();
    expect(loggerService.info).not.toHaveBeenCalledWith(expectedKanbanBoard);
  });

  it("uses the requested project tracker when project is set", async () => {
    const docsRepo: TrackerRepo = {
      name: "docs",
      projectPath: "/workspace/docs",
      trackerPath: "/data/docs-tracker",
      config: {
        issue_path: "tasks",
        status_list: ["inbox"],
      },
    };
    trackerRepoStore.getTrackerRepoByProjectName.mockResolvedValue(docsRepo);

    await buildCommand().command({
      format: "obsidian-kanban",
      project: "docs",
    });

    expect(trackerRepoStore.getTrackerRepoByProjectName).toHaveBeenCalledWith(
      "docs",
    );
    expect(listIssuesSpy).toHaveBeenCalled();
  });

  it("throws PROJECT_NOT_FOUND when project is set but not found", async () => {
    trackerRepoStore.getTrackerRepoByProjectName.mockResolvedValue(null);

    await expect(
      buildCommand().command({
        format: "obsidian-kanban",
        project: "missing",
      }),
    ).rejects.toMatchObject({
      status: "error",
      error: {
        code: "PROJECT_NOT_FOUND",
        details: { project: "missing" },
      },
    });
  });
});

describe("TrackerRepoExportCommand.register", () => {
  it("rejects --json before running the export command", async () => {
    const cmd = new TrackerRepoExportCommand();
    const handler = jest.fn();
    const yargsStub = {
      command: (
        _name: string,
        _describe: string,
        _builder: unknown,
        run: (argv: { json?: boolean; debug?: boolean; format: string }) => Promise<void>,
      ) => {
        handler.mockImplementation(run);
        return yargsStub;
      },
    };

    TrackerRepoExportCommand.register(
      yargsStub as unknown as import("yargs").Argv,
    );

    await expect(
      handler({
        json: true,
        debug: false,
        format: "obsidian-kanban",
      }),
    ).rejects.toThrow();
  });
});
