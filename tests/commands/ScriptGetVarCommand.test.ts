import { jest } from "@jest/globals";
import { ScriptGetVarCommand } from "../../src/commands/ScriptGetVarCommand.ts";
import { MUDISSUE_SCRIPT_VARIABLES_URL } from "../../src/constants.ts";
import { DatabaseService } from "../../src/db/DatabaseService.ts";
import { RegistryService } from "../../src/services/RegistryService.ts";
import { createMockSystemContext } from "../fixture/MockSystemContext.tsx";

describe("ScriptGetVarCommand", () => {
  let dbService: DatabaseService;
  let registryService: RegistryService;
  let loggerService: ReturnType<
    typeof createMockSystemContext
  >["loggerService"];

  beforeEach(() => {
    const bundle = createMockSystemContext();
    loggerService = bundle.loggerService;
    dbService = new DatabaseService({ dbPath: ":memory:" });
    DatabaseService.setInstance(dbService);
    registryService = new RegistryService();
    RegistryService.setInstance(registryService);
    jest.clearAllMocks();
  });

  afterEach(() => {
    dbService.close();
    DatabaseService.setInstance(null);
  });

  it("prints and returns a script variable from the system catalog", async () => {
    await registryService.set(
      "selected_issue",
      "MI001-example",
      MUDISSUE_SCRIPT_VARIABLES_URL,
      "system",
    );
    const command = new ScriptGetVarCommand();

    const result = await command.command("selected_issue");

    expect(result).toEqual({
      status: "ok",
      result: {
        name: "selected_issue",
        value: "MI001-example",
      },
    });
    expect(loggerService.info).toHaveBeenCalledWith("MI001-example");
  });

  it("returns SCRIPT_VAR_NOT_FOUND when the variable is missing", async () => {
    const command = new ScriptGetVarCommand();

    const result = await command.command("missing");

    expect(result).toMatchObject({
      status: "error",
      error: { code: "SCRIPT_VAR_NOT_FOUND" },
    });
    expect(loggerService.info).not.toHaveBeenCalled();
  });

  it("returns SCRIPT_VAR_INVALID_NAME for an invalid variable name", async () => {
    const command = new ScriptGetVarCommand();

    const result = await command.command("bad name!");

    expect(result).toMatchObject({
      status: "error",
      error: { code: "SCRIPT_VAR_INVALID_NAME" },
    });
  });
});
