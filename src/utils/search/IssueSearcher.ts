import type { ParsedSearchTerm } from "./types.ts";
import { IssueFolderStorage } from "../storage/IssueFolderStorage.ts";
import { IssueMarkdownFileStorage } from "../storage/IssueMarkdownFileStorage.ts";
import { accessIssueFolderList, type IssueFolder } from "../../types/Issue.ts";
import { DEFAULT_RESOLVED_STATUS_LIST } from "../../types/status.ts";
import { IssueSelectorMatcher } from "../../foundation/matchers/IssueSelectorMatcher.ts";

type ParsedValue =
  | { kind: "number"; value: number }
  | { kind: "date"; value: Date }
  | { kind: "string"; value: string };

type IssueSearchContext = {
  folderName: string;
  frontmatter: Record<string, unknown>;
  content: string;
  createdAt: Date;
  updatedAt: Date;
};

export type IssueSearchOptions = {
  resolvedStatusList?: string[];
};

export class IssueSearcher {
  public async search(
    issues: IssueFolder[],
    parsedTerms: ParsedSearchTerm[],
    options?: IssueSearchOptions,
  ): Promise<IssueFolder[]> {
    const resolvedStatusList =
      options?.resolvedStatusList ?? DEFAULT_RESOLVED_STATUS_LIST;
    const results: IssueFolder[] = [];

    for (const entry of issues) {
      const folderStorage = new IssueFolderStorage(entry);
      const issuePath = await folderStorage.findIssueFile();
      if (issuePath === undefined) {
        continue;
      }
      const issueStorage = new IssueMarkdownFileStorage(issuePath);
      await issueStorage.load();
      const parsed = issueStorage.getParsed();
      const frontmatter = parsed.frontmatter as Record<string, unknown>;

      const createdAt = await folderStorage.getCreatedAt();
      const updatedAt = await folderStorage.getUpdatedAt();

      const issueContext = {
        folderName: entry.folderName,
        frontmatter,
        content: parsed.content,
        createdAt,
        updatedAt,
      };

      if (this.matchesTerms(issueContext, parsedTerms, resolvedStatusList)) {
        const title = String(frontmatter?.title ?? "").trim();
        const status = issueStorage.getStatus();
        const priority = issueStorage.getPriority();
        results.push({
          ...entry,
          metadata: {
            ...entry.metadata,
            title: title || undefined,
            status,
            priority,
            createdAt,
            updatedAt,
            frontmatter,
          },
        });
      }
    }

    return accessIssueFolderList(results).sort().get();
  }

  private matchesTerms(
    issue: IssueSearchContext,
    terms: ParsedSearchTerm[],
    resolvedStatusList: string[],
  ): boolean {
    return terms.every((term) =>
      this.matchesTerm(issue, term, resolvedStatusList),
    );
  }

  private matchesTerm(
    issue: IssueSearchContext,
    term: ParsedSearchTerm,
    resolvedStatusList: string[],
  ): boolean {
    if (term.type === "or") {
      const result = (term.terms ?? []).some((child) =>
        this.matchesTerm(issue, child, resolvedStatusList),
      );
      return term.negated ? !result : result;
    }

    if (term.type === "group") {
      const result = (term.terms ?? []).every((child) =>
        this.matchesTerm(issue, child, resolvedStatusList),
      );
      return term.negated ? !result : result;
    }

    if (term.type === "text" || term.type === "phrase") {
      const frontmatterHaystack = this.frontmatterValuesToSearchableString(
        issue.frontmatter,
      );
      const haystack = [issue.content, frontmatterHaystack]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      const needle = term.value.toLowerCase();
      const result =
        haystack.includes(needle) ||
        (term.type === "text" &&
          this.matchesIssueSelector(issue.folderName, term.value));
      return term.negated ? !result : result;
    }

    if (term.type === "has") {
      const result = Object.prototype.hasOwnProperty.call(
        issue.frontmatter,
        term.value,
      );
      return term.negated ? !result : result;
    }

    if (term.type === "tag") {
      const tagValues = this.stringListFromFrontmatter(
        issue.frontmatter,
        "tags",
      );
      const result = tagValues.some((tag) =>
        this.stringsEqualIgnoreCase(tag, term.value),
      );
      return term.negated ? !result : result;
    }

    if (
      term.type === "status" &&
      this.stringsEqualIgnoreCase(term.value, "resolved")
    ) {
      const result = this.matchesResolvedStatus(
        issue.frontmatter.status,
        resolvedStatusList,
      );
      return term.negated ? !result : result;
    }

    const fieldValue = this.resolveFieldValue(issue, term.type);
    const result = this.compareFieldValue(fieldValue, term.value);
    return term.negated ? !result : result;
  }

  private matchesResolvedStatus(
    status: unknown,
    resolvedStatusList: string[],
  ): boolean {
    if (typeof status !== "string" || status.trim() === "") {
      return false;
    }
    return resolvedStatusList.some((resolved) =>
      this.stringsEqualIgnoreCase(status, resolved),
    );
  }

