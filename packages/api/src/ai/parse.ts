/**
 * The shape of a generateContent response, narrowed to what we read. Declared
 * structurally rather than imported from the SDK so parsing can be unit tested
 * without constructing an SDK object.
 */
export interface GenerateContentLike {
  readonly text?: string | undefined;
  readonly candidates?:
    | ReadonlyArray<{ readonly finishReason?: string | undefined }>
    | undefined;
}

/**
 * Pulls the report text out of a response.
 *
 * Throws when the model returned nothing usable, quoting the finish reason so
 * a safety block or a token limit is identifiable from the error alone. The
 * caller turns that into a session with no report, which is a valid state.
 */
export function parseReportResponse(response: GenerateContentLike): string {
  const content = response.text?.trim() ?? "";
  if (content !== "") return content;

  const finishReason = response.candidates?.[0]?.finishReason;
  throw new Error(
    finishReason
      ? `Model returned no report text (finishReason: ${finishReason}).`
      : "Model returned no report text.",
  );
}
