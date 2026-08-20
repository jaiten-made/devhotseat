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
