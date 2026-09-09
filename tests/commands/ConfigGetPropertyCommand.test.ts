import { jest } from "@jest/globals";
import { ConfigGetPropertyCommand } from "../../src/commands/ConfigGetPropertyCommand.ts";
import type { TrackerRepo } from "../../src/types/Tracker.ts";
import { createMockSystemContext } from "../fixture/MockSystemContext.tsx";

describe("ConfigGetPropertyCommand", () => {
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
    const result = await new ConfigGetPropertyCommand().command("invalid key");

    expect(result.status).toBe("error");
    expect((result as { error: { code: string } }).error.code).toBe(
      "GET_CONFIG_INVALID_PROPERTY",
    );
    expect(trackerRepoStore.getCurrentTrackerRepo).not.toHaveBeenCalled();
  });

  test("returns ErrorResponse when repo has no configFilePath", async () => {
    trackerRepoStore.getCurrentTrackerRepo.mockResolvedValue(
      mockRepoWithoutConfigPath,
    );

    const result = await new ConfigGetPropertyCommand().command("editor");

    expect(result.status).toBe("error");
    expect((result as { error: { code: string } }).error.code).toBe(
      "MUD_CONFIG_NOT_FOUND",
    );
    expect(loggerService.info).not.toHaveBeenCalled();
  });

  test("throws PROJECT_NOT_FOUND when project is passed but not found", async () => {
    trackerRepoStore.getTrackerRepoByProjectName.mockResolvedValue(null);

    await expect(
      new ConfigGetPropertyCommand().command("editor", "missing"),
    ).rejects.toMatchObject({
      status: "error",
      error: { code: "PROJECT_NOT_FOUND" },
    });
  });

  test("returns ErrorResponse when property is missing", async () => {
    trackerRepoStore.getCurrentTrackerRepo.mockResolvedValue(
      mockRepoWithConfigPath,
    );
    fileService.readFile.mockResolvedValue("issue_path: issues\n");

    const result = await new ConfigGetPropertyCommand().command("editor");

    expect(result.status).toBe("error");
    expect((result as { error: { code: string } }).error.code).toBe(
      "GET_CONFIG_PROPERTY_NOT_FOUND",
    );
    expect(loggerService.info).not.toHaveBeenCalled();
  });

  test("returns scalar property and logs it", async () => {
    trackerRepoStore.getCurrentTrackerRepo.mockResolvedValue(
      mockRepoWithConfigPath,
    );
    fileService.readFile.mockResolvedValue(
      `# comment
editor: vim
issue_path: issues
`,
    );

    const result = await new ConfigGetPropertyCommand().command("editor");

    expect(result.status).toBe("ok");
    expect(result.result).toEqual({
      configFilePath: "/repo/mud.conf",
      property: "editor",
      value: "vim",
    });
    expect(loggerService.info).toHaveBeenCalledWith("vim");
  });

  test("returns array property and logs JSON", async () => {
    trackerRepoStore.getCurrentTrackerRepo.mockResolvedValue(
      mockRepoWithConfigPath,
    );
    fileService.readFile.mockResolvedValue(`status_list:
  - open
  - done
`);

    const result = await new ConfigGetPropertyCommand().command("status_list");

    expect(result.status).toBe("ok");
    expect(result.result.value).toEqual(["open", "done"]);
    expect(loggerService.info).toHaveBeenCalledWith(
      JSON.stringify(["open", "done"]),
    );
  });

  test("gets property for a named project", async () => {
    const projectRepo: TrackerRepo = {
      name: "proj-a",
      projectPath: "/ws/proj-a",
      trackerPath: "/ws/proj-a",
      config: { issue_path: "issues" },
      configFilePath: "/ws/proj-a/mud.conf",
    };
    trackerRepoStore.getTrackerRepoByProjectName.mockResolvedValue(projectRepo);
    fileService.readFile.mockResolvedValue("editor: nvim\n");

    const result = await new ConfigGetPropertyCommand().command(
      "editor",
      "proj-a",
    );

    expect(result.status).toBe("ok");
    expect(result.result).toEqual({
      configFilePath: "/ws/proj-a/mud.conf",
      property: "editor",
      value: "nvim",
    });
    expect(fileService.readFile).toHaveBeenCalledWith(
      "/ws/proj-a/mud.conf",
      "utf-8",
    );
  });
});
