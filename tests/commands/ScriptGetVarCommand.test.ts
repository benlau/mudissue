import { jest } from "@jest/globals";
import yargs from "yargs";
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

  it("returns ok with null value when the variable is missing and --no-error is set", async () => {
    const command = new ScriptGetVarCommand();

    const result = await command.command("missing", { noError: true });

    expect(result).toEqual({
      status: "ok",
      result: {
        name: "missing",
        value: null,
      },
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

  it("still returns SCRIPT_VAR_INVALID_NAME when --no-error is set", async () => {
    const command = new ScriptGetVarCommand();

    const result = await command.command("bad name!", { noError: true });

    expect(result).toMatchObject({
      status: "error",
      error: { code: "SCRIPT_VAR_INVALID_NAME" },
    });
  });

  it("parses --no-error as a real flag rather than yargs boolean negation", async () => {
    const runSpy = jest
      .spyOn(ScriptGetVarCommand.prototype, "runCommand")
      .mockResolvedValue({
        status: "ok",
        result: { name: "hello123", value: null },
      });

    await ScriptGetVarCommand.register(yargs())
      .exitProcess(false)
      .strict()
      .parseAsync(["get-var", "--no-error", "hello123"]);

    expect(runSpy).toHaveBeenCalledWith(expect.anything(), "hello123", {
      noError: true,
    });
    runSpy.mockRestore();
  });
});
