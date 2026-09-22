import { jest } from "@jest/globals";
import { ScriptSetVarCommand } from "../../src/commands/ScriptSetVarCommand.ts";
import { MUDISSUE_SCRIPT_VARIABLES_URL } from "../../src/constants.ts";
import { DatabaseService } from "../../src/db/DatabaseService.ts";
import { RegistryService } from "../../src/services/RegistryService.ts";
import { createMockSystemContext } from "../fixture/MockSystemContext.tsx";

describe("ScriptSetVarCommand", () => {
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

  it("sets a script variable in the system catalog", async () => {
    const command = new ScriptSetVarCommand();
    const result = await command.command("selected_issue", "MI001-example");

    expect(result).toEqual({
      status: "ok",
      result: {
        name: "selected_issue",
        value: "MI001-example",
        cleared: false,
      },
    });
    expect(loggerService.info).toHaveBeenCalled();
    const got = await registryService.get(
      MUDISSUE_SCRIPT_VARIABLES_URL,
      "system",
      "selected_issue",
    );
    expect(got).toEqual({
      url: MUDISSUE_SCRIPT_VARIABLES_URL,
      value: "MI001-example",
    });
  });

  it("clears a script variable with --clear", async () => {
    await registryService.set(
      "selected_issue",
      "MI001-example",
      MUDISSUE_SCRIPT_VARIABLES_URL,
      "system",
    );
    const command = new ScriptSetVarCommand();

    const result = await command.command("selected_issue", undefined, {
      clear: true,
    });

    expect(result).toEqual({
      status: "ok",
      result: {
        name: "selected_issue",
        cleared: true,
      },
    });
    const got = await registryService.get(
      MUDISSUE_SCRIPT_VARIABLES_URL,
      "system",
      "selected_issue",
    );
    expect(got).toBeNull();
  });

  it("returns SCRIPT_VAR_NOT_FOUND when clearing a missing variable", async () => {
    const command = new ScriptSetVarCommand();

    const result = await command.command("missing", undefined, { clear: true });

    expect(result).toMatchObject({
      status: "error",
      error: { code: "SCRIPT_VAR_NOT_FOUND" },
    });
  });

  it("returns SCRIPT_VAR_VALUE_REQUIRED when value is omitted without --clear", async () => {
    const command = new ScriptSetVarCommand();

    const result = await command.command("selected_issue");

    expect(result).toMatchObject({
      status: "error",
      error: { code: "SCRIPT_VAR_VALUE_REQUIRED" },
    });
  });

  it("returns SCRIPT_VAR_CLEAR_WITH_VALUE when --clear is used with a value", async () => {
    const command = new ScriptSetVarCommand();

    const result = await command.command("selected_issue", "still-here", {
      clear: true,
    });

    expect(result).toMatchObject({
      status: "error",
      error: { code: "SCRIPT_VAR_CLEAR_WITH_VALUE" },
    });
  });

  it("returns SCRIPT_VAR_INVALID_NAME for an invalid variable name", async () => {
    const command = new ScriptSetVarCommand();

    const result = await command.command("bad name!", "value");

    expect(result).toMatchObject({
      status: "error",
      error: { code: "SCRIPT_VAR_INVALID_NAME" },
    });
  });
});
