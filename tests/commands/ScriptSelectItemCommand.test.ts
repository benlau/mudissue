import { jest } from "@jest/globals";
import {
  ScriptSelectItemCommand,
  splitItems,
} from "../../src/commands/ScriptSelectItemCommand.tsx";
import { MUDISSUE_SCRIPT_VARIABLES_URL } from "../../src/constants.ts";
import { DatabaseService } from "../../src/db/DatabaseService.ts";
import { RegistryService } from "../../src/services/RegistryService.ts";
import { createMockSystemContext } from "../fixture/MockSystemContext.tsx";

class TestScriptSelectItemCommand extends ScriptSelectItemCommand {
  pickCalls: Array<{
    items: string[];
    options: { title: string; defaultItem?: string };
  }> = [];

  constructor(private readonly pickedItem: string | null) {
    super();
  }

  protected override async askUserPickItem(
    items: string[],
    options: { title: string; defaultItem?: string },
  ): Promise<string | null> {
    this.pickCalls.push({ items, options });
    return this.pickedItem;
  }
}

describe("splitItems", () => {
  it("splits by separator and drops empty segments", () => {
    expect(splitItems("123,456,789", ",")).toEqual(["123", "456", "789"]);
    expect(splitItems("a,,b,", ",")).toEqual(["a", "b"]);
    expect(splitItems("one|two", "|")).toEqual(["one", "two"]);
  });
});

describe("ScriptSelectItemCommand", () => {
  let loggerService: ReturnType<
    typeof createMockSystemContext
  >["loggerService"];
  let dbService: DatabaseService;
  let registryService: RegistryService;

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

  it("prompts with parsed items and default title", async () => {
    const command = new TestScriptSelectItemCommand("456");

    const result = await command.command("123,456,789");

    expect(command.pickCalls).toEqual([
      {
        items: ["123", "456", "789"],
        options: { title: "Select item", defaultItem: undefined },
      },
    ]);
    expect(result).toEqual({
      status: "ok",
      result: { selectedItem: "456" },
    });
    expect(loggerService.info).toHaveBeenCalledWith("456");
  });

  it("passes custom title and default item to the picker", async () => {
    const command = new TestScriptSelectItemCommand("456");

    const result = await command.command(
      "123,456,789",
      ",",
      "456",
      "Select item",
    );

    expect(command.pickCalls).toEqual([
      {
        items: ["123", "456", "789"],
        options: { title: "Select item", defaultItem: "456" },
      },
    ]);
    expect(result).toEqual({
      status: "ok",
      result: { selectedItem: "456" },
    });
  });

  it("splits items with a custom separator", async () => {
    const command = new TestScriptSelectItemCommand("b");

    const result = await command.command("a|b|c", "|");

    expect(command.pickCalls).toEqual([
      {
        items: ["a", "b", "c"],
        options: { title: "Select item", defaultItem: undefined },
      },
    ]);
    expect(result).toEqual({
      status: "ok",
      result: { selectedItem: "b" },
    });
    expect(loggerService.info).toHaveBeenCalledWith("b");
  });

  it("writes selected item to a script variable when --set-var is set", async () => {
    const command = new TestScriptSelectItemCommand("456");

    const result = await command.command(
      "123,456,789",
      ",",
      "456",
      undefined,
      "picked_item",
    );

    expect(result).toEqual({
      status: "ok",
      result: { selectedItem: "456" },
    });
    const got = await registryService.get(
      MUDISSUE_SCRIPT_VARIABLES_URL,
      "system",
      "picked_item",
    );
    expect(got).toEqual({
      url: MUDISSUE_SCRIPT_VARIABLES_URL,
      value: "456",
    });
    expect(loggerService.info).not.toHaveBeenCalled();
  });

  it("returns SCRIPT_VAR_INVALID_NAME when --set-var name is invalid", async () => {
    const command = new TestScriptSelectItemCommand("456");

    const result = await command.command(
      "123,456,789",
      ",",
      undefined,
      undefined,
      "bad name!",
    );

    expect(result).toMatchObject({
      status: "error",
      error: { code: "SCRIPT_VAR_INVALID_NAME" },
    });
  });

  it("returns SCRIPT_SELECT_ITEM_CANCELLED when user cancels the picker", async () => {
    const command = new TestScriptSelectItemCommand(null);

    const result = await command.command("123,456,789");

    expect(result).toMatchObject({
      status: "error",
      error: { code: "SCRIPT_SELECT_ITEM_CANCELLED" },
    });
    expect(loggerService.info).not.toHaveBeenCalled();
  });

  it("clears the script variable when cancelled with --set-var", async () => {
    await registryService.set(
      "picked_item",
      "stale",
      MUDISSUE_SCRIPT_VARIABLES_URL,
      "system",
    );
    const command = new TestScriptSelectItemCommand(null);

    const result = await command.command(
      "123,456,789",
      ",",
      undefined,
      undefined,
      "picked_item",
    );

    expect(result).toMatchObject({
      status: "error",
      error: { code: "SCRIPT_SELECT_ITEM_CANCELLED" },
    });
    const got = await registryService.get(
      MUDISSUE_SCRIPT_VARIABLES_URL,
      "system",
      "picked_item",
    );
    expect(got).toBeNull();
  });

  it("throws COMMAND_INVALID_ARG when --items has no values", async () => {
    const command = new TestScriptSelectItemCommand("x");

    await expect(command.command(",,,")).rejects.toMatchObject({
      status: "error",
      error: { code: "COMMAND_INVALID_ARG" },
    });
    expect(command.pickCalls).toHaveLength(0);
  });
});
