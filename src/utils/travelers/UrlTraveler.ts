import type { Traveler } from "./Traveler.ts";

/**
 * For a given URL (e.g. https://github.com/github/docs), emits URLs in order:
 * full URL, then strip one path segment, until no path left.
 */
export class UrlTraveler implements Traveler {
  async travel(
    url: string,
    callback: (path: string) => Promise<boolean>,
  ): Promise<string | undefined> {
    const normalized = normalizeUrl(url);
    let current: string = normalized;
    while (true) {
      const stop = await callback(current);
      if (stop) return current;
      const next = parentUrl(current);
      if (next === null) return undefined;
      current = next;
    }
  }
}

function normalizeUrl(url: string): string {
  const s = url.trim();
  if (s.endsWith("/")) {
    return s.slice(0, -1);
  }
  return s;
}

/**
 * Returns the parent URL by stripping the last path segment, or null if none.
 */
function parentUrl(url: string): string | null {
  try {
    const u = new URL(url);
    const pathname = u.pathname;
    if (!pathname || pathname === "/") return null;
    const segments = pathname.split("/").filter(Boolean);
    if (segments.length === 0) return null;
    segments.pop();
    u.pathname = segments.length > 0 ? "/" + segments.join("/") : "/";
    const out = u.toString();
    return out.endsWith("/") ? out.slice(0, -1) : out;
  } catch {
    return null;
  }
}
