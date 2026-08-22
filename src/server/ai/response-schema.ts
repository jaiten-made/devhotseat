import { z } from "zod";
import { structuredReportSchema } from "../../lib/report/schema";

/**
 * Keywords the Gemini API documents as supported on `responseJsonSchema`.
 * Anything zod emits outside this list is either ignored or rejected, so the
 * schema is checked against it by a unit test rather than discovered in
 * production.
 */
export const SUPPORTED_JSON_SCHEMA_KEYWORDS: ReadonlySet<string> = new Set([
  "$id",
  "$defs",
  "$ref",
  "$anchor",
  "type",
  "format",
  "title",
  "description",
  "enum",
  "items",
  "prefixItems",
  "minItems",
  "maxItems",
  "minimum",
  "maximum",
  "anyOf",
  "oneOf",
  "properties",
  "additionalProperties",
  "required",
  "propertyOrdering",
]);

/**
 * Keywords stripped before the schema goes over the wire.
 *
 * `$schema` is not in the supported list, and only exists to tell the SDK to
 * route a schema to `responseJsonSchema` — which `client.ts` does explicitly,
 * so nothing needs to sniff for it.
 *
 * `minItems`/`maxItems` are documented as supported and are not: with them on
 * `turns`, an array of objects, `gemini-3.5-flash-lite` rejects the whole
 * request with a bare `400 INVALID_ARGUMENT`. Verified by bisection against the
 * live API — every other keyword the schema uses passes, and removing just
 * these two makes the same request succeed. The bounds still apply locally,
 * because `parse.ts` validates the response with the zod schema, which keeps
 * them.
 */
const UNSENDABLE_KEYWORDS = ["$schema", "minItems", "maxItems"];

function stripKeywords(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(stripKeywords);
  if (node === null || typeof node !== "object") return node;

  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(node)) {
    if (UNSENDABLE_KEYWORDS.includes(key)) continue;
    // Property names are free-form, so a property called "type" is data, not a
    // keyword. Only recurse into the values.
    out[key] = stripKeywords(value);
  }
  return out;
}

/** The report schema as JSON Schema, computed once at module load. */
export const REPORT_JSON_SCHEMA: Record<string, unknown> = stripKeywords(
  z.toJSONSchema(structuredReportSchema),
) as Record<string, unknown>;
