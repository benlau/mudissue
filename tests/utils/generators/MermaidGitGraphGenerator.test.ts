import { jest } from "@jest/globals";
import * as path from "path";
import type { GitService } from "../../../src/services/GitService.ts";
import type { GitGraph, GitGraphNode } from "../../../src/types/GitGraph.ts";
import { MermaidGitGraphGenerator } from "../../../src/utils/generators/MermaidGitGraphGenerator.ts";

function mapNodes(
  entries: Array<[string, { summary: string; parents: string[] }]>,
): Record<string, GitGraphNode> {
  const m: Record<string, GitGraphNode> = {};
  for (const [id, meta] of entries) {
    m[id] = {
      objectIds: [id],
      summary: meta.summary,
      parentCommitIds: meta.parents,
    };
  }
  return m;
}

describe("MermaidGitGraphGenerator", () => {
  it("merges base and worktree graphs and emits gitGraph", async () => {
    const gitService = {
      resolveLogRefForWorktree: jest.fn(async (dir: string) =>
        dir.endsWith("repo") ? "main" : "feat",
      ),
      getCurrentBranchLabel: jest.fn(async (dir: string) =>
        dir.endsWith("repo") ? "main" : "feat",
      ),
      resolveRef: jest.fn(async (dir: string) =>
        dir.endsWith("repo") ? "baseTip" : "wtTip",
      ),
      findMergeBaseFromWorktree: jest.fn(async () => "anc"),
      pickOldestCommitOid: jest.fn(async (_base: string, oids: string[]) => oids[0]!),
      createGraph: jest.fn(
        async (
          _base: string,
          checkoutDir: string,
          anc: string,
        ): Promise<GitGraph> => {
          if (!checkoutDir.includes("worktrees")) {
            return {
              nodes: mapNodes([
                [anc, { summary: "root", parents: [] }],
                ["baseTip", { summary: "on main", parents: [anc] }],
              ]),
              branches: { main: "baseTip" },
              rootCommitId: undefined,
            };
          }
          return {
            nodes: mapNodes([
              [anc, { summary: "root", parents: [] }],
              ["wtTip", { summary: "feat tip", parents: [anc] }],
            ]),
            branches: { feat: "wtTip" },
            rootCommitId: undefined,
          };
        },
      ),
      getGitFolderHeadObjectId: jest.fn(async () => "main"),
      getBaseProjectBranchName: jest.fn(async () => "main"),
    } as unknown as GitService;

    const generator = new MermaidGitGraphGenerator();
    const text = await generator.generate(gitService, {
      repoAbsPath: "/repo",
      issueWorktreePaths: ["/repo/.claude/worktrees/MI0100-mudissue"],
    });

    expect(gitService.findMergeBaseFromWorktree).toHaveBeenCalled();
    expect(gitService.createGraph).toHaveBeenCalled();
    expect(text).toEqual(
      [
        "---",
        "config:",
        "  gitGraph:",
        "    mainBranchName: 'main'",
        "---",
        "gitGraph TB:",
        '    commit id: "anc"',
        "    branch feat",
        '    commit id: "wtTip"',
        "    checkout main",
        '    commit id: "baseTip"',
      ].join("\n"),
    );
  });

  it("returns mermaid string", async () => {
    const gitService = {
      resolveLogRefForWorktree: jest.fn(async () => "main"),
      getCurrentBranchLabel: jest.fn(async () => "main"),
      resolveRef: jest.fn(async () => "tip"),
      findMergeBaseFromWorktree: jest.fn(async () => "root"),
      pickOldestCommitOid: jest.fn(async (_base: string, oids: string[]) => oids[0]!),
      createGraph: jest.fn(async (): Promise<GitGraph> => ({
        nodes: mapNodes([
          ["root", { summary: "r", parents: [] }],
          ["tip", { summary: "t", parents: ["root"] }],
        ]),
        branches: { main: "tip" },
        rootCommitId: undefined,
      })),
      getGitFolderHeadObjectId: jest.fn(async () => "main"),
      getBaseProjectBranchName: jest.fn(async () => "main"),
    } as unknown as GitService;

    const generator = new MermaidGitGraphGenerator();
    const mermaidGraph = await generator.generate(gitService, {
      repoAbsPath: "/repo",
      issueWorktreePaths: ["/other/wt"],
    });

    expect(mermaidGraph).toEqual(
      [
        "---",
        "config:",
        "  gitGraph:",
        "    mainBranchName: 'main'",
        "---",
        "gitGraph TB:",
        '    commit id: "root"',
        '    commit id: "tip"',
      ].join("\n"),
    );
  });

  it("when a worktree branch name exceeds the default length, emits the truncated branch id in mermaid output", async () => {
    const longWorktreeBranch = "pr/MI0100-mudissue-dev-extra-long";
    const gitService = {
      resolveLogRefForWorktree: jest.fn(async () => "main"),
      getCurrentBranchLabel: jest.fn(async () => "main"),
      resolveRef: jest.fn(async () => "tip"),
      findMergeBaseFromWorktree: jest.fn(async () => "root"),
      pickOldestCommitOid: jest.fn(async (_base: string, oids: string[]) => oids[0]!),
      createGraph: jest.fn(
        async (
          _base: string,
          checkoutDir: string,
          rootOid: string,
        ): Promise<GitGraph> => {
          if (!checkoutDir.includes("worktrees")) {
            return {
              nodes: mapNodes([
                [rootOid, { summary: "root", parents: [] }],
                ["mainTip", { summary: "main tip", parents: [rootOid] }],
              ]),
              branches: { main: "mainTip" },
              rootCommitId: undefined,
            };
          }
          return {
            nodes: mapNodes([
              [rootOid, { summary: "root", parents: [] }],
              ["wtTip", { summary: "worktree tip", parents: [rootOid] }],
            ]),
            branches: { [longWorktreeBranch]: "wtTip" },
            rootCommitId: undefined,
          };
        },
      ),
      getGitFolderHeadObjectId: jest.fn(async () => "main"),
      getBaseProjectBranchName: jest.fn(async () => "main"),
    } as unknown as GitService;

    const generator = new MermaidGitGraphGenerator();
    const mermaidGraph = await generator.generate(gitService, {
      repoAbsPath: "/repo",
      issueWorktreePaths: ["/repo/.claude/worktrees/MI0100-mudissue"],
    });

    expect(mermaidGraph).toEqual(
      [
        "---",
        "config:",
        "  gitGraph:",
        "    mainBranchName: 'main'",
        "---",
        "gitGraph TB:",
        '    commit id: "root"',
        "    branch pr-MI0100-mudissue-d",
        "    checkout main",
        '    commit id: "mainTip"',
        "    checkout pr-MI0100-mudissue-d",
        '    commit id: "wtTip"',
      ].join("\n"),
    );
  });

  it("calls createGraph on the primary checkout at most once for the integration spine", async () => {
    const createGraph = jest.fn(
      async (
        _base: string,
        checkoutDir: string,
        anc: string,
      ): Promise<GitGraph> => {
        if (!checkoutDir.includes("worktrees")) {
          return {
            nodes: mapNodes([
              [anc, { summary: "root", parents: [] }],
              ["devTip", { summary: "on dev", parents: [anc] }],
            ]),
            branches: { dev: "devTip" },
            rootCommitId: undefined,
          };
        }
        return {
          nodes: mapNodes([
            [anc, { summary: "root", parents: [] }],
            ["wtTip", { summary: "feat tip", parents: [anc] }],
          ]),
          branches: {
            [path.basename(checkoutDir)]: "wtTip",
          },
          rootCommitId: undefined,
        };
      },
    );
    const gitService = {
      findMergeBaseFromWorktree: jest.fn(async () => "anc"),
      pickOldestCommitOid: jest.fn(async (_base: string, oids: string[]) => oids[0]!),
      createGraph,
      getBaseProjectBranchName: jest.fn(async () => "dev"),
    } as unknown as GitService;

    const generator = new MermaidGitGraphGenerator();
    await generator.generate(gitService, {
      repoAbsPath: "/repo",
      issueWorktreePaths: [
        "/repo/.claude/worktrees/MI0100-mudissue",
        "/repo/.claude/worktrees/MI0200-other",
      ],
    });

    const primaryCheckoutCalls = createGraph.mock.calls.filter(
      ([, checkoutDir]) => checkoutDir === "/repo",
    );
    expect(primaryCheckoutCalls).toHaveLength(1);
    expect(gitService.findMergeBaseFromWorktree).toHaveBeenCalledTimes(2);
  });
});
