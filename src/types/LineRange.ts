/** 0-based inclusive line indices into a string split on `\n` (after `\r\n` normalization). */
export type LineRange = {
  readonly start: number;
  readonly end: number;
};
