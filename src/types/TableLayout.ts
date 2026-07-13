export type EllipsisDirection = "left" | "right";

export type TableColumnDef = {
  minWidth?: number;
  maxWidth?: number;
  grow?: number;
  ellipsisDirection?: EllipsisDirection;
};

export type TableWidthRange = {
  minWidth: number;
  maxWidth: number;
};
