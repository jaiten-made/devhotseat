/**
 * Shared between the browser and the server. With one package the constant is
 * imported directly rather than fetched, but the rule it exists for still
 * holds: session progress is read from server data, never from a counter the
 * UI keeps for itself.
 */

/** Number of questions asked in a single practice session. */
export const SESSION_LENGTH = 5;
