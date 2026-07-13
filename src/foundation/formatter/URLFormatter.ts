import * as path from "path";
import { pathToFileURL } from "url";

export class URLFormatter {
  static removeTrailingSlash(url: string): string {
    if (url.endsWith("/")) {
      return url.slice(0, -1);
    }
    return url;
  }

  /**
   * Normalizes path or URL to a registry URL (file paths → file://, no trailing slash).
   */
  static normalizeRegistryUrl(
    pathOrUrl: string | undefined,
    cwd: string,
  ): string {
    const input = (pathOrUrl ?? cwd).trim();
    if (input === "") return URLFormatter.pathToFileUrl(path.resolve(cwd));

    try {
      const u = new URL(input);
      // Node parses C:/foo as protocol "c:" — treat as a filesystem path instead.
      if (/^[a-zA-Z]:$/.test(u.protocol)) {
        return URLFormatter.pathToFileUrl(path.resolve(cwd, input));
      }
      return URLFormatter.removeTrailingSlash(u.href);
    } catch {
      return URLFormatter.pathToFileUrl(path.resolve(cwd, input));
    }
  }

  static pathToFileUrl(dirPath: string): string {
    const normalized = path.resolve(dirPath);
    const url = pathToFileURL(normalized + path.sep);
    return URLFormatter.removeTrailingSlash(url.href);
  }
}
