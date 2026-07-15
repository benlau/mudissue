import { jest } from "@jest/globals";
import { ConfigEditCommand } from "../../src/commands/ConfigEditCommand.ts";
import type { TrackerRepo } from "../../src/types/Tracker.ts";
import { ShellService } from "../../src/services/ShellService.ts";
import { createMockSystemContext } from "../fixture/MockSystemContext.tsx";

describe("ConfigEditCommand", () => {
  let trackerRepoStore: ReturnType<typeof createMockSystemContext>["trackerRepoStore"];
  let shellService: ReturnType<typeof createMockSystemContext>["shellService"];
  let loggerService: ReturnType<typeof createMockSystemContext>["loggerService"];

  const originalEnvEditor = process.env.MUDISSUE_EDITOR;

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
    shellService = bundle.shellService;
    loggerService = bundle.loggerService;

    trackerRepoStore.getCurrentTrackerRepo.mockResolvedValue(
      mockRepoWithConfigPath,
    );

    process.env.MUDISSUE_EDITOR = "my-editor";
    ShellService.setInstance(shellService as unknown as ShellService);
    shellService.run.mockImplementation(() => {});

    jest.clearAllMocks();

    process.env.MUDISSUE_EDITOR = "my-editor";
    trackerRepoStore.getCurrentTrackerRepo.mockResolvedValue(
      mockRepoWithConfigPath,
    );
    shellService.run.mockImplementation(() => {});
  });

  afterEach(() => {
    if (originalEnvEditor === undefined) {
      delete process.env.MUDISSUE_EDITOR;
    } else {
      process.env.MUDISSUE_EDITOR = originalEnvEditor;
    }
    ShellService.setInstance(null);
  });

  const buildCommand = () => new ConfigEditCommand();

  it("opens repo config file", async () => {
    trackerRepoStore.getCurrentTrackerRepo.mockResolvedValue(
      mockRepoWithConfigPath,
    );

    const cmd = buildCommand();
    const result = await cmd.command();

    expect(result?.status).toBe("ok");
    expect(shellService.run).toHaveBeenCalledWith("my-editor", [
      "/repo/mud.conf",
    ]);
    expect(
      (result as { result: { openedFile: string; command: string } }).result,
    ).toMatchObject({
      openedFile: "/repo/mud.conf",
      command: "my-editor /repo/mud.conf",
    });
    expect(loggerService.info).toHaveBeenCalled();
  });

  it("returns error when repo has no configFilePath", async () => {
    trackerRepoStore.getCurrentTrackerRepo.mockResolvedValue(
      mockRepoWithoutConfigPath,
    );

    const command = buildCommand();
    const result = await command.command();

    expect(result?.status).toBe("error");
    expect((result as { error: { code: string } }).error.code).toBe(
      "EDIT_CONFIG_NO_REPO_CONFIG",
    );
    expect(shellService.run).not.toHaveBeenCalled();
  });

  it("opens project config when project is set", async () => {
    const projectRepo: TrackerRepo = {
      name: "proj-a",
      projectPath: "/ws/proj-a",
      trackerPath: "/ws/proj-a",
      config: { issue_path: "issues" },
      configFilePath: "/ws/proj-a/mud.conf",
    };
    trackerRepoStore.getTrackerRepoByProjectName.mockResolvedValue(projectRepo);

    const cmd = buildCommand();
    const result = await cmd.command("proj-a");

    expect(result?.status).toBe("ok");
    expect(trackerRepoStore.getTrackerRepoByProjectName).toHaveBeenCalledWith(
      "proj-a",
    );
    expect(trackerRepoStore.getCurrentTrackerRepo).not.toHaveBeenCalled();
    expect(shellService.run).toHaveBeenCalledWith("my-editor", [
      "/ws/proj-a/mud.conf",
    ]);
    expect(loggerService.info).toHaveBeenCalled();
  });

  it("throws PROJECT_NOT_FOUND when project is set but not found", async () => {
    trackerRepoStore.getTrackerRepoByProjectName.mockResolvedValue(null);

    const command = buildCommand();
    await expect(command.command("nonexistent")).rejects.toMatchObject({
      error: {
        code: "PROJECT_NOT_FOUND",
        message: expect.stringContaining("Project not found"),
        details: { project: "nonexistent" },
      },
    });
    expect(shellService.run).not.toHaveBeenCalled();
  });
});
