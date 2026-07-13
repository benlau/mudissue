import { jest } from "@jest/globals";
import { RegistrySetProjectCommand } from "../../src/commands/RegistrySetProjectCommand.ts";
import { DatabaseService } from "../../src/db/DatabaseService.ts";
import { URLFormatter } from "../../src/foundation/formatter/URLFormatter.ts";
import { RegistryService } from "../../src/services/RegistryService.ts";
import { createMockSystemContext } from "../fixture/MockSystemContext.tsx";

describe("RegistrySetProjectCommand", () => {
  let dbService: DatabaseService;
  let registryService: RegistryService;
  let trackerRepoStore: ReturnType<
    typeof createMockSystemContext
  >["trackerRepoStore"];

  const projectRoot = "/home/proj";

  beforeEach(() => {
    const bundle = createMockSystemContext();
    trackerRepoStore = bundle.trackerRepoStore;
    dbService = new DatabaseService({ dbPath: ":memory:" });
    DatabaseService.setInstance(dbService);
    bundle.shellService.cwd.mockReturnValue("/home/proj/sub");
    registryService = new RegistryService();
    RegistryService.setInstance(registryService);
    jest.clearAllMocks();
    bundle.shellService.cwd.mockReturnValue("/home/proj/sub");
    trackerRepoStore.findCurrentTrackerRepoByCWD.mockResolvedValue({
      root: projectRoot,
      configPath: `${projectRoot}/mud.conf`,
    });
  });

  afterEach(() => {
    dbService.close();
    DatabaseService.setInstance(null);
  });

  test("sets registry key at project url and returns success", async () => {
    const command = new RegistrySetProjectCommand();
    const result = await command.command("key1", "val1");
    expect(result.status).toBe("ok");
    expect((result as { result: { key: string; value: string } }).result.key).toBe(
      "key1",
    );
    expect((result as { result: { value: string } }).result.value).toBe("val1");
    const url = URLFormatter.normalizeRegistryUrl(projectRoot, "/home/proj/sub");
    const got = await registryService.get(url, "user", "key1");
    expect(got).not.toBeNull();
    expect(got!.value).toBe("val1");
  });

  test("passes --system as system catalog", async () => {
    const command = new RegistrySetProjectCommand();
    await command.command("k", "v", { system: true });
    const url = URLFormatter.normalizeRegistryUrl(projectRoot, "/home/proj/sub");
    const got = await registryService.get(url, "system", "k");
    expect(got).not.toBeNull();
    expect(got!.value).toBe("v");
  });

  test("throws MUD_CONFIG_NOT_FOUND when project is not found", async () => {
    trackerRepoStore.findCurrentTrackerRepoByCWD.mockResolvedValue(null);

    const command = new RegistrySetProjectCommand();
    await expect(command.command("key1", "val1")).rejects.toMatchObject({
      status: "error",
      error: {
        code: "MUD_CONFIG_NOT_FOUND",
        details: { path: "/home/proj/sub" },
      },
    });
  });
});
