import { jest } from "@jest/globals";
import {
  GIT_MUD_CONFIG_FILENAME,
  MUD_CONFIG_FILENAME,
} from "../../src/constants.ts";
import { InitCommand } from "../../src/commands/InitCommand.ts";
import { TemplateGenerator } from "../../src/utils/generators/TemplateGenerator.ts";
import { LoggerService } from "../../src/services/LoggerService.ts";
import { createMockSystemContext } from "../fixture/MockSystemContext.tsx";

describe("InitCommand", () => {
  let fileService: ReturnType<typeof createMockSystemContext>["fileService"];
  let loggerService: ReturnType<typeof createMockSystemContext>["loggerService"];
  let shellService: ReturnType<typeof createMockSystemContext>["shellService"];

  beforeEach(() => {
    const bundle = createMockSystemContext();
    fileService = bundle.fileService;
    loggerService = bundle.loggerService;
    shellService = bundle.shellService;

    shellService.cwd.mockReturnValue("/current/dir");

    LoggerService.setInstance(loggerService as unknown as LoggerService);
  });

  afterEach(() => {
    LoggerService.setInstance(new LoggerService());
    jest.restoreAllMocks();
  });

  test("command has name init", () => {
    const command = new InitCommand();
    expect(command.name).toBe("init");
  });

  test("command creates mud.conf with template content", async () => {
    shellService.cwd.mockReturnValue("/current/dir");
    fileService.exists.mockResolvedValue(false);
    fileService.writeFile.mockResolvedValue(undefined);

    const command = new InitCommand();
    const result = await command.command();

    expect(result.status).toBe("ok");
    expect((result as { result: { created: boolean } }).result.created).toBe(
      true,
    );
    expect(fileService.exists).toHaveBeenCalledWith(
      expect.stringContaining(MUD_CONFIG_FILENAME),
    );
    expect(fileService.writeFile).toHaveBeenCalledTimes(1);
    expect(fileService.writeFile).toHaveBeenCalledWith(
      `/current/dir/${MUD_CONFIG_FILENAME}`,
      expect.stringContaining("# issue_prefix"),
    );
    expect(fileService.mkdir).not.toHaveBeenCalled();
    expect(loggerService.info).toHaveBeenCalled();
  });

  test("returns error when mud.conf exists in repo", async () => {
    fileService.exists.mockResolvedValueOnce(true); // cwd/mud.conf exists

    const command = new InitCommand();

    const result = await command.command();

    expect(result.status).toBe("error");
    expect((result as { error: { code: string } }).error.code).toBe(
      "INIT_CONFIG_EXISTS",
    );
    expect(fileService.writeFile).not.toHaveBeenCalled();
  });

  test("returns error when .git/mudissue/mud.conf exists in repo", async () => {
    shellService.cwd.mockReturnValue("/repo/root");
    fileService.exists
      .mockResolvedValueOnce(false) // cwd/mud.conf
      .mockResolvedValueOnce(true); // cwd/.git/mudissue/mud.conf

    const command = new InitCommand();
    const result = await command.command();

    expect(result.status).toBe("error");
    expect((result as { error: { code: string } }).error.code).toBe(
      "INIT_CONFIG_EXISTS",
    );
    expect(fileService.writeFile).not.toHaveBeenCalled();
  });

  test("command returns ErrorResponse when getTemplate returns undefined", async () => {
    fileService.exists.mockResolvedValue(false); // walk + both config checks
    jest
      .spyOn(TemplateGenerator.prototype, "getTemplate")
      .mockReturnValue(undefined);

    const command = new InitCommand();

    const result = await command.command();

    expect(result.status).toBe("error");
    expect((result as { error: { code: string } }).error.code).toBe(
      "INIT_TEMPLATE_MISSING",
    );
    expect(fileService.writeFile).not.toHaveBeenCalled();
  });

  describe("--inside-git", () => {
    test("creates .git/mudissue/mud.conf when .git exists and is a directory", async () => {
      shellService.cwd.mockReturnValue("/repo/root");
      fileService.exists
        .mockResolvedValueOnce(false) // cwd/mud.conf
        .mockResolvedValueOnce(false) // cwd/.git/mudissue/mud.conf
        .mockResolvedValueOnce(true); // cwd/.git
      fileService.stat.mockResolvedValue({
        isDirectory: () => true,
      } as any);
      fileService.mkdir.mockResolvedValue(undefined);
      fileService.writeFile.mockResolvedValue(undefined);

      const command = new InitCommand();
      const result = await command.command({ insideGit: true });

      expect(result.status).toBe("ok");
      expect((result as { result: { created: boolean } }).result.created).toBe(
        true,
      );
      expect(fileService.exists).toHaveBeenCalledWith("/repo/root/.git");
      expect(fileService.mkdir).toHaveBeenCalledWith(
        "/repo/root/.git/mudissue",
        { recursive: true },
      );
      expect(fileService.writeFile).toHaveBeenCalledWith(
        `/repo/root/${GIT_MUD_CONFIG_FILENAME}`,
        expect.stringContaining("# issue_prefix"),
      );
      expect(loggerService.info).toHaveBeenCalled();
    });

    test("returns ErrorResponse when not inside a git repository", async () => {
      fileService.exists
        .mockResolvedValueOnce(false) // cwd/mud.conf
        .mockResolvedValueOnce(false) // cwd/.git/mudissue/mud.conf
        .mockResolvedValueOnce(false); // cwd/.git

      const command = new InitCommand();

      const result = await command.command({ insideGit: true });

      expect(result.status).toBe("error");
      expect((result as { error: { code: string } }).error.code).toBe(
        "INIT_NOT_GIT_REPO",
      );
      expect(fileService.writeFile).not.toHaveBeenCalled();
    });

    test("returns error when .git exists but is a file (submodule/worktree)", async () => {
      fileService.exists
        .mockResolvedValueOnce(false) // cwd/mud.conf
        .mockResolvedValueOnce(false) // cwd/.git/mudissue/mud.conf
        .mockResolvedValueOnce(true); // cwd/.git
      fileService.stat.mockResolvedValue({
        isDirectory: () => false,
      } as any);

      const command = new InitCommand();

      await expect(command.command({ insideGit: true })).rejects.toMatchObject({
        status: "error",
        error: { code: "INIT_GIT_NOT_DIRECTORY" },
      });
      expect(fileService.writeFile).not.toHaveBeenCalled();
    });

    test("returns error when .git/mudissue/mud.conf already exists", async () => {
      fileService.exists
        .mockResolvedValueOnce(false) // cwd/mud.conf
        .mockResolvedValueOnce(true); // cwd/.git/mudissue/mud.conf

      const command = new InitCommand();
      const result = await command.command({ insideGit: true });

      expect(result.status).toBe("error");
      expect((result as { error: { code: string } }).error.code).toBe(
        "INIT_CONFIG_EXISTS",
      );
      expect(fileService.writeFile).not.toHaveBeenCalled();
    });
  });
});
