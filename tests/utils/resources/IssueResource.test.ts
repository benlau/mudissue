import { jest } from "@jest/globals";
import matter from "gray-matter";
import { DateFormatter } from "../../../src/foundation/formatter/DateFormatter.ts";
import { FileNameFormatter } from "../../../src/foundation/formatter/FileNameFormatter.ts";
import { ISSUE_FOLDER_NAME_MAX_LENGTH } from "../../../src/constants.ts";
import { IssueResource } from "../../../src/utils/resources/IssueResource.ts";
import { FileService } from "../../../src/services/FileService.ts";
import { TemplateGenerator } from "../../../src/utils/generators/TemplateGenerator.ts";
import type { IssueFolder } from "../../../src/types/Issue.ts";

describe("IssueResource", () => {
  const MOCK_NOW = new Date(2024, 5, 15, 12, 30, 45);
  const getNow = () => MOCK_NOW;

  let mockFileService: {
    exists: jest.Mock;
    readFile: jest.Mock;
    writeFile: jest.Mock;
    mkdir: jest.Mock;
  };
  let savedFileService: FileService;

  const sampleIssueFolder: IssueFolder = { issueId: "0001-test-issue", label: "0001", path: "/repo/issues/0001-test-issue",
   };

  beforeEach(() => {
    savedFileService = FileService.getInstance();
    mockFileService = {
      exists: jest.fn(),
      readFile: jest.fn(),
      writeFile: jest.fn(),
      mkdir: jest.fn(),
    };
    FileService.setInstance(mockFileService as unknown as FileService);
  });

  afterEach(() => {
    FileService.setInstance(savedFileService);
  });

  describe("Static properties", () => {
    it("should have resourceType = 'issue'", () => {
      expect(IssueResource.resourceType).toBe("issue");
    });
  });

  describe("issueIdForTitle()", () => {
    it("builds issue id from label and title slug", () => {
      expect(IssueResource.issueIdForTitle("PROJ-10", "Provided issue")).toBe(
        "PROJ-10-provided-issue",
      );
    });

    it("strips square brackets from title slug for wikilink compatibility", () => {
      expect(IssueResource.issueIdForTitle("MI0001", "Fix [auth]")).toBe(
        "MI0001-fix-auth",
      );
    });

    it("strips hash from title slug", () => {
      expect(
        IssueResource.issueIdForTitle(
          "MZ0012",
          "# should be forbidden in branch name",
        ),
      ).toBe("MZ0012-should-be-forbidden-in-branch-name");
    });

    it("strips dots and parentheses from title slug", () => {
      expect(
        IssueResource.issueIdForTitle("MI0301", '". " should be … in issue folder'),
      ).toBe("MI0301-should-be-…-in-issue-folder");
    });

    it("truncates issue id to ISSUE_FOLDER_NAME_MAX_LENGTH with end truncation", () => {
      const title =
        "Very long issue title that would produce an oversized folder name";
      const issueId = IssueResource.issueIdForTitle("MI0001", title);
      const slug = FileNameFormatter.format(title) || "issue";
      const fullName = IssueResource.withSlug("MI0001", slug);

      expect(issueId).toBe(fullName.slice(0, ISSUE_FOLDER_NAME_MAX_LENGTH));
      expect(issueId).toHaveLength(ISSUE_FOLDER_NAME_MAX_LENGTH);
      expect(issueId).not.toMatch(/…/);
    });
  });

  describe("deriveTitleFromFile()", () => {
    it("uses frontmatter title when present", async () => {
      mockFileService.readFile.mockResolvedValue(
        "---\ntitle: From YAML\n---\n\n# Body\n",
      );
      const title = await IssueResource.deriveTitleFromFile("/abs/plan.md");
      expect(title).toBe("From YAML");
    });

    it("uses first heading when no frontmatter title", async () => {
      mockFileService.readFile.mockResolvedValue("# First Heading\n\nBody.");
      const title = await IssueResource.deriveTitleFromFile("/path/doc.md");
      expect(title).toBe("First Heading");
    });
  });

  describe("create()", () => {
    it("writes template to issue file and creates directory", async () => {
      const mockTemplateGenerator = {
        getTemplate: jest.fn().mockReturnValue("---\ntitle: Test issue\n---\n"),
      } as unknown as jest.Mocked<TemplateGenerator>;

      const issueResource = new IssueResource({
        templateGenerator: mockTemplateGenerator,
        getNow,
      });

      const result = await issueResource.create(
        sampleIssueFolder,
        "/repo/issues/0001-test-issue/issue.md",
        "Test issue",
      );

      expect(mockFileService.mkdir).toHaveBeenCalledWith(
        "/repo/issues/0001-test-issue",
        { recursive: true },
      );
      expect(mockFileService.writeFile).toHaveBeenCalledWith(
        "/repo/issues/0001-test-issue/issue.md",
        "---\ntitle: Test issue\n---\n",
      );
      expect(result.issueId).toBe("0001-test-issue");
      expect(result.metadata?.title).toBe("Test issue");
    });

    it("uses defaultStatus in template context when provided", async () => {
      const mockTemplateGenerator = {
        getTemplate: jest.fn().mockReturnValue("---\ntitle: Test issue\n---\n"),
      } as unknown as jest.Mocked<TemplateGenerator>;

      const issueResource = new IssueResource({
        templateGenerator: mockTemplateGenerator,
        getNow,
      });

      await issueResource.create(
        sampleIssueFolder,
        "/repo/issues/0001-test-issue/issue.md",
        "Test issue",
        undefined,
        "pending",
      );

      expect(mockTemplateGenerator.getTemplate).toHaveBeenCalledWith("issue", {
        quotedTitle: JSON.stringify("Test issue"),
        title: "Test issue",
        created_at: DateFormatter.format(MOCK_NOW),
        status: "pending",
        priority: "urgent",
      });
    });

    it("includes created_at from getNow in template context", async () => {
      const mockTemplateGenerator = {
        getTemplate: jest.fn().mockReturnValue("---\ntitle: Test issue\n---\n"),
      } as unknown as jest.Mocked<TemplateGenerator>;

      const issueResource = new IssueResource({
        templateGenerator: mockTemplateGenerator,
        getNow,
      });

      await issueResource.create(
        sampleIssueFolder,
        "/repo/issues/0001-test-issue/issue.md",
        "Test issue",
      );

      const templateArgs = mockTemplateGenerator.getTemplate.mock.calls[0][1];
      expect(templateArgs?.created_at).toBe(DateFormatter.format(MOCK_NOW));
    });

    it("writes parent frontmatter when parentFolderName is provided", async () => {
      const templateContent =
        "---\ntitle: Child issue\ncreated_at: 2024-06-15\n---\n\n";
      mockFileService.readFile.mockResolvedValue(templateContent);
      const mockTemplateGenerator = {
        getTemplate: jest.fn().mockReturnValue(templateContent),
      } as unknown as jest.Mocked<TemplateGenerator>;

      const issueResource = new IssueResource({
        templateGenerator: mockTemplateGenerator,
        getNow,
      });

      await issueResource.create(
        sampleIssueFolder,
        "/repo/issues/0001-test-issue/issue.md",
        "Child issue",
        "FN004-parent-feature",
        undefined,
        undefined,
        "fixed",
      );

      expect(mockFileService.writeFile).toHaveBeenCalledTimes(2);
      const writtenContent = mockFileService.writeFile.mock.calls[1][1] as string;
      const parsed = matter(writtenContent);
      expect(parsed.data.parent).toBe("FN004-parent-feature");
    });

    it("appends body content when content is provided", async () => {
      const templateContent =
        "---\ntitle: Test issue\ncreated_at: 2024-06-15\n---\n\n# Test issue\n\n";
      mockFileService.readFile.mockResolvedValue(templateContent);
      const mockTemplateGenerator = {
        getTemplate: jest.fn().mockReturnValue(templateContent),
      } as unknown as jest.Mocked<TemplateGenerator>;

      const issueResource = new IssueResource({
        templateGenerator: mockTemplateGenerator,
        getNow,
      });

      await issueResource.create(
        sampleIssueFolder,
        "/repo/issues/0001-test-issue/issue.md",
        "Test issue",
        undefined,
        undefined,
        undefined,
        "fixed",
        "Body line",
      );

      expect(mockFileService.writeFile).toHaveBeenCalledTimes(2);
      const writtenContent = mockFileService.writeFile.mock.calls[1][1] as string;
      const parsed = matter(writtenContent);
      expect(parsed.content).toContain("Body line");
    });

    it("writes parent as wikilink when issue file pattern is long", async () => {
      const templateContent =
        "---\ntitle: Child issue\ncreated_at: 2024-06-15\n---\n\n";
      mockFileService.readFile.mockResolvedValue(templateContent);
      const mockTemplateGenerator = {
        getTemplate: jest.fn().mockReturnValue(templateContent),
      } as unknown as jest.Mocked<TemplateGenerator>;

      const issueResource = new IssueResource({
        templateGenerator: mockTemplateGenerator,
        getNow,
      });

      await issueResource.create(
        sampleIssueFolder,
        "/repo/issues/0001-test-issue/issue.md",
        "Child issue",
        "FN004-parent-feature",
        undefined,
        undefined,
        "long",
      );

      const writtenContent = mockFileService.writeFile.mock.calls[1][1] as string;
      const parsed = matter(writtenContent);
      expect(parsed.data.parent).toBe("[[FN004-parent-feature]]");
    });

    it("errors if title is missing", async () => {
      const issueResource = new IssueResource({
        getNow,
      });

      await expect(
        issueResource.create(
          sampleIssueFolder,
          "/repo/issues/0001-test-issue/issue.md",
          "",
        ),
      ).rejects.toThrow("Issue title is required");
      expect(mockFileService.writeFile).not.toHaveBeenCalled();
    });
  });

  describe("createFromFile()", () => {
    it("copies source file content to issue file", async () => {
      const sourcePath = "/abs/plan.md";
      const sourceContent = "---\ntitle: From YAML\n---\n\nBody.";
      mockFileService.readFile.mockResolvedValue(sourceContent);

      const issueFolder: IssueFolder = { issueId: "0001-from-yaml", label: "0001", path: "/repo/issues/0001-from-yaml",
       };

      const issueResource = new IssueResource({
        getNow,
      });

      const result = await issueResource.createFromFile(
        sourcePath,
        issueFolder,
        "/repo/issues/0001-from-yaml/issue.md",
        "From YAML",
      );

      expect(mockFileService.mkdir).toHaveBeenCalledWith(
        "/repo/issues/0001-from-yaml",
        { recursive: true },
      );
      expect(mockFileService.writeFile).toHaveBeenCalledWith(
        "/repo/issues/0001-from-yaml/issue.md",
        sourceContent,
      );
      expect(result.metadata?.title).toBe("From YAML");
    });
  });
});
