import { jest } from "@jest/globals";
import { TrackerRepoLocateCommand } from "../../src/commands/TrackerRepoLocateCommand.ts";
import type { TrackerRepo } from "../../src/types/Tracker.ts";
import { createMockSystemContext } from "../fixture/MockSystemContext.tsx";

describe("TrackerRepoLocateCommand", () => {
  let trackerRepoStore: ReturnType<typeof createMockSystemContext>["trackerRepoStore"];
  let loggerService: ReturnType<typeof createMockSystemContext>["loggerService"];

  const currentRepo: TrackerRepo = {
    name: "root",
    projectPath: "/workspace/root",
    trackerPath: "/workspace/root",
    config: { issue_path: "issues" },
  };

  beforeEach(() => {
    const bundle = createMockSystemContext();
    trackerRepoStore = bundle.trackerRepoStore;
    loggerService = bundle.loggerService;

    jest.clearAllMocks();
  });

  const buildCommand = () => new TrackerRepoLocateCommand();

  it("returns the current tracker folder path and logs it", async () => {
    trackerRepoStore.getCurrentTrackerRepo.mockResolvedValue(currentRepo);

    const result = await buildCommand().command();

    expect(result).toEqual({
      status: "ok",
      result: { path: "/workspace/root" },
    });
    expect(loggerService.info).toHaveBeenCalledWith("/workspace/root");
  });

  it("returns the tracker folder path when it differs from the project path", async () => {
    trackerRepoStore.getCurrentTrackerRepo.mockResolvedValue({
      ...currentRepo,
      projectPath: "/workspace/root",
      trackerPath: "/data/tracker",
    });

    const result = await buildCommand().command();

    expect(result).toEqual({
      status: "ok",
      result: { path: "/data/tracker" },
    });
    expect(loggerService.info).toHaveBeenCalledWith("/data/tracker");
  });

  it("returns the project tracker folder path when project is set", async () => {
    trackerRepoStore.getTrackerRepoByProjectName.mockResolvedValue({
      name: "docs",
      projectPath: "/workspace/docs",
      trackerPath: "/data/docs-tracker",
      config: { issue_path: "tasks" },
    });

    const result = await buildCommand().command("docs");

    expect(result).toEqual({
      status: "ok",
      result: { path: "/data/docs-tracker" },
    });
    expect(trackerRepoStore.getTrackerRepoByProjectName).toHaveBeenCalledWith(
      "docs",
    );
    expect(trackerRepoStore.getCurrentTrackerRepo).not.toHaveBeenCalled();
    expect(loggerService.info).toHaveBeenCalledWith("/data/docs-tracker");
  });

  it("throws PROJECT_NOT_FOUND when project is set but not found", async () => {
    trackerRepoStore.getTrackerRepoByProjectName.mockResolvedValue(null);

    await expect(buildCommand().command("missing")).rejects.toMatchObject({
      status: "error",
      error: {
        code: "PROJECT_NOT_FOUND",
        details: { project: "missing" },
      },
    });
    expect(loggerService.info).not.toHaveBeenCalled();
  });
});
