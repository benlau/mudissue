import * as path from "path";
import { defineMessages } from "react-intl";
import { intl } from "../intl.ts";
import { FileService } from "../services/FileService.ts";
import { LoggerService } from "../services/LoggerService.ts";
import { ShellService } from "../services/ShellService.ts";
import type { ErrorCode } from "../types/errors.ts";

const msg = defineMessages({
  errorBodySources: {
    id: "cli.error.issue.bodySources",
    defaultMessage:
      "Use only one of --content, --from-file, or --from-env-var.",
  },
});

export type IssueBodySourceArgs = {
  content?: unknown;
  fromFile?: unknown;
  fromEnvVar?: unknown;
};

export type IssueBodyFileErrorCodes = {
  fileNotFound: ErrorCode;
  pathNotFile: ErrorCode;
  fileBinary: ErrorCode;
};

export type IssueBodyEnvErrorCodes = {
  envVarMissing: ErrorCode;
};

export type IssueBodyMutateErrorCodes = IssueBodyFileErrorCodes &
  IssueBodyEnvErrorCodes & {
    contentEmpty: ErrorCode;
  };

export type ThrowCommandException = (code: ErrorCode, message: string) => never;

export type ResolveMutateBodyContentOptions = {
  errorCodes: IssueBodyMutateErrorCodes;
  prompt: string;
  contentNotProvidedMessage: string;
  throwException: ThrowCommandException;
  askUserTextContent: (prompt: string) => Promise<string | null>;
};

export class IssueBodyContentHelper {
  static hasNonEmptyString(value: unknown): boolean {
    return typeof value === "string" && value !== "";
  }

  static hasExplicitContentOption(content: unknown): boolean {
    return typeof content === "string";
  }

  static countBodySources(argv: IssueBodySourceArgs): number {
    return (
      (IssueBodyContentHelper.hasExplicitContentOption(argv.content) ? 1 : 0) +
      (IssueBodyContentHelper.hasNonEmptyString(argv.fromFile) ? 1 : 0) +
      (IssueBodyContentHelper.hasNonEmptyString(argv.fromEnvVar) ? 1 : 0)
    );
  }

  static hasHeadlessBodySource(argv: IssueBodySourceArgs): boolean {
    return IssueBodyContentHelper.countBodySources(argv) > 0;
  }

  static assertAtMostOneBodySource(argv: IssueBodySourceArgs): void {
    if (IssueBodyContentHelper.countBodySources(argv) > 1) {
      throw new Error(intl.formatMessage(msg.errorBodySources));
    }
  }

  async resolveReadableTextFilePath(
    filePath: string,
    errorCodes: IssueBodyFileErrorCodes,
    throwException: ThrowCommandException,
  ): Promise<string> {
    const fileService = FileService.getInstance();
    const shellService = ShellService.getInstance();
    const loggerService = LoggerService.getInstance();

    const resolvedPath = shellService.isAbsolute(filePath)
      ? filePath
      : path.resolve(shellService.cwd(), filePath);
    if (!(await fileService.exists(resolvedPath))) {
      loggerService.error(`File not found: ${resolvedPath}`);
      throwException(
        errorCodes.fileNotFound,
        `File not found: ${resolvedPath}`,
      );
    }
    const stat = await fileService.stat(resolvedPath);
    if (!stat.isFile()) {
      loggerService.error("A directory is not accepted.");
      throwException(errorCodes.pathNotFile, "A directory is not accepted.");
    }
    if (await fileService.isBinaryFile(resolvedPath)) {
      loggerService.error("Binary files are not accepted.");
      throwException(errorCodes.fileBinary, "Binary files are not accepted.");
    }
    return resolvedPath;
  }

  async readBodyFromFile(
    filePath: string,
    errorCodes: IssueBodyFileErrorCodes,
    throwException: ThrowCommandException,
  ): Promise<string> {
    const resolvedPath = await this.resolveReadableTextFilePath(
      filePath,
      errorCodes,
      throwException,
    );
    return (await FileService.getInstance().readFile(
      resolvedPath,
      "utf-8",
    )) as string;
  }

  async readBodyFromEnvVar(
    name: string,
    errorCodes: IssueBodyEnvErrorCodes,
    throwException: ThrowCommandException,
  ): Promise<string> {
    const envValue = process.env[name];
    if (envValue == null || envValue === "") {
      throwException(
        errorCodes.envVarMissing,
        `Environment variable not set or empty: ${name}`,
      );
    }
    return envValue;
  }

  async resolveMutateBodyContent(
    args: {
      content?: string;
      fromFile?: string;
      fromEnvVar?: string;
    },
    options: ResolveMutateBodyContentOptions,
  ): Promise<string> {
    const { content, fromFile, fromEnvVar } = args;
    const { errorCodes, throwException } = options;

    if (fromEnvVar !== undefined && fromEnvVar !== "") {
      return this.readBodyFromEnvVar(fromEnvVar, errorCodes, throwException);
    }
    if (fromFile !== undefined && fromFile !== "") {
      return this.readBodyFromFile(fromFile, errorCodes, throwException);
    }
    if (content !== undefined) {
      return content;
    }

    const entered = await options.askUserTextContent(options.prompt);
    if (entered == null) {
      return throwException(
        errorCodes.contentEmpty,
        options.contentNotProvidedMessage,
      );
    }
    return entered;
  }
}
