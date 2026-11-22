import { jest } from "@jest/globals";
import * as path from "path";
import type { IssueFolder } from "../../src/types/Issue.ts";
import { ViewPathResolverHelper } from "../../src/helpers/ViewPathResolverHelper.ts";
import { FileService } from "../../src/services/FileService.ts";
import type { TrackerRepo } from "../../src/types/Tracker.ts";
import { buildIssueFolder as buildIssueFolderFixture } from "../fixture/buildIssueFolder.ts";

const mockRepo: TrackerRepo = {
  name: "proj",
  projectPath: path.join(path.sep, "repo"),
  trackerPath: path.join(path.sep, "repo"),
  config: { issue_path: "issues" },
};

describe("ViewPathResolverHelper", () => {
  describe("isPathUnderTrackerPath", () => {
    it("returns true when the path equals the tracker root", () => {
      const tracker = path.join(path.sep, "repo");
      expect(
        ViewPathResolverHelper.isPathUnderTrackerPath(tracker, tracker),
      ).toBe(true);
    });

    it("returns true when the path is nested under the tracker root", () => {
      const tracker = path.join(path.sep, "repo");
      const nested = path.join(tracker, "issues", "MI001-summary");
      expect(
        ViewPathResolverHelper.isPathUnderTrackerPath(nested, tracker),
      ).toBe(true);
    });

    it("returns false when the path is outside the tracker root", () => {
      const tracker = path.join(path.sep, "repo");
      const other = path.join(path.sep, "other");
      expect(
        ViewPathResolverHelper.isPathUnderTrackerPath(other, tracker),
      ).toBe(false);
    });
  });

  describe("isIssueSelectorPathSegment", () => {
    it("accepts issue folder names, labels, and numbers", () => {
      expect(
        ViewPathResolverHelper.isIssueSelectorPathSegment("MI001-summary"),
      ).toBe(true);
      expect(ViewPathResolverHelper.isIssueSelectorPathSegment("MI001")).toBe(
        true,
      );
      expect(ViewPathResolverHelper.isIssueSelectorPathSegment("1")).toBe(true);
    });

    it("rejects arbitrary path segments", () => {
      expect(ViewPathResolverHelper.isIssueSelectorPathSegment("files")).toBe(
        false,
      );
      expect(
        ViewPathResolverHelper.isIssueSelectorPathSegment("readme.md"),
      ).toBe(false);
    });
  });

  describe("resolveIssueFromViewPath", () => {
    const savedFileService = FileService.getInstance();

    beforeEach(() => {
      FileService.setInstance({
        stat: jest.fn(async (filePath: string) => ({
          isDirectory: () => !filePath.endsWith(".md"),
        })),
      } as unknown as FileService);
    });

    afterEach(() => {
      FileService.setInstance(savedFileService);
    });

    const issueFolder = buildIssueFolderFixture("MI001-summary", {
      path: path.join(mockRepo.projectPath, "issues", "MI001-summary"),
      title: "t",
      status: "open",
    });

    it("uses the parent folder name when the path is an issue markdown file", async () => {
      const nested = path.join(
        mockRepo.projectPath,
        "issues",
        "MI001-summary",
        "files",
        "note.md",
      );
      const findIssue = jest.fn<(selector: string) => Promise<IssueFolder[]>>(
        async (selector) =>
          selector === "MI001-summary" ? [issueFolder] : [],
      );

      const result = await ViewPathResolverHelper.resolveIssueFromViewPath(
        nested,
        findIssue,
      );

      expect(result).toBe(issueFolder);
      expect(findIssue).toHaveBeenCalledWith("MI001-summary");
    });

    it("uses the parent folder when the filename looks like an issue slug (long pattern)", async () => {
      const issue0019 = buildIssueFolderFixture("0019-free-fight-mode-prototype", {
        path: path.join(
          mockRepo.projectPath,
          "issues",
          "0019-free-fight-mode-prototype",
        ),
        title: "t",
        status: "open",
      });
      const issueFile = path.join(
        mockRepo.projectPath,
        "issues",
        "0019-free-fight-mode-prototype",
        "0019-free-fight-mode-prototype.md",
      );
      const findIssue = jest.fn<(selector: string) => Promise<IssueFolder[]>>(
        async (selector) =>
          selector === "0019-free-fight-mode-prototype" ? [issue0019] : [],
      );

      const result = await ViewPathResolverHelper.resolveIssueFromViewPath(
        issueFile,
        findIssue,
      );

      expect(result).toBe(issue0019);
      expect(findIssue).toHaveBeenCalledWith("0019-free-fight-mode-prototype");
      expect(findIssue).not.toHaveBeenCalledWith(
        "0019-free-fight-mode-prototype.md",
      );
    });

    it("returns null when findIssue finds no issue for the derived selector", async () => {
      const nested = path.join(
        mockRepo.projectPath,
        "issues",
        "MI001-summary",
        "files",
        "note.md",
      );
      const findIssue = jest.fn(async () => [] as IssueFolder[]);

      const result = await ViewPathResolverHelper.resolveIssueFromViewPath(
        nested,
        findIssue,
      );

      expect(result).toBeNull();
    });

    it("uses the first match when findIssue returns multiple issues", async () => {
      const other = buildIssueFolderFixture("MI001-dupe", {
        path: path.join(mockRepo.projectPath, "issues", "MI001-dupe"),
        title: "t",
        status: "open",
      });
      const nested = path.join(mockRepo.projectPath, "issues", "MI001");
      const findIssue = jest.fn(async () => [issueFolder, other]);

      const result = await ViewPathResolverHelper.resolveIssueFromViewPath(
        nested,
        findIssue,
      );

      expect(result).toBe(issueFolder);
    });
  });

});