  private frontmatterValuesToSearchableString(
    frontmatter: Record<string, unknown>,
  ): string {
    const fragments: string[] = [];

    const collect = (value: unknown): void => {
      if (value === null || value === undefined) {
        return;
      }
      if (typeof value === "string") {
        fragments.push(value);
        return;
      }
      if (typeof value === "number" || typeof value === "boolean") {
        fragments.push(String(value));
        return;
      }
      if (value instanceof Date && !Number.isNaN(value.getTime())) {
        fragments.push(value.toISOString());
        return;
      }
      if (Array.isArray(value)) {
        value.forEach(collect);
        return;
      }
      if (typeof value === "object") {
        Object.values(value).forEach(collect);
        return;
      }
      fragments.push(String(value));
    };

    Object.values(frontmatter).forEach(collect);
    return fragments.filter(Boolean).join(" ");
  }

  private matchesIssueSelector(folderName: string, value: string): boolean {
    return IssueSelectorMatcher.match(folderName, value);
  }

  private resolveFieldValue(
    issue: {
      frontmatter: Record<string, unknown>;
      createdAt: Date;
      updatedAt: Date;
    },
    field: string,
  ): unknown {
    if (Object.prototype.hasOwnProperty.call(issue.frontmatter, field)) {
      return issue.frontmatter[field];
    }

    if (field === "createdAt") {
      return issue.createdAt;
    }

    if (field === "updatedAt") {
      return issue.updatedAt;
    }

    return undefined;
  }

  private stringListFromFrontmatter(
    frontmatter: Record<string, unknown>,
    key: string,
  ): string[] {
    const value = frontmatter[key];
    if (Array.isArray(value)) {
      return value.filter((v) => typeof v === "string");
    }
    if (typeof value === "string") {
      return [value];
    }
    return [];
  }

  private compareFieldValue(fieldValue: unknown, rawValue: string): boolean {
    if (fieldValue === undefined || fieldValue === null) {
      return false;
    }

    const listValues = Array.isArray(fieldValue) ? fieldValue : [fieldValue];
    const comparison = this.parseComparison(rawValue);

    return listValues.some((value) =>
      this.compareSingleValue(value, comparison),
    );
  }

  private compareSingleValue(
    fieldValue: unknown,
    comparison: {
      op: "eq" | "gte" | "lte";
      value: ParsedValue;
    },
  ): boolean {
    const fieldParsed = this.parseValue(fieldValue);

    if (comparison.op === "eq") {
      return this.valuesEqual(fieldParsed, comparison.value);
    }

    if (fieldParsed.kind === "date" && comparison.value.kind === "date") {
      return comparison.op === "gte"
        ? fieldParsed.value >= comparison.value.value
        : fieldParsed.value <= comparison.value.value;
    }

    if (fieldParsed.kind === "number" && comparison.value.kind === "number") {
      return comparison.op === "gte"
        ? fieldParsed.value >= comparison.value.value
        : fieldParsed.value <= comparison.value.value;
    }

    return false;
  }

  private stringsEqualIgnoreCase(a: string, b: string): boolean {
    return a.trim().toLowerCase() === b.trim().toLowerCase();
  }

  private valuesEqual(left: ParsedValue, right: ParsedValue): boolean {
    if (left.kind !== right.kind) {
      return this.stringsEqualIgnoreCase(
        String(left.value),
        String(right.value),
      );
    }

    if (left.kind === "date" && right.kind === "date") {
      return left.value.getTime() === right.value.getTime();
    }

    if (left.kind === "string" && right.kind === "string") {
      return this.stringsEqualIgnoreCase(left.value, right.value);
    }

    return left.value === right.value;
  }

  private parseComparison(rawValue: string): {
    op: "eq" | "gte" | "lte";
    value: ParsedValue;
  } {
    const value = rawValue.trim();

    if (value.startsWith(">=")) {
      return { op: "gte", value: this.parseValue(value.slice(2)) };
    }

    if (value.startsWith("<=")) {
      return { op: "lte", value: this.parseValue(value.slice(2)) };
    }

    return { op: "eq", value: this.parseValue(value) };
  }

  private parseValue(value: unknown): ParsedValue {
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      return { kind: "date", value };
    }

    if (typeof value === "number" && Number.isFinite(value)) {
      return { kind: "number", value };
    }

    if (typeof value === "string") {
      const trimmed = value.trim();

      if (trimmed.startsWith("int(") && trimmed.endsWith(")")) {
        const parsed = Number(trimmed.slice(4, -1));
        return { kind: "number", value: parsed };
      }

      if (trimmed.startsWith("date(") && trimmed.endsWith(")")) {
        const parsed = new Date(trimmed.slice(5, -1));
        return { kind: "date", value: parsed };
      }

      if (trimmed.startsWith("str(") && trimmed.endsWith(")")) {
        return { kind: "string", value: trimmed.slice(4, -1) };
      }

      const numberValue = Number(trimmed);
      if (!Number.isNaN(numberValue) && trimmed !== "") {
        return { kind: "number", value: numberValue };
      }

      const dateValue = new Date(trimmed);
      if (!Number.isNaN(dateValue.getTime())) {
        return { kind: "date", value: dateValue };
      }

      return { kind: "string", value: trimmed };
    }

    return { kind: "string", value: String(value) };
  }
}
