import { jest } from "@jest/globals";
import { RegistryGetCommand } from "../../src/commands/RegistryGetCommand.ts";
import { DatabaseService } from "../../src/db/DatabaseService.ts";
import { URLFormatter } from "../../src/foundation/formatter/URLFormatter.ts";
import { RegistryService } from "../../src/services/RegistryService.ts";
import { FileService } from "../../src/services/FileService.ts";
import { GitService } from "../../src/services/GitService.ts";
import { createMockSystemContext } from "../fixture/MockSystemContext.tsx";

describe("RegistryGetCommand", () => {
  let dbService: DatabaseService;
  let registryService: RegistryService;

  beforeEach(() => {
    const bundle = createMockSystemContext();
    dbService = new DatabaseService({ dbPath: ":memory:" });
    DatabaseService.setInstance(dbService);
    bundle.shellService.cwd.mockReturnValue("/home/proj");
    FileService.setInstance(bundle.fileService as unknown as FileService);
    GitService.setInstance(bundle.gitService as unknown as GitService);
    registryService = new RegistryService();
    RegistryService.setInstance(registryService);
    jest.clearAllMocks();
    bundle.shellService.cwd.mockReturnValue("/home/proj");
    bundle.fileService.exists.mockResolvedValue(false);
  });

  afterEach(() => {
    dbService.close();
    DatabaseService.setInstance(null);
  });

  test("returns success with url and value when key found", async () => {
    const url = URLFormatter.normalizeRegistryUrl(undefined, "/home/proj");
    await registryService.set("mykey", "the-value", url, "user");
    const command = new RegistryGetCommand();
    const result = await command.command("/home/proj", "mykey", {
      system: false,
    });
    expect(result.status).toBe("ok");
    expect((result as any).result.url).toBe(url);
    expect((result as any).result.records).toEqual({ mykey: "the-value" });
  });

  test("returns error when key not found", async () => {
    const command = new RegistryGetCommand();
    await expect(command.command("/home/proj", "missing")).rejects.toMatchObject({
      status: "error",
      error: { code: "REGISTRY_KEY_NOT_FOUND" },
    });
  });

  test("returns all keys when key is omitted", async () => {
    const url = URLFormatter.normalizeRegistryUrl("/home/proj", "/home/proj");
    await registryService.set("beta", "2", url, "user");
    await registryService.set("alpha", "1", url, "user");
    const command = new RegistryGetCommand();
    const result = await command.command("/home/proj", undefined);
    expect(result.status).toBe("ok");
    expect((result as { result: { url: string } }).result.url).toBe(url);
    expect((result as { result: { records: Record<string, string> } }).result
      .records).toEqual({ alpha: "1", beta: "2" });
  });

  test("returns empty keys when key is omitted and no keys exist at url", async () => {
    const url = URLFormatter.normalizeRegistryUrl("/home/proj", "/home/proj");
    const command = new RegistryGetCommand();
    const result = await command.command("/home/proj", undefined);
    expect(result.status).toBe("ok");
    expect((result as { result: { url: string } }).result.url).toBe(url);
    expect(
      (result as { result: { records: Record<string, string> } }).result.records,
    ).toEqual({});
  });

  test("passes --system as system catalog", async () => {
    dbService.close();
    const bundle = createMockSystemContext();
    dbService = new DatabaseService({ dbPath: ":memory:" });
    DatabaseService.setInstance(dbService);
    bundle.shellService.cwd.mockReturnValue("/tmp");
    registryService = new RegistryService();
    RegistryService.setInstance(registryService);

    const url = URLFormatter.normalizeRegistryUrl("/path", "/tmp");
    await registryService.set("k", "v", url, "system");
    const command = new RegistryGetCommand();
    const result = await command.command("/path", "k", {
      system: true,
    });
    expect(result.status).toBe("ok");
    expect((result as any).result.records).toEqual({ k: "v" });
  });
});
