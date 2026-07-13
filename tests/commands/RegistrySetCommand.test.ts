import { jest } from "@jest/globals";
import { RegistrySetCommand } from "../../src/commands/RegistrySetCommand.ts";
import { DatabaseService } from "../../src/db/DatabaseService.ts";
import { URLFormatter } from "../../src/foundation/formatter/URLFormatter.ts";
import { RegistryService } from "../../src/services/RegistryService.ts";
import { createMockSystemContext } from "../fixture/MockSystemContext.tsx";

describe("RegistrySetCommand", () => {
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

  test("calls registry set and returns success", async () => {
    const command = new RegistrySetCommand();
    const result = await command.command("/home/proj", "key1", "val1", {
      system: false,
    });
    expect(result.status).toBe("ok");
    expect((result as any).result.key).toBe("key1");
    expect((result as any).result.value).toBe("val1");
    expect((result as any).result.catalog).toBe("user");
    const url = URLFormatter.normalizeRegistryUrl(undefined, "/home/proj");
    const got = await registryService.get(url, "user", "key1");
    expect(got).not.toBeNull();
    expect(got!.value).toBe("val1");
  });

  test("passes path and system option", async () => {
    dbService.close();
    const bundle = createMockSystemContext();
    dbService = new DatabaseService({ dbPath: ":memory:" });
    DatabaseService.setInstance(dbService);
    bundle.shellService.cwd.mockReturnValue("/tmp");
    registryService = new RegistryService();
    RegistryService.setInstance(registryService);

    const command = new RegistrySetCommand();
    await command.command("/other/path", "k", "v", { system: true });
    const expectedUrl = URLFormatter.normalizeRegistryUrl("/other/path", "/tmp");
    const got = await registryService.get(expectedUrl, "system", "k");
    expect(got).not.toBeNull();
    expect(got!.value).toBe("v");
  });
});
