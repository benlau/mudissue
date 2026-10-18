import { jest } from "@jest/globals";
import * as path from "path";
import { IssueWorktreeCreateGraphCommand } from "../../src/commands/IssueWorktreeCreateGraphCommand.ts";
import {
  resetGlobalConfigStore,
  useGlobalConfigStore,
} from "../../src/store/GlobalConfigStore.ts";
import type { TrackerRepo } from "../../src/types/Tracker.ts";
import { createMockSystemContext } from "../fixture/MockSystemContext.tsx";
import { ShellService } from "../../src/services/ShellService.ts";
import type { GitGraph } from "../../src/types/GitGraph.ts";

const mockRepo: TrackerRepo = {
  name: "proj",
  projectPath: path.join(path.sep, "repo"),
  trackerPath: path.join(path.sep, "repo"),
  config: { issue_path: "issues" },
};

describe("IssueWorktreeCreateGraphCommand", () => {
  let trackerRepoStore: ReturnType<
    typeof createMockSystemContext
  >["trackerRepoStore"];
  let fileService: ReturnType<typeof createMockSystemContext>["fileService"];
  let gitService: ReturnType<typeof createMockSystemContext>["gitService"];
  let shellService: ReturnType<typeof createMockSystemContext>["shellService"];

  beforeEach(() => {
    const bundle = createMockSystemContext();
    trackerRepoStore = bundle.trackerRepoStore;
    fileService = bundle.fileService;
    gitService = bundle.gitService;
    shellService = bundle.shellService;

    trackerRepoStore.getCurrentTrackerRepo.mockResolvedValue(mockRepo);
    bundle.shellService.which.mockResolvedValue("/usr/bin/git");
    fileService.exists.mockResolvedValue(true);

    const wtPath = path.join(
      mockRepo.projectPath,
      ".claude",
      "worktrees",
      "MI0100-mudissue",
    );
    gitService.listWorktree.mockResolvedValue([wtPath]);
    gitService.resolveLogRefForWorktree.mockResolvedValue("issue/MI0100");
    gitService.getCurrentBranchLabel.mockImplementation(async (d: string) =>
      d.includes("MI0100") ? "issue/MI0100" : "main",
    );
    gitService.findMergeBaseFromWorktree.mockResolvedValue("anc");
    gitService.resolveRef.mockImplementation(async (d: string) =>
      d.includes("MI0100") ? "wTip" : "bTip",
    );
    gitService.getBaseProjectBranchName.mockResolvedValue("main");
    gitService.createGraph.mockImplementation(
      async (_base: string, checkoutDir: string, a: string): Promise<GitGraph> => {
        const tip = checkoutDir.includes("MI0100") ? "wTip" : "bTip";
        return {
          nodes: {
            [a]: {
              objectIds: [a],
              summary: "root",
              parentCommitIds: [],
            },
            [tip]: {
              objectIds: [tip],
              summary: "msg",
              parentCommitIds: [a],
            },
          },
          branches: checkoutDir.includes("MI0100")
            ? { "issue/MI0100": tip }
            : { main: tip },
        };
      },
    );

    resetGlobalConfigStore();
    useGlobalConfigStore.setState({ globalConfig: {} });

    jest.clearAllMocks();
    ShellService.setInstance(bundle.shellService as unknown as ShellService);
    trackerRepoStore.getCurrentTrackerRepo.mockResolvedValue(mockRepo);
    shellService.tmpdir.mockReturnValue("/tmp");
  });

  afterEach(() => {
    jest.restoreAllMocks();
    ShellService.setInstance(null);
    resetGlobalConfigStore();
  });

  it("returns error response when no mudissue worktrees match", async () => {
    gitService.listWorktree.mockResolvedValue([]);

    const cmd = new IssueWorktreeCreateGraphCommand();
    const result = await cmd.runCommand({ outputJson: true }, {
      outputJson: true,
    });

    expect(result).toMatchObject({
      status: "error",
      error: { code: "WORKTREE_GRAPH_NO_ISSUE_WORKTREES" },
    });
  });

  it("writes Mermaid source to temp mmd when output omitted", async () => {
    const cmd = new IssueWorktreeCreateGraphCommand();
    const result = await cmd.runCommand({ outputJson: true }, {
      outputJson: true,
    });

    expect(result?.status).toBe("ok");
    expect(fileService.writeFile).toHaveBeenCalledWith(
      expect.stringMatching(/^\/tmp\/mudissue-graph-[0-9a-z]+\.mmd$/),
      expect.stringMatching(/gitGraph/),
    );
    expect((result as { result: { path: string } }).result.path).toMatch(
      /^\/tmp\/mudissue-graph-[0-9a-z]+\.mmd$/,
    );
  });

  it("writes Mermaid source to explicit output path", async () => {
    shellService.cwd.mockReturnValue("/cwd");

    const cmd = new IssueWorktreeCreateGraphCommand();
    const result = await cmd.runCommand({ outputJson: true }, {
      outputJson: true,
      output: path.join("rel", "graph.mmd"),
    });

    expect(result?.status).toBe("ok");
    expect(fileService.writeFile).toHaveBeenCalledWith(
      path.resolve("/cwd", path.join("rel", "graph.mmd")),
      expect.stringMatching(/gitGraph/),
    );
  });

  it("opens output file when open is true", async () => {
    shellService.cwd.mockReturnValue("/cwd");

    const cmd = new IssueWorktreeCreateGraphCommand();
    await cmd.runCommand({ outputJson: true }, {
      outputJson: true,
      open: true,
      output: "graph.mmd",
    });

    expect(shellService.open).toHaveBeenCalledWith(
      path.resolve("/cwd", "graph.mmd"),
    );
  });
});
