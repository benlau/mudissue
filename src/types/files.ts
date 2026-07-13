/** Full path to a file/folder and its path relative to the TrackerRepo root. */
export type FilePath = {
  /** Full filesystem path (e.g. to the issue folder). */
  absPath: string;
  /** Path relative to the TrackerRepo root. */
  relativePath: string;
};
