import { jest } from "@jest/globals";
import { TrackerRepoOpenCommand } from "../../src/commands/TrackerRepoOpenCommand.ts";
import { ShellService } from "../../src/services/ShellService.ts";
import type { TrackerRepo } from "../../src/types/Tracker.ts";
import { createMockSystemContext } from "../fixture/MockSystemContext.tsx";

describe("TrackerRepoOpenCommand", () => {
  let trackerRepoStore: ReturnType<typeof createMockSystemContext>["trackerRepoStore"];
  let shellService: ReturnType<typeof createMockSystemContext>["shellService"];
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
    shellService = bundle.shellService;
    loggerService = bundle.loggerService;

    trackerRepoStore.getCurrentTrackerRepo.mockResolvedValue(currentRepo);
    shellService.open.mockResolvedValue(undefined);
    ShellService.setInstance(shellService as unknown as ShellService);

    jest.clearAllMocks();
  });

  afterEach(() => {
    ShellService.setInstance(null);
  });

  const buildCommand = () => new TrackerRepoOpenCommand();

  it("opens the current tracker folder with the open package", async () => {
    const result = await buildCommand().command();

    expect(result).toEqual({
      status: "ok",
      result: {
        path: "/workspace/root",
      },
    });
    expect(shellService.open).toHaveBeenCalledWith("/workspace/root");
  });

  it("opens the tracker folder when it differs from the project path", async () => {
    trackerRepoStore.getCurrentTrackerRepo.mockResolvedValue({
      ...currentRepo,
      projectPath: "/workspace/root",
      trackerPath: "/data/tracker",
    });

    const result = await buildCommand().command();

    expect(result).toEqual({
      status: "ok",
      result: {
        path: "/data/tracker",
      },
    });
    expect(shellService.open).toHaveBeenCalledWith("/data/tracker");
  });

  it("opens the project tracker folder when project is set", async () => {
    trackerRepoStore.getTrackerRepoByProjectName.mockResolvedValue({
      name: "docs",
      projectPath: "/workspace/docs",
      trackerPath: "/data/docs-tracker",
      config: { issue_path: "tasks" },
    });

    const result = await buildCommand().command("docs");

    expect(result).toEqual({
      status: "ok",
      result: {
        path: "/data/docs-tracker",
      },
    });
    expect(trackerRepoStore.getTrackerRepoByProjectName).toHaveBeenCalledWith(
      "docs",
    );
    expect(trackerRepoStore.getCurrentTrackerRepo).not.toHaveBeenCalled();
    expect(shellService.open).toHaveBeenCalledWith("/data/docs-tracker");
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
    expect(shellService.open).not.toHaveBeenCalled();
  });
});
