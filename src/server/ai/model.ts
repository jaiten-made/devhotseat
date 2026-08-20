/**
 * The model that writes feedback reports. Cheapest Flash tier: a short prose
 * report does not need a frontier model. Named once here rather than inline at
 * the call site so changing it is a one-line edit.
 *
 * Pinned to a concrete version rather than a floating "-latest" alias, so a
 * stored report cannot silently change which model produced it. Confirmed
 * available by listing the models this API key can reach.
 *
 * Server-only: this must not end up in the browser bundle.
 */
export const REPORT_MODEL = "gemini-3.5-flash-lite";
