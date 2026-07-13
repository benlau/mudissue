import { FileService } from "../../services/FileService.ts";

export abstract class Resource {
  protected readonly fileService = FileService.getInstance();

  abstract create(...args: any[]): Promise<any>;
}
