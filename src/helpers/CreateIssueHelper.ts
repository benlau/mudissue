import * as path from "path";
import { FileService } from "../services/FileService.ts";
import { ShellService } from "../services/ShellService.ts";
import { useAppStore } from "../store/AppStore.ts";
import { useCurrentTrackerRepoStore } from "../store/CurrentTrackerRepoStore.ts";
import { useGlobalConfigStore } from "../store/GlobalConfigStore.ts";
import type { IssueFolder } from "../types/Issue.ts";
import { IssueResource } from "../utils/resources/IssueResource.ts";
import { IssueFolderStorage } from "../utils/storage/IssueFolderStorage.ts";
import { TrackerRepoStorage } from "../utils/storage/TrackerRepoStorage.ts";
import { NextIssueIdHelper } from "./NextIssueIdHelper.ts";

export class CreateIssueHelper {
  private readonly issueResource = new IssueResource();

  async createIssue(
    title?: string,
    filePath?: string,
    content?: string,
  ): Promise<IssueFolder> {
    const created = await this.createIssueOnDisk(title, filePath, content);
    await this.openCreatedIssue(created);
    return created;
  }

  async createSubissue(
    title: string,
    parent: IssueFolder,
    content?: string,
  ): Promise<IssueFolder> {
    const created = await this.createSubissueOnDisk(title, parent, content);
    await this.openCreatedIssue(created);
    return created;
  }

  /** Creates and links a sub-issue without navigating to it. */
  async createSubissueOnDisk(
    title: string,
    parent: IssueFolder,
    content?: string,
  ): Promise<IssueFolder> {
    const created = await this.createIssueOnDisk(title, undefined, content);
    const repo = await useCurrentTrackerRepoStore
      .getState()
      .getCurrentTrackerRepo();
    const globalConfig = await useGlobalConfigStore
      .getState()
      .ensureGlobalConfig();
    const storage = new TrackerRepoStorage(repo, globalConfig);
    const issueFilePattern = storage.getIssueFilePattern();
    const parentFolderStorage = new IssueFolderStorage(parent);
    await parentFolderStorage.appendSubissue(created.issueId, issueFilePattern);
    const childFolderStorage = new IssueFolderStorage(created);
    await childFolderStorage.setParent(parent.issueId, issueFilePattern);
    return created;
  }

  private async createIssueOnDisk(
    title?: string,
    filePath?: string,
    content?: string,
  ): Promise<IssueFolder> {
    const fileService = FileService.getInstance();
    const shellService = ShellService.getInstance();
    const repo = await useCurrentTrackerRepoStore
      .getState()
      .getCurrentTrackerRepo();
    const globalConfig = await useGlobalConfigStore
      .getState()
      .ensureGlobalConfig();
    const storage = new TrackerRepoStorage(repo, globalConfig);
    const nextIssueIdHelper = new NextIssueIdHelper(storage);

    if (filePath !== undefined && filePath !== "") {
      const resolvedPath = shellService.isAbsolute(filePath)
        ? filePath
        : path.resolve(shellService.cwd(), filePath);
      if (!(await fileService.exists(resolvedPath))) {
        throw new Error("File not found.");
      }
      const stat = await fileService.stat(resolvedPath);
      if (!stat.isFile()) {
        throw new Error("A directory is not accepted.");
      }
      if (await fileService.isBinaryFile(resolvedPath)) {
        throw new Error("Binary files are not accepted.");
      }
      const fileTitle = await IssueResource.deriveTitleFromFile(resolvedPath);
      const label = await nextIssueIdHelper.allocateNextIssueId();
      const folderBasename = IssueResource.issueIdForTitle(label, fileTitle);
      const issueDirPath = path.join(storage.getIssuePath(), folderBasename);
      const issueFolder: IssueFolder = {
        issueId: folderBasename,
        label,
        path: issueDirPath,
      };
      const issueFilePath = await storage.resolveIssueFilePath(issueFolder);
      return this.issueResource.createFromFile(
        resolvedPath,
        issueFolder,
        issueFilePath,
        fileTitle,
      );
    }

    if (title === undefined || title.trim() === "") {
      throw new Error("Issue title is required");
    }
    const label = await nextIssueIdHelper.allocateNextIssueId();
    const folderBasename = IssueResource.issueIdForTitle(label, title);
    const issueDirPath = path.join(storage.getIssuePath(), folderBasename);
    const issueFolder: IssueFolder = {
      issueId: folderBasename,
      label,
      path: issueDirPath,
    };
    const issueFilePath = await storage.resolveIssueFilePath(issueFolder);
    return this.issueResource.create(
      issueFolder,
      issueFilePath,
      title,
      undefined,
      storage.getDefaultStatus(),
      storage.getDefaultPriority(),
      storage.getIssueFilePattern(),
      content,
    );
  }

  async openCreatedIssue(created: IssueFolder): Promise<void> {
    await useAppStore.getState().refreshIssueLists();
    useAppStore.getState().openIssue(created);
  }
}
