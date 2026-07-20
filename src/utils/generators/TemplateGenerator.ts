import issueTemplate from "../../assets/templates/issue.md";
import mudconfTemplate from "../../assets/templates/mud.conf";
import issueMergeSectionTemplate from "../../assets/templates/issue-merge-section.md";
import ejs from "ejs";

export type TemplateType = string;
export type ResourceTemplate = string;

/**
 * Renders bundled resource templates (issue, mudconf) with optional EJS context.
 */
export class TemplateGenerator {
  private templates: Map<TemplateType, ResourceTemplate>;

  constructor() {
    this.templates = new Map<TemplateType, ResourceTemplate>();
    this.templates.set("issue", issueTemplate);
    this.templates.set("mudconf", mudconfTemplate);
    this.templates.set("issue-merge-section", issueMergeSectionTemplate);
  }

  getTemplate(
    resourceType: TemplateType,
    context?: Record<string, unknown>,
  ): ResourceTemplate | undefined {
    const template = this.templates.get(resourceType);
    if (!template) {
      return template;
    }
    return ejs.render(template, context ?? {});
  }
}
