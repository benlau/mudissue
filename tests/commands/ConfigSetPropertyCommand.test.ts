import { jest } from "@jest/globals";
import { ConfigSetPropertyCommand } from "../../src/commands/ConfigSetPropertyCommand.ts";
import type { TrackerRepo } from "../../src/types/Tracker.ts";
import { createMockSystemContext } from "../fixture/MockSystemContext.tsx";

describe("ConfigSetPropertyCommand", () => {
  let fileService: ReturnType<typeof createMockSystemContext>["fileService"];
  let trackerRepoStore: ReturnType<
    typeof createMockSystemContext
  >["trackerRepoStore"];
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
    fileService = bundle.fileService;
    trackerRepoStore = bundle.trackerRepoStore;
    loggerService = bundle.loggerService;

    jest.clearAllMocks();
  });

  test("returns ErrorResponse when property key is invalid", async () => {
    const result = await new ConfigSetPropertyCommand().command(
      "invalid key",
      "value",
    );

    expect(result.status).toBe("error");
    expect((result as { error: { code: string } }).error.code).toBe(
      "SET_CONFIG_INVALID_PROPERTY",
    );
    expect(trackerRepoStore.getCurrentTrackerRepo).not.toHaveBeenCalled();
  });

  test("returns ErrorResponse when repo has no configFilePath", async () => {
    trackerRepoStore.getCurrentTrackerRepo.mockResolvedValue(
      mockRepoWithoutConfigPath,
    );

    const result = await new ConfigSetPropertyCommand().command(
      "editor",
      "vim",
    );

    expect(result.status).toBe("error");
    expect((result as { error: { code: string } }).error.code).toBe(
      "MUD_CONFIG_NOT_FOUND",
    );
    expect(fileService.writeFile).not.toHaveBeenCalled();
  });

  test("throws PROJECT_NOT_FOUND when project is passed but not found", async () => {
    trackerRepoStore.getTrackerRepoByProjectName.mockResolvedValue(null);

    await expect(
      new ConfigSetPropertyCommand().command("editor", "vim", "missing"),
    ).rejects.toMatchObject({
      status: "error",
      error: { code: "PROJECT_NOT_FOUND" },
    });
  });

  test("sets a string property and preserves comments and unrelated keys", async () => {
    trackerRepoStore.getCurrentTrackerRepo.mockResolvedValue(
      mockRepoWithConfigPath,
    );
    const originalContent = `# Project config
# Keep this comment
editor: vim
issue_path: issues
`;
    fileService.readFile.mockResolvedValue(originalContent);
    fileService.writeFile.mockResolvedValue(undefined);

    const result = await new ConfigSetPropertyCommand().command(
      "editor",
      "nvim",
    );

    expect(result.status).toBe("ok");
    expect(result.result).toEqual({
      configFilePath: "/repo/mud.conf",
      property: "editor",
      value: "nvim",
    });
    expect(fileService.readFile).toHaveBeenCalledWith(
      "/repo/mud.conf",
      "utf-8",
    );
    expect(fileService.writeFile).toHaveBeenCalledWith(
      "/repo/mud.conf",
      `# Project config
# Keep this comment
editor: nvim
issue_path: issues
`,
    );
    expect(loggerService.info).toHaveBeenCalled();
  });

  test("writes a YAML boolean when type is boolean", async () => {
    trackerRepoStore.getCurrentTrackerRepo.mockResolvedValue(
      mockRepoWithConfigPath,
    );
    fileService.readFile.mockResolvedValue("editor: vim\n");
    fileService.writeFile.mockResolvedValue(undefined);

    const result = await new ConfigSetPropertyCommand().command(
      "worktree_git_ff_only_enabled",
      "true",
      undefined,
      { type: "boolean" },
    );

    expect(result.status).toBe("ok");
    expect(result.result.value).toBe(true);
    expect(fileService.writeFile).toHaveBeenCalledWith(
      "/repo/mud.conf",
      `editor: vim
worktree_git_ff_only_enabled: true
`,
    );
  });

  test("writes a YAML number when type is number", async () => {
    trackerRepoStore.getCurrentTrackerRepo.mockResolvedValue(
      mockRepoWithConfigPath,
    );
    fileService.readFile.mockResolvedValue("editor: vim\n");
    fileService.writeFile.mockResolvedValue(undefined);

    const result = await new ConfigSetPropertyCommand().command(
      "max_depth",
      "3",
      undefined,
      { type: "number" },
    );

    expect(result.status).toBe("ok");
    expect(result.result.value).toBe(3);
    expect(fileService.writeFile).toHaveBeenCalledWith(
      "/repo/mud.conf",
      `editor: vim
max_depth: 3
`,
    );
  });

  test("throws COMMAND_INVALID_ARG when type is invalid", async () => {
    await expect(
      new ConfigSetPropertyCommand().command("editor", "vim", undefined, {
        type: "array",
      }),
    ).rejects.toMatchObject({
      status: "error",
      error: { code: "COMMAND_INVALID_ARG" },
    });
  });

  test("throws COMMAND_INVALID_ARG when boolean value is invalid", async () => {
    trackerRepoStore.getCurrentTrackerRepo.mockResolvedValue(
      mockRepoWithConfigPath,
    );
    fileService.readFile.mockResolvedValue("editor: vim\n");

    await expect(
      new ConfigSetPropertyCommand().command(
        "worktree_git_ff_only_enabled",
        "maybe",
        undefined,
        { type: "boolean" },
      ),
    ).rejects.toMatchObject({
      status: "error",
      error: { code: "COMMAND_INVALID_ARG" },
    });
    expect(fileService.writeFile).not.toHaveBeenCalled();
  });

  test("skipIfPresent leaves an existing property unchanged", async () => {
    trackerRepoStore.getCurrentTrackerRepo.mockResolvedValue(
      mockRepoWithConfigPath,
    );
    fileService.readFile.mockResolvedValue("editor: vim\n");

    const result = await new ConfigSetPropertyCommand().command(
      "editor",
      "nvim",
      undefined,
      { skipIfPresent: true },
    );

    expect(result.status).toBe("ok");
    expect(result.result).toEqual({
      configFilePath: "/repo/mud.conf",
      property: "editor",
      value: "vim",
      skipped: true,
    });
    expect(fileService.writeFile).not.toHaveBeenCalled();
  });

  test("skipIfPresent sets the property when it is missing", async () => {
    trackerRepoStore.getCurrentTrackerRepo.mockResolvedValue(
      mockRepoWithConfigPath,
    );
    fileService.readFile.mockResolvedValue("issue_path: issues\n");
    fileService.writeFile.mockResolvedValue(undefined);

    const result = await new ConfigSetPropertyCommand().command(
      "editor",
      "vim",
      undefined,
      { skipIfPresent: true },
    );

    expect(result.status).toBe("ok");
    expect(result.result).toEqual({
      configFilePath: "/repo/mud.conf",
      property: "editor",
      value: "vim",
    });
    expect(fileService.writeFile).toHaveBeenCalled();
  });

  test("sets property for a named project", async () => {
    const projectRepo: TrackerRepo = {
      name: "proj-a",
      projectPath: "/ws/proj-a",
      trackerPath: "/ws/proj-a",
      config: { issue_path: "issues" },
      configFilePath: "/ws/proj-a/mud.conf",
    };
    trackerRepoStore.getTrackerRepoByProjectName.mockResolvedValue(projectRepo);
    fileService.readFile.mockResolvedValue("editor: vim\n");
    fileService.writeFile.mockResolvedValue(undefined);

    const result = await new ConfigSetPropertyCommand().command(
      "editor",
      "nvim",
      "proj-a",
    );

    expect(result.status).toBe("ok");
    expect(result.result.configFilePath).toBe("/ws/proj-a/mud.conf");
    expect(fileService.writeFile).toHaveBeenCalledWith(
      "/ws/proj-a/mud.conf",
      `editor: nvim
`,
    );
  });
});
