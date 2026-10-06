import { IssueBodyContentHelper } from "../../src/helpers/IssueBodyContentHelper.ts";
import type { FileService } from "../../src/services/FileService.ts";
import type { ErrorCode } from "../../src/types/errors.ts";
import {
  createMockSystemContext,
  type MockSystemContextBundle,
} from "../fixture/MockSystemContext.tsx";

const fileErrorCases = [
  {
    fileNotFound: "APPEND_FILE_NOT_FOUND",
    pathNotFile: "APPEND_PATH_NOT_FILE",
    fileBinary: "APPEND_FILE_BINARY",
  },
  {
    fileNotFound: "PREPEND_FILE_NOT_FOUND",
    pathNotFile: "PREPEND_PATH_NOT_FILE",
    fileBinary: "PREPEND_FILE_BINARY",
  },
  {
    fileNotFound: "CREATE_ISSUE_FILE_NOT_FOUND",
    pathNotFile: "CREATE_ISSUE_PATH_NOT_FILE",
    fileBinary: "CREATE_ISSUE_FILE_BINARY",
  },
] as const;

const envErrorCases = [
  { envVarMissing: "APPEND_ENV_VAR_MISSING" },
  { envVarMissing: "PREPEND_ENV_VAR_MISSING" },
  { envVarMissing: "CREATE_ISSUE_ENV_VAR_MISSING" },
] as const;

function throwException(code: ErrorCode, _message: string): never {
  throw { status: "error", error: { code } };
}

describe("IssueBodyContentHelper", () => {
  let bundle: MockSystemContextBundle;
  const envName = "MUDISSUE_TEST_BODY";

  beforeEach(() => {
    bundle = createMockSystemContext();
    bundle.shellService.cwd.mockReturnValue("/cwd");
    bundle.shellService.isAbsolute.mockImplementation((filePath: string) =>
      filePath.startsWith("/"),
    );
  });

  afterEach(() => {
    delete process.env[envName];
  });

  describe("body source flags", () => {
    it("counts an explicit empty --content as a headless source", () => {
      expect(IssueBodyContentHelper.countBodySources({ content: "" })).toBe(1);
      expect(
        IssueBodyContentHelper.hasHeadlessBodySource({ content: "" }),
      ).toBe(true);
      expect(IssueBodyContentHelper.hasHeadlessBodySource({})).toBe(false);
    });

    it("rejects more than one body source", () => {
      expect(() =>
        IssueBodyContentHelper.assertAtMostOneBodySource({
          content: "a",
          fromFile: "body.txt",
        }),
      ).toThrow(Error);
    });
  });

  describe("resolveReadableTextFilePath", () => {
    it("resolves a relative path against cwd", async () => {
      bundle.fileService.exists.mockResolvedValue(true);
      bundle.fileService.stat.mockResolvedValue({
        isFile: () => true,
      } as ReturnType<FileService["stat"]>);
      bundle.fileService.isBinaryFile.mockResolvedValue(false);

      const helper = new IssueBodyContentHelper();
      const resolved = await helper.resolveReadableTextFilePath(
        "body.txt",
        fileErrorCases[0],
        throwException,
      );

      expect(resolved).toBe("/cwd/body.txt");
    });

    it.each(fileErrorCases)(
      "throws $fileNotFound when the file is missing",
      async (errorCodes) => {
        bundle.fileService.exists.mockResolvedValue(false);
        const helper = new IssueBodyContentHelper();

        await expect(
          helper.resolveReadableTextFilePath(
            "missing.txt",
            errorCodes,
            throwException,
          ),
        ).rejects.toMatchObject({
          status: "error",
          error: { code: errorCodes.fileNotFound },
        });
        expect(bundle.loggerService.error).toHaveBeenCalled();
      },
    );

    it.each(fileErrorCases)(
      "throws $pathNotFile when the path is a directory",
      async (errorCodes) => {
        bundle.fileService.exists.mockResolvedValue(true);
        bundle.fileService.stat.mockResolvedValue({
          isFile: () => false,
        } as ReturnType<FileService["stat"]>);
        const helper = new IssueBodyContentHelper();

        await expect(
          helper.resolveReadableTextFilePath("dir", errorCodes, throwException),
        ).rejects.toMatchObject({
          status: "error",
          error: { code: errorCodes.pathNotFile },
        });
      },
    );

    it.each(fileErrorCases)(
      "throws $fileBinary when the file is binary",
      async (errorCodes) => {
        bundle.fileService.exists.mockResolvedValue(true);
        bundle.fileService.stat.mockResolvedValue({
          isFile: () => true,
        } as ReturnType<FileService["stat"]>);
        bundle.fileService.isBinaryFile.mockResolvedValue(true);
        const helper = new IssueBodyContentHelper();

        await expect(
          helper.resolveReadableTextFilePath(
            "binary.png",
            errorCodes,
            throwException,
          ),
        ).rejects.toMatchObject({
          status: "error",
          error: { code: errorCodes.fileBinary },
        });
      },
    );
  });

  describe("readBodyFromEnvVar", () => {
    it.each(envErrorCases)(
      "throws $envVarMissing when the variable is unset",
      async (errorCodes) => {
        delete process.env[envName];
        const helper = new IssueBodyContentHelper();

        await expect(
          helper.readBodyFromEnvVar(envName, errorCodes, throwException),
        ).rejects.toMatchObject({
          status: "error",
          error: { code: errorCodes.envVarMissing },
        });
      },
    );

    it("returns the environment variable value", async () => {
      process.env[envName] = "from env";
      const helper = new IssueBodyContentHelper();

      await expect(
        helper.readBodyFromEnvVar(
          envName,
          { envVarMissing: "APPEND_ENV_VAR_MISSING" },
          throwException,
        ),
      ).resolves.toBe("from env");
    });
  });

  describe("resolveMutateBodyContent", () => {
    const errorCodes = {
      fileNotFound: "APPEND_FILE_NOT_FOUND",
      pathNotFile: "APPEND_PATH_NOT_FILE",
      fileBinary: "APPEND_FILE_BINARY",
      envVarMissing: "APPEND_ENV_VAR_MISSING",
      contentEmpty: "APPEND_CONTENT_EMPTY",
    } as const;

    it("reads --from-file when --content is omitted", async () => {
      bundle.fileService.exists.mockResolvedValue(true);
      bundle.fileService.stat.mockResolvedValue({
        isFile: () => true,
      } as ReturnType<FileService["stat"]>);
      bundle.fileService.isBinaryFile.mockResolvedValue(false);
      bundle.fileService.readFile.mockResolvedValue("file body");
      const helper = new IssueBodyContentHelper();

      const body = await helper.resolveMutateBodyContent(
        { fromFile: "body.txt" },
        {
          errorCodes,
          prompt: "prompt",
          contentNotProvidedMessage: "missing",
          throwException,
          askUserTextContent: async () => {
            throw new Error("should not prompt");
          },
        },
      );

      expect(body).toBe("file body");
      expect(bundle.fileService.readFile).toHaveBeenCalledWith(
        "/cwd/body.txt",
        "utf-8",
      );
    });

    it("throws contentEmpty when the prompt is cancelled", async () => {
      const helper = new IssueBodyContentHelper();

      await expect(
        helper.resolveMutateBodyContent(
          {},
          {
            errorCodes,
            prompt: "prompt",
            contentNotProvidedMessage: "missing",
            throwException,
            askUserTextContent: async () => null,
          },
        ),
      ).rejects.toMatchObject({
        status: "error",
        error: { code: "APPEND_CONTENT_EMPTY" },
      });
    });
  });
});
