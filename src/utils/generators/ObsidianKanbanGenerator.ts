import * as path from "path";
import { ObsidianKanbanAccessor } from "../../types/ObsidianKanban.ts";
import type { GlobalConfig } from "../../types/GlobalConfig.ts";
import type { IssueFolder } from "../../types/Issue.ts";
import type { TrackerRepo } from "../../types/Tracker.ts";
import { TrackerRepoConfigAccessor } from "../../types/Tracker.ts";
import { IssueSearcher } from "../search/IssueSearcher.ts";
import { IssueFolderStorage } from "../storage/IssueFolderStorage.ts";
import { TrackerRepoStorage } from "../storage/TrackerRepoStorage.ts";
import { TemplateGenerator } from "./TemplateGenerator.ts";

export type ObsidianKanbanGeneratorInput = {
  repo: TrackerRepo;
  globalConfig: GlobalConfig;
};

export class ObsidianKanbanGenerator {
  private readonly issueSearcher = new IssueSearcher();
  private readonly templateGenerator = new TemplateGenerator();

  async generate({
    repo,
    globalConfig,
  }: ObsidianKanbanGeneratorInput): Promise<string> {
    const storage = new TrackerRepoStorage(repo, globalConfig);
    const configAccessor = new TrackerRepoConfigAccessor(
      repo.config,
      globalConfig,
    );
    const issues = await storage.listIssues();
    const stemByFolderName = await this.preloadIssueFileStems(issues);
    const enrichedIssues = await this.issueSearcher.search(issues, []);
    const statusList = configAccessor.getEffectiveStatusList();
    const priorityList = configAccessor.getEffectivePriorityTable().priorities;

    const board = ObsidianKanbanAccessor.createFromIssueFolders({
      issues: enrichedIssues,
      statusList,
      priorityList,
      resolveIssueFileStem: (folder) =>
        stemByFolderName.get(folder.folderName) ?? folder.issueId,
    });

    const rendered = this.templateGenerator.getTemplate(
      "obsidian-kanban",
      board.get(),
    );
    if (rendered === undefined) {
      throw new Error('Missing template "obsidian-kanban".');
    }
    return rendered;
  }

  private async preloadIssueFileStems(
    issues: IssueFolder[],
  ): Promise<Map<string, string>> {
    const stemByFolderName = new Map<string, string>();
    await Promise.all(
      issues.map(async (folder) => {
        const issueFilePath = await new IssueFolderStorage(
          folder,
        ).findIssueFile();
        if (issueFilePath === undefined) {
          return;
        }
        stemByFolderName.set(
          folder.folderName,
          path.basename(issueFilePath, path.extname(issueFilePath)),
        );
      }),
    );
    return stemByFolderName;
  }
}
