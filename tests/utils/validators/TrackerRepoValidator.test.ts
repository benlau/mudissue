import { jest } from "@jest/globals";
import { TrackerRepoValidator } from "../../../src/utils/validators/TrackerRepoValidator.ts";
import type { TrackerRepo } from "../../../src/types/Tracker.ts";
import { LoggerService } from "../../../src/services/LoggerService.ts";

const mockRepo = (name: string): TrackerRepo => ({
  name,
  projectPath: `/fake/${name}`,
  trackerPath: `/fake/${name}`,
  config: {},
});

describe("TrackerRepoValidator", () => {
  const mockLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    LoggerService.setInstance(mockLogger as unknown as LoggerService);
  });

  describe("set", () => {
    it("stores value and returns this", () => {
      const repo = mockRepo("p1");
      const v = new TrackerRepoValidator();
      const chain = v.set(repo);
      expect(chain).toBe(v);
      expect(v.first()).toBe(repo);
    });
  });

  describe("validateProjectNotNone", () => {
    it("throws PROJECT_NOT_FOUND and calls logger.error when data is null", () => {
      const v = new TrackerRepoValidator().set(null);
      expect(() => v.validateProjectNotNone("myProject")).toThrow(
        expect.objectContaining({
          status: "error",
          error: expect.objectContaining({ code: "PROJECT_NOT_FOUND" }),
        }),
      );
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it("throws PROJECT_NOT_FOUND and calls logger.error when data is undefined", () => {
      const v = new TrackerRepoValidator().set(undefined);
      expect(() => v.validateProjectNotNone("x")).toThrow(
        expect.objectContaining({
          error: expect.objectContaining({
            code: "PROJECT_NOT_FOUND",
            details: { project: "x" },
          }),
        }),
      );
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it("throws PROJECT_NOT_FOUND and calls logger.error when data is empty array", () => {
      const v = new TrackerRepoValidator().set([]);
      expect(() => v.validateProjectNotNone("p")).toThrow(
        expect.objectContaining({
          error: expect.objectContaining({ code: "PROJECT_NOT_FOUND" }),
        }),
      );
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it("does not throw and returns this when data is single repo", () => {
      const repo = mockRepo("a");
      const v = new TrackerRepoValidator().set(repo);
      const chain = v.validateProjectNotNone("a");
      expect(chain).toBe(v);
      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it("does not throw and returns this when data is non-empty array", () => {
      const repos = [mockRepo("a"), mockRepo("b")];
      const v = new TrackerRepoValidator().set(repos);
      const chain = v.validateProjectNotNone("a");
      expect(chain).toBe(v);
      expect(mockLogger.error).not.toHaveBeenCalled();
    });
  });

  describe("first", () => {
    it("returns single repo when set with one repo", () => {
      const repo = mockRepo("r");
      const v = new TrackerRepoValidator()
        .set(repo)
        .validateProjectNotNone("r");
      expect(v.first()).toBe(repo);
    });

    it("returns first element when set with array", () => {
      const repos = [mockRepo("a"), mockRepo("b")];
      const v = new TrackerRepoValidator()
        .set(repos)
        .validateProjectNotNone("a");
      expect(v.first()).toBe(repos[0]);
    });
  });
});
