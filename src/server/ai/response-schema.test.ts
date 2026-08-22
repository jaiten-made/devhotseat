import { describe, expect, it } from "vitest";
import { structuredReportSchema } from "../../lib/report/schema";
import {
  REPORT_JSON_SCHEMA,
  SUPPORTED_JSON_SCHEMA_KEYWORDS,
} from "./response-schema";

/** Every keyword used anywhere in the schema tree, at any depth. */
function keywordsIn(
  node: unknown,
  found: Set<string> = new Set(),
): Set<string> {
  if (Array.isArray(node)) {
    for (const item of node) keywordsIn(item, found);
    return found;
  }
  if (node === null || typeof node !== "object") return found;

  for (const [key, value] of Object.entries(node)) {
    found.add(key);
    // Property *names* are free-form; only the schema keywords are constrained,
    // so descend into a properties bag without collecting its keys.
    if (key === "properties" && value && typeof value === "object") {
      for (const child of Object.values(value)) keywordsIn(child, found);
    } else {
      keywordsIn(value, found);
    }
  }
  return found;
}

describe("REPORT_JSON_SCHEMA", () => {
  /**
   * The guard that matters. Adding `.min(1)` to a string in schema.ts emits
   * `minLength`, which Gemini does not support — structured output would break
   * silently in production and every report would degrade to prose.
   */
  it("uses only keywords Gemini supports", () => {
    const used = [...keywordsIn(REPORT_JSON_SCHEMA)].filter(
      (keyword) => !SUPPORTED_JSON_SCHEMA_KEYWORDS.has(keyword),
    );
    expect(used).toEqual([]);
  });

  it("drops $schema, which is not a supported keyword", () => {
    expect(REPORT_JSON_SCHEMA).not.toHaveProperty("$schema");
  });

  /**
   * Documented as supported, empirically not: with minItems/maxItems on the
   * turns array the live API rejects the request outright. Regression guard for
   * the bisection that found it.
   */
  it("drops the item bounds the live API rejects", () => {
    const used = keywordsIn(REPORT_JSON_SCHEMA);
    expect(used.has("minItems")).toBe(false);
    expect(used.has("maxItems")).toBe(false);
  });

  it("keeps the bounds in the zod schema, which still validates responses", () => {
    const tooMany = {
      turns: Array.from({ length: 51 }, () => ({})),
      headline: "x",
      narrative: "y",
    };
    expect(structuredReportSchema.safeParse(tooMany).success).toBe(false);
    expect(
      structuredReportSchema.safeParse({
        turns: [],
        headline: "x",
        narrative: "y",
      }).success,
    ).toBe(false);
  });

  it("is fully inlined, so no $ref resolution is needed", () => {
    const used = keywordsIn(REPORT_JSON_SCHEMA);
    expect(used.has("$ref")).toBe(false);
    expect(used.has("$defs")).toBe(false);
  });

  it("describes the object the parser expects", () => {
    expect(REPORT_JSON_SCHEMA.type).toBe("object");
    expect(REPORT_JSON_SCHEMA.required).toEqual([
      "turns",
      "headline",
      "narrative",
    ]);
  });

  it("bounds every pillar score to the 1-4 rubric", () => {
    const properties = REPORT_JSON_SCHEMA.properties as Record<
      string,
      { items: { properties: Record<string, unknown> } }
    >;
    const turn = properties.turns?.items.properties ?? {};
    for (const pillar of [
      "situation",
      "task",
      "action",
      "result",
      "learning",
    ]) {
      const score = (turn[pillar] as { properties: Record<string, unknown> })
        ?.properties?.score as Record<string, unknown>;
      expect(score).toMatchObject({ type: "integer", minimum: 1, maximum: 4 });
    }
  });
});
