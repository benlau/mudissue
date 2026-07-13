import { filenameConventionRule } from "./filename-convention.mjs";
import { noNewSrcDirectoryRule } from "./no-new-src-directory.mjs";
import { testFilenameConventionRule } from "./test-filename-convention.mjs";

export default {
  rules: {
    "filename-convention": filenameConventionRule,
    "no-new-src-directory": noNewSrcDirectoryRule,
    "test-filename-convention": testFilenameConventionRule,
  },
};
