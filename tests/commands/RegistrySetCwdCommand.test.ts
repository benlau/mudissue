import { jest } from "@jest/globals";
import { RegistrySetCwdCommand } from "../../src/commands/RegistrySetCwdCommand.ts";
import { DatabaseService } from "../../src/db/DatabaseService.ts";
import { URLFormatter } from "../../src/foundation/formatter/URLFormatter.ts";
import { RegistryService } from "../../src/services/RegistryService.ts";
import { createMockSystemContext } from "../fixture/MockSystemContext.tsx";

describe("RegistrySetCwdCommand", () => {
  let dbService: DatabaseService;
  let registryService: RegistryService;

  beforeEach(() => {
    const bundle = createMockSystemContext();
    dbService = new DatabaseService({ dbPath: ":memory:" });
    DatabaseService.setInstance(dbService);
    bundle.shellService.cwd.mockReturnValue("/home/proj");
    registryService = new RegistryService();
    RegistryService.setInstance(registryService);
    jest.clearAllMocks();
    bundle.shellService.cwd.mockReturnValue("/home/proj");
  });

  afterEach(() => {
    dbService.close();
    DatabaseService.setInstance(null);
  });

  test("sets registry key at cwd url and returns success", async () => {
    const command = new RegistrySetCwdCommand();
    const result = await command.command("key1", "val1");
    expect(result.status).toBe("ok");
    expect((result as { result: { key: string; value: string } }).result.key).toBe(
      "key1",
    );
    expect((result as { result: { value: string } }).result.value).toBe("val1");
    const url = URLFormatter.normalizeRegistryUrl(undefined, "/home/proj");
    const got = await registryService.get(url, "user", "key1");
    expect(got).not.toBeNull();
    expect(got!.value).toBe("val1");
  });

  test("passes --system as system catalog", async () => {
    const command = new RegistrySetCwdCommand();
    await command.command("k", "v", { system: true });
    const url = URLFormatter.normalizeRegistryUrl(undefined, "/home/proj");
    const got = await registryService.get(url, "system", "k");
    expect(got).not.toBeNull();
    expect(got!.value).toBe("v");
  });
});
