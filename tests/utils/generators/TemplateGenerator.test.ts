import { TemplateGenerator } from "../../../src/utils/generators/TemplateGenerator.ts";

describe("TemplateGenerator", () => {
  const getTemplatesMap = (generator: TemplateGenerator) =>
    (generator as unknown as { templates: Map<string, string> }).templates;

  it("should render template with context data", () => {
    const generator = new TemplateGenerator();
    const templates = getTemplatesMap(generator);
    templates.set("custom", "Hello <%= name %>");

    const result = generator.getTemplate("custom", { name: "Ada" });

    expect(result).toBe("Hello Ada");
  });

  it("should render issue template with context", () => {
    const generator = new TemplateGenerator();

    const result = generator.getTemplate("issue", {
      quotedTitle: JSON.stringify("My issue"),
      title: "My issue",
      created_at: "2026-01-01",
      status: "open",
      priority: "medium",
    });

    expect(result).toEqual(
      [
        "---",
        'title: "My issue"',
        "status: open",
        "priority: medium",
        "created_at: 2026-01-01",
        "updated_at: 2026-01-01",
        "---",
        "",
        "# My issue",
        "",
        "",
      ].join("\n"),
    );
  });

  it("should return undefined for missing template type", () => {
    const generator = new TemplateGenerator();

    const result = generator.getTemplate("missing");

    expect(result).toBeUndefined();
  });

  it("should render issue-merge-section template with issue export context", () => {
    const generator = new TemplateGenerator();

    const result = generator.getTemplate("issue-merge-section", {
      issue_folder_name: "0001-alpha",
      full_content: [
        "---",
        'title: "Alpha issue"',
        "status: open",
        "---",
        "",
        "# Alpha issue",
        "",
        "First paragraph.",
      ].join("\n"),
    });

    expect(result).toEqual(
      [
        "0001-alpha",
        "--------",
        "",
        "---",
        'title: "Alpha issue"',
        "status: open",
        "---",
        "",
        "# Alpha issue",
        "",
        "First paragraph.",
        "",
      ].join("\n"),
    );
  });
});
