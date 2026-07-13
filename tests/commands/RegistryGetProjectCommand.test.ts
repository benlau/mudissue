import { jest } from "@jest/globals";
import { RegistryGetProjectCommand } from "../../src/commands/RegistryGetProjectCommand.ts";
import { DatabaseService } from "../../src/db/DatabaseService.ts";
import { URLFormatter } from "../../src/foundation/formatter/URLFormatter.ts";
import { RegistryService } from "../../src/services/RegistryService.ts";
import { createMockSystemContext } from "../fixture/MockSystemContext.tsx";

describe("RegistryGetProjectCommand", () => {
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

  test("returns success with value when key found at project url", async () => {
    const url = URLFormatter.normalizeRegistryUrl(projectRoot, "/home/proj/sub");
    await registryService.set("mykey", "the-value", url, "user");
    const command = new RegistryGetProjectCommand();
    const result = await command.command("mykey");
    expect(result.status).toBe("ok");
    expect((result as { result: { url: string } }).result.url).toBe(url);
    expect(
      (result as { result: { records: Record<string, string> } }).result.records,
    ).toEqual({ mykey: "the-value" });
  });

  test("returns error when key not found at project url", async () => {
    const command = new RegistryGetProjectCommand();
    await expect(command.command("missing")).rejects.toMatchObject({
      status: "error",
      error: { code: "REGISTRY_KEY_NOT_FOUND" },
    });
  });

  test("returns all keys when key is omitted", async () => {
    const url = URLFormatter.normalizeRegistryUrl(projectRoot, "/home/proj/sub");
    await registryService.set("beta", "2", url, "user");
    await registryService.set("alpha", "1", url, "user");
    const command = new RegistryGetProjectCommand();
    const result = await command.command(undefined);
    expect(result.status).toBe("ok");
    expect((result as { result: { url: string } }).result.url).toBe(url);
    expect(
      (result as { result: { records: Record<string, string> } }).result.records,
    ).toEqual({ alpha: "1", beta: "2" });
  });

  test("returns empty key list when no keys exist and key omitted", async () => {
    const url = URLFormatter.normalizeRegistryUrl(projectRoot, "/home/proj/sub");
    const command = new RegistryGetProjectCommand();
    const result = await command.command(undefined);
    expect(result.status).toBe("ok");
    expect((result as { result: { url: string } }).result.url).toBe(url);
    expect(
      (result as { result: { records: Record<string, string> } }).result.records,
    ).toEqual({});
  });

  test("passes --system as system catalog", async () => {
    const url = URLFormatter.normalizeRegistryUrl(projectRoot, "/home/proj/sub");
    await registryService.set("k", "v", url, "system");
    const command = new RegistryGetProjectCommand();
    const result = await command.command("k", { system: true });
    expect(result.status).toBe("ok");
    expect(
      (result as { result: { records: Record<string, string> } }).result.records,
    ).toEqual({ k: "v" });
  });

  test("throws MUD_CONFIG_NOT_FOUND when project is not found", async () => {
    trackerRepoStore.findCurrentTrackerRepoByCWD.mockResolvedValue(null);

    const command = new RegistryGetProjectCommand();
    await expect(command.command("mykey")).rejects.toMatchObject({
      status: "error",
      error: {
        code: "MUD_CONFIG_NOT_FOUND",
        details: { path: "/home/proj/sub" },
      },
    });
  });
});
