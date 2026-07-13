import * as path from "path";
import { FileService } from "../services/FileService.ts";
import { IssueResource } from "../utils/resources/IssueResource.ts";
import { TrackerRepoStorage } from "../utils/storage/TrackerRepoStorage.ts";

export class NextIssueIdHelper {
  constructor(
    private readonly storage: TrackerRepoStorage,
    private readonly fileService: FileService = FileService.getInstance(),
  ) {}

  async findNextNumber(issuePath: string): Promise<number> {
    const issuePrefix = this.storage.getTrackerRepo().config.issue_prefix;
    let maxNumber = 0;

    try {
      if (await this.fileService.exists(issuePath)) {
        const entries = await this.fileService.readdir(issuePath);
        for (const entry of entries) {
          if (!entry.isDirectory()) continue;
          const dirName = entry.name;
          let numberStr = dirName;
          if (issuePrefix) {
            if (!dirName.startsWith(issuePrefix)) continue;
            numberStr = dirName.slice(issuePrefix.length);
          }

          const match = numberStr.match(/^(\d+)/);
          if (!match) continue;

          const num = parseInt(match[1], 10);
          if (num > maxNumber) {
            maxNumber = num;
          }
        }
      }
    } catch {
      maxNumber = 0;
    }
    return maxNumber + 1;
  }

  async allocateNextIssueId(): Promise<string> {
    const nextNumber = await this.findNextNumber(this.storage.getIssuePath());
    const prefix = this.storage.getTrackerRepo().config.issue_prefix ?? "";
    return `${prefix}${String(nextNumber).padStart(4, "0")}`;
  }

  async resolveIssueId(id: string | undefined, title: string): Promise<string> {
    if (id === undefined || id === "") {
      return this.allocateNextIssueId();
    }

    const folderName = IssueResource.folderNameForTitle(id, title);
    const issueDirPath = path.join(this.storage.getIssuePath(), folderName);
    if (await this.fileService.exists(issueDirPath)) {
      throw new Error(`Issue already exists: ${folderName}`);
    }
    return id;
  }
}
