import { jest } from "@jest/globals";
import {
  ScriptSelectItemCommand,
  splitItems,
} from "../../src/commands/ScriptSelectItemCommand.tsx";
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
  let fileService: ReturnType<typeof createMockSystemContext>["fileService"];
  let loggerService: ReturnType<
    typeof createMockSystemContext
  >["loggerService"];

  beforeEach(() => {
    const bundle = createMockSystemContext();
    fileService = bundle.fileService;
    loggerService = bundle.loggerService;
    jest.clearAllMocks();
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
    expect(loggerService.info).toHaveBeenCalledWith("456");
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

  it("writes selected item to output file when --output is set", async () => {
    const command = new TestScriptSelectItemCommand("456");

    const result = await command.command(
      "123,456,789",
      ",",
      "456",
      undefined,
      "/tmp/item-pick",
    );

    expect(result).toEqual({
      status: "ok",
      result: { selectedItem: "456" },
    });
    expect(fileService.writeFile).toHaveBeenCalledWith(
      "/tmp/item-pick",
      "456\n",
      "utf-8",
    );
    expect(loggerService.info).not.toHaveBeenCalled();
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

  it("throws COMMAND_INVALID_ARG when --items has no values", async () => {
    const command = new TestScriptSelectItemCommand("x");

    await expect(command.command(",,,")).rejects.toMatchObject({
      status: "error",
      error: { code: "COMMAND_INVALID_ARG" },
    });
    expect(command.pickCalls).toHaveLength(0);
  });
});
