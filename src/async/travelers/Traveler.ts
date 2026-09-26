/**
 * Traveler produces an ordered sequence of URLs for a given start URL.
 * Callback returns true to stop traversal.
 */
export type Traveler = {
  travel: (
    url: string,
    callback: (path: string) => Promise<boolean>,
  ) => Promise<string | undefined>;
};
