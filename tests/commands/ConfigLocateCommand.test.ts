import { jest } from "@jest/globals";
import { ConfigLocateCommand } from "../../src/commands/ConfigLocateCommand.ts";
import type { TrackerRepo } from "../../src/types/Tracker.ts";
import {
  GLOBAL_CONFIG_DIR,
  GLOBAL_CONFIG_FILENAME,
} from "../../src/constants.ts";
import { createMockSystemContext } from "../fixture/MockSystemContext.tsx";

describe("ConfigLocateCommand", () => {
  let trackerRepoStore: ReturnType<typeof createMockSystemContext>["trackerRepoStore"];
  let loggerService: ReturnType<typeof createMockSystemContext>["loggerService"];

  const mockRepoWithConfigPath: TrackerRepo = {
    name: "my-repo",
    projectPath: "/repo",
    trackerPath: "/repo",
    config: { issue_path: "issues" },
    configFilePath: "/repo/mud.conf",
  };

  const mockRepoWithoutConfigPath: TrackerRepo = {
    name: "my-repo",
    projectPath: "/repo",
    trackerPath: "/repo",
    config: { issue_path: "issues" },
  };

  beforeEach(() => {
    const bundle = createMockSystemContext();
    trackerRepoStore = bundle.trackerRepoStore;
    loggerService = bundle.loggerService;

    jest.clearAllMocks();
  });

  const buildCommand = () => new ConfigLocateCommand();

  it("returns global config path when global is true and logs it", async () => {
    const command = buildCommand();

    const result = await command.command(true);

    expect(result?.status).toBe("ok");
    const path = (result as { result: { path: string } }).result.path;
    expect(path).toContain(GLOBAL_CONFIG_DIR);
    expect(path).toContain(GLOBAL_CONFIG_FILENAME);
    expect(loggerService.info).toHaveBeenCalledWith(path);
    expect(trackerRepoStore.getCurrentTrackerRepo).not.toHaveBeenCalled();
  });

  it("returns repo config path when global is false", async () => {
    trackerRepoStore.getCurrentTrackerRepo.mockResolvedValue(
      mockRepoWithConfigPath,
    );

    const command = buildCommand();
    const result = await command.command(false);

    expect(result?.status).toBe("ok");
    expect((result as { result: { path: string } }).result.path).toBe(
      "/repo/mud.conf",
    );
    expect(loggerService.info).toHaveBeenCalledWith("/repo/mud.conf");
  });

  it("returns error when global is false and repo has no configFilePath", async () => {
    trackerRepoStore.getCurrentTrackerRepo.mockResolvedValue(
      mockRepoWithoutConfigPath,
    );

    const command = buildCommand();
    const result = await command.command(false);

    expect(result?.status).toBe("error");
    expect((result as { error: { code: string } }).error.code).toBe(
      "MUD_CONFIG_NOT_FOUND",
    );
    expect(loggerService.info).not.toHaveBeenCalled();
  });

  it("returns project config path when project is set", async () => {
    const projectRepo: TrackerRepo = {
      name: "proj-a",
      projectPath: "/ws/proj-a",
      trackerPath: "/ws/proj-a",
      config: { issue_path: "issues" },
      configFilePath: "/ws/proj-a/mud.conf",
    };
    trackerRepoStore.getTrackerRepoByProjectName.mockResolvedValue(
      projectRepo,
    );

    const command = buildCommand();
    const result = await command.command(false, "proj-a");

    expect(result?.status).toBe("ok");
    expect((result as { result: { path: string } }).result.path).toBe(
      "/ws/proj-a/mud.conf",
    );
    expect(trackerRepoStore.getTrackerRepoByProjectName).toHaveBeenCalledWith(
      "proj-a",
    );
    expect(trackerRepoStore.getCurrentTrackerRepo).not.toHaveBeenCalled();
    expect(loggerService.info).toHaveBeenCalledWith("/ws/proj-a/mud.conf");
  });

  it("throws PROJECT_NOT_FOUND when project is set but not found", async () => {
    trackerRepoStore.getTrackerRepoByProjectName.mockResolvedValue(
      null,
    );

    const command = buildCommand();
    await expect(command.command(false, "nonexistent")).rejects.toMatchObject({
      error: {
        code: "PROJECT_NOT_FOUND",
        message: expect.stringContaining("Project not found"),
        details: { project: "nonexistent" },
      },
    });
    expect(loggerService.info).not.toHaveBeenCalled();
  });
});
