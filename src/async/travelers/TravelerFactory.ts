import type { Traveler } from "./Traveler.ts";
import { UrlTraveler } from "./UrlTraveler.ts";
import { FileUrlTraveler } from "./FileUrlTraveler.ts";
import type { FileUrlTravelerProps } from "./FileUrlTraveler.ts";

export type TravelerFactoryProps = FileUrlTravelerProps;

/**
 * Factory for Traveler by URL scheme.
 */
export class TravelerFactory {
  /**
   * Returns the appropriate Traveler for the given URL (file:// vs other).
   */
  static create(url: string, props?: FileUrlTravelerProps): Traveler {
    if (url.startsWith("file://")) {
      return new FileUrlTraveler(props);
    }
    return new UrlTraveler();
  }
}
