import { IssueFolderLinkFormatter } from "../formatter/IssueFolderLinkFormatter.ts";
import { IssueSelectorMatcher } from "../matchers/IssueSelectorMatcher.ts";
import type { LineOperationInfo } from "../../types/LineOperation.ts";
import type { LineRange } from "../../types/LineRange.ts";
import {
  FrontMatterLineParser,
  type FrontMatterLineParseResult,
} from "./FrontMatterLineParser.ts";
import { MarkdownParser } from "./MarkdownParser.ts";

const FRONTMATTER_FIELD_KINDS = ["status", "priority"] as const;
const WIKILINK_PATTERN = /\[\[(.+?)\]\]/;

export type MarkdownLineOperationDetectOptions = {
  linkTypeFieldNames?: string[];
};

type DetectorContext = {
  lines: string[];
  frontmatter: FrontMatterLineParseResult | null;
  linkTypeFieldNames: string[];
};

function lineIndexesInRange(range: LineRange): number[] {
  const indexes: number[] = [];
  for (let i = range.start; i <= range.end; i++) {
    indexes.push(i);
  }
  return indexes;
}

function isLineInRange(lineIndex: number, range: LineRange): boolean {
  return lineIndex >= range.start && lineIndex <= range.end;
}

function detectFrontmatterBoundaryLines(
  context: DetectorContext,
): LineOperationInfo[] {
  const { frontmatter } = context;
  if (frontmatter == null) {
    return [];
  }
  return [
    {
      kind: "frontmatter_boundary",
      logicalLineIndexes: [
        frontmatter.lineRange.start,
        frontmatter.lineRange.end,
      ],
    },
  ];
}

function detectFrontMatterFieldLines(
  context: DetectorContext,
): LineOperationInfo[] {
  const { frontmatter } = context;
  if (frontmatter == null) {
    return [];
  }

  const results: LineOperationInfo[] = [];
  for (const field of FRONTMATTER_FIELD_KINDS) {
    const fieldRange = frontmatter.fields[field];
    if (fieldRange == null) {
      continue;
    }
    results.push({
      kind: field,
      logicalLineIndexes: lineIndexesInRange(fieldRange),
    });
  }
  return results;
}

function detectLinkageLines(context: DetectorContext): LineOperationInfo[] {
  const { lines, frontmatter, linkTypeFieldNames } = context;
  if (frontmatter == null || linkTypeFieldNames.length === 0) {
    return [];
  }

  const results: LineOperationInfo[] = [];
  for (const fieldName of linkTypeFieldNames) {
    const fieldRange = frontmatter.fields[fieldName];
    if (fieldRange == null) {
      continue;
    }

    for (const lineIndex of lineIndexesInRange(fieldRange)) {
      const line = lines[lineIndex] ?? "";
      const match = WIKILINK_PATTERN.exec(line);
      if (match == null) {
        continue;
      }
      const issueSelector = IssueFolderLinkFormatter.stripFolderReference(
        match[0],
      );
      if (issueSelector === "") {
        continue;
      }
      results.push({
        kind: "linkage",
        logicalLineIndexes: [lineIndex],
        linkageType: fieldName,
        issueSelector,
      });
    }
  }
  return results;
}

function detectWikiLinkLines(context: DetectorContext): LineOperationInfo[] {
  const { lines, frontmatter } = context;
  const results: LineOperationInfo[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (frontmatter != null && isLineInRange(i, frontmatter.lineRange)) {
      continue;
    }
    const issueSelectors = MarkdownParser.extractWikiLinkTargets(
      lines[i]!,
    ).filter((target) => IssueSelectorMatcher.isValidateFolderName(target));
    if (issueSelectors.length === 0) {
      continue;
    }
    results.push({
      kind: "wikilink",
      logicalLineIndexes: [i],
      issueSelectors,
    });
  }
  return results;
}

function detectCheckboxLines(context: DetectorContext): LineOperationInfo[] {
  const { lines, frontmatter } = context;
  const results: LineOperationInfo[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (frontmatter != null && isLineInRange(i, frontmatter.lineRange)) {
      continue;
    }
    if (MarkdownParser.parseCheckboxLine(lines[i]!) !== null) {
      results.push({
        kind: "checkbox",
        logicalLineIndexes: [i],
      });
    }
  }
  return results;
}

const DETECTORS = [
  detectFrontmatterBoundaryLines,
  detectFrontMatterFieldLines,
  detectCheckboxLines,
  detectWikiLinkLines,
  detectLinkageLines,
];

export class MarkdownLineOperationParser {
  static detect(
    lines: string[],
    options?: MarkdownLineOperationDetectOptions,
  ): LineOperationInfo[] {
    const frontmatter = FrontMatterLineParser.parse(lines.join("\n"));
    const context: DetectorContext = {
      lines,
      frontmatter,
      linkTypeFieldNames: options?.linkTypeFieldNames ?? [],
    };
    const results: LineOperationInfo[] = [];
    for (const detector of DETECTORS) {
      results.push(...detector(context));
    }
    return results;
  }
}
