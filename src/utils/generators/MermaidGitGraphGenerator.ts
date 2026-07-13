import * as path from "path";
import type { GitService } from "../../services/GitService.ts";
import type { GitGraph } from "../../types/GitGraph.ts";
import {
  accessGitGraph,
  DEFAULT_COMPRESS_BRANCH_NAME_LENGTH,
  MermaidGitGraphAccessor,
} from "../../types/GitGraph.ts";
import { debug } from "../../services/LoggerService.ts";

export type MermaidGitGraphGeneratorInput = {
  repoAbsPath: string;
  issueWorktreePaths: readonly string[];
};

export class MermaidGitGraphGenerator {
  async createWorktreeGraph(
    gitService: GitService,
    repoAbsPath: string,
    issueWorktreePaths: readonly string[],
  ): Promise<GitGraph> {
    const acc = accessGitGraph(null);
    const baseDir = path.resolve(repoAbsPath);
    const mergeBases: string[] = [];

    for (const wtPathRaw of issueWorktreePaths) {
      const wtPath = path.resolve(wtPathRaw);
      const commonAncestor = await gitService.findMergeBaseFromWorktree(
        baseDir,
        wtPath,
      );
      mergeBases.push(commonAncestor);
      const hadAncestor = acc.hasCommitId(commonAncestor);
      const worktreeGraph = await gitService.createGraph(
        baseDir,
        wtPath,
        commonAncestor,
      );

      acc.mergeGraph(worktreeGraph);
      if (!hadAncestor) {
        acc.setRootCommitId(commonAncestor);
      }
    }

    if (mergeBases.length > 0) {
      const oldestRoot = await gitService.pickOldestCommitOid(
        baseDir,
        mergeBases,
      );
      const spineGraph = await gitService.createGraph(
        baseDir,
        baseDir,
        oldestRoot,
      );
      acc.mergeGraph(spineGraph);
    }

    return acc.get();
  }

  convertGraphToMermaid(
    graph: GitGraph,
    mainBranchLabel: string = "main",
  ): string {
    const acc = accessGitGraph(graph);
    const renames = acc.truncateBranchNames(
      DEFAULT_COMPRESS_BRANCH_NAME_LENGTH,
    );
    const truncatedGraph = acc.get();
    const truncatedMain = renames.get(mainBranchLabel) ?? mainBranchLabel;
    return MermaidGitGraphAccessor.createFromGitGraph(
      truncatedGraph,
      truncatedMain,
    ).toText();
  }

  async generate(
    gitService: GitService,
    { repoAbsPath, issueWorktreePaths }: MermaidGitGraphGeneratorInput,
  ): Promise<string> {
    const graph = await this.createWorktreeGraph(
      gitService,
      repoAbsPath,
      issueWorktreePaths,
    );
    debug("Created Worktree Graph", JSON.stringify(graph, null, 2));
    const mainBranchLabel =
      await gitService.getBaseProjectBranchName(repoAbsPath);
    return this.convertGraphToMermaid(graph, mainBranchLabel);
  }
}
