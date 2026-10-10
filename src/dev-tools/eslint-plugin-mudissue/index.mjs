import { filenameConventionRule } from "./filename-convention.mjs";
import { noExportFunctionRule } from "./no-export-function.mjs";
import { noNewSrcDirectoryRule } from "./no-new-src-directory.mjs";
import { noTestFolderRule } from "./no-test-folder.mjs";
import { testFilenameConventionRule } from "./test-filename-convention.mjs";

export default {
  rules: {
    "filename-convention": filenameConventionRule,
    "no-export-function": noExportFunctionRule,
    "no-new-src-directory": noNewSrcDirectoryRule,
    "no-test-folder": noTestFolderRule,
    "test-filename-convention": testFilenameConventionRule,
  },
};
