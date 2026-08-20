/**
 * Values that must not drift between the session state machine, the API
 * routes, and the UI.
 *
 * SESSION_LENGTH is deliberately server-side only. The web app reads it from
 * the API rather than importing it, so session progress is always server
 * state and never a client-held counter.
 */

/** Number of questions asked in a single practice session. */
export const SESSION_LENGTH = 5;

/**
 * The model that writes feedback reports. Cheapest Flash tier: a short prose
 * report does not need a frontier model. Named once here rather than inline at
 * the call site so changing it is a one-line edit.
 *
 * Pinned to a concrete version rather than a floating "-latest" alias, so a
 * stored report cannot silently change which model produced it. Confirmed
 * available by listing the models this API key can reach.
 */
export const REPORT_MODEL = "gemini-3.5-flash-lite";
