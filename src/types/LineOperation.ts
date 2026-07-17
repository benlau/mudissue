export type LineOperationInfo = {
  kind:
    | "linkage"
    | "wikilink"
    | "attachment"
    | "checkbox"
    | "status"
    | "priority"
    | "frontmatter_boundary";
  logicalLineIndexes: number[];
  linkageType?: string;
  issueSelector?: string;
  issueSelectors?: string[];
  /** Wikilink target text (not a resolved filesystem path). */
  attachmentRef?: string;
};

export type LineOperation = {
  kind: "jump" | "unlink" | "attachment" | "checkbox" | "status" | "priority";
  displayRows: number[];
  info: LineOperationInfo;
  symbol: string;
  key: string;
  label: string;
  action: () => Promise<void>;
};
