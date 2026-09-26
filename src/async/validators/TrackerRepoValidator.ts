import { LoggerService } from "../../services/LoggerService.ts";
import type { ErrorResponse } from "../../types/Response.ts";
import type { TrackerRepo } from "../../types/Tracker.ts";

export class TrackerRepoValidator {
  private data: TrackerRepo | TrackerRepo[] | undefined | null = undefined;

  constructor() {}

  set(value: TrackerRepo | TrackerRepo[] | undefined | null): this {
    this.data = value;
    return this;
  }

  validateProjectNotNone(project: string): this {
    const empty =
      this.data == null || (Array.isArray(this.data) && this.data.length === 0);
    if (empty) {
      LoggerService.getInstance().error(`Project not found: ${project}`);
      const response: ErrorResponse = {
        status: "error",
        error: {
          code: "PROJECT_NOT_FOUND",
          message: `Project not found: ${project}`,
          details: { project },
        },
      };
      throw response;
    }
    return this;
  }

  first(): TrackerRepo {
    if (Array.isArray(this.data)) {
      return this.data[0];
    }
    return this.data as TrackerRepo;
  }
}
