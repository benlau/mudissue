import { jest } from "@jest/globals";
import { FileService } from "../../../src/services/FileService.ts";
import { GitService } from "../../../src/services/GitService.ts";
import { FileUrlTraveler } from "../../../src/utils/travelers/FileUrlTraveler.ts";
import type { FileService as FileServiceType } from "../../../src/services/FileService.ts";

describe("FileUrlTraveler", () => {
  let mockFileService: jest.Mocked<Pick<FileServiceType, "exists" | "stat">>;
  let savedFileService: FileServiceType;

  beforeEach(() => {
    savedFileService = FileService.getInstance();
    GitService.setInstance(null);
    mockFileService = {
      exists: jest.fn(),
      stat: jest.fn(),
    } as unknown as jest.Mocked<Pick<FileServiceType, "exists" | "stat">>;
    FileService.setInstance(mockFileService as FileServiceType);
    jest.clearAllMocks();
  });

  afterEach(() => {
    FileService.setInstance(savedFileService);
  });

  test("invokes callback with file URL for start path and stops when callback returns true", async () => {
    (mockFileService.exists as jest.Mock).mockResolvedValue(false);
    (mockFileService.stat as jest.Mock).mockResolvedValue({ isDirectory: (): boolean => false });

    const traveler = new FileUrlTraveler({ maxDepth: 5 });
    const seen: string[] = [];
    const result = await traveler.travel("file:///home/proj/sub", async (url) => {
      seen.push(url);
      return true;
    });
    expect(seen.length).toBe(1);
    expect(seen[0]).toMatch(/file:\/\/.+\/sub$/);
    expect(result).toBe(seen[0]);
  });

  test("traverses to parent when no gitdir", async () => {
    (mockFileService.exists as jest.Mock).mockResolvedValue(false);
    (mockFileService.stat as jest.Mock).mockResolvedValue({ isDirectory: () => true });

    const traveler = new FileUrlTraveler({ maxDepth: 5 });
    const seen: string[] = [];
    await traveler.travel("file:///home/proj", async (url) => {
      seen.push(url);
      return false;
    });
    expect(seen.length).toBeGreaterThanOrEqual(1);
    expect(seen[0]).toMatch(/file:\/\/.+\/proj$/);
  });

  test("when path is empty, does not travel and does not use cwd", async () => {
    const traveler = new FileUrlTraveler();
    const seen: string[] = [];
    const result = await traveler.travel("", async (url) => {
      seen.push(url);
      return true;
    });
    expect(result).toBeUndefined();
    expect(seen.length).toBe(0);
  });
});
