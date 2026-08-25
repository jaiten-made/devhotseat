import {
  type StructuredReport,
  structuredReportSchema,
} from "../../lib/report/schema";

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

export interface ParsedReport {
  /** The prose shown to the candidate. Never empty. */
  readonly content: string;
  /** The scored rubric, or null when only the prose survived. */
  readonly structured: StructuredReport | null;
}

/** Long enough for a full sentence of evidence, short enough to stay a chip. */
const MAX_NOTE_LENGTH = 400;

/** Models fence their output even when asked for JSON. */
function stripCodeFence(text: string): string {
  const fenced = /^```(?:json)?\s*\n([\s\S]*?)\n?```$/.exec(text);
  return fenced?.[1] === undefined ? text : fenced[1].trim();
}

function truncate(value: string): string {
  const trimmed = value.trim();
  return trimmed.length <= MAX_NOTE_LENGTH
    ? trimmed
    : `${trimmed.slice(0, MAX_NOTE_LENGTH - 1).trimEnd()}…`;
}

/**
 * Tidies what the model returned: trims every string, caps the notes, filters
 * down to expected positions (if all expected positions are covered), and puts
 * the turns back in position order.
 */
function normalise(
  report: StructuredReport,
  expected?: ReadonlyArray<number>,
): StructuredReport {
  let turnsToProcess = report.turns;
  if (expected && expected.length > 0) {
    const expectedSet = new Set(expected);
    const hasAllExpected = expected.every((pos) =>
      report.turns.some((t) => t.position === pos),
    );
    if (hasAllExpected) {
      const seen = new Set<number>();
      turnsToProcess = report.turns.filter((t) => {
        if (expectedSet.has(t.position) && !seen.has(t.position)) {
          seen.add(t.position);
          return true;
        }
        return false;
      });
    }
  }

  return {
    headline: truncate(report.headline),
    narrative: report.narrative.trim(),
    turns: [...turnsToProcess]
      .sort((a, b) => a.position - b.position)
      .map((turn) => ({
        position: turn.position,
        situation: {
          score: turn.situation.score,
          evidence: truncate(turn.situation.evidence),
        },
        task: {
          score: turn.task.score,
          evidence: truncate(turn.task.evidence),
        },
        action: {
          score: turn.action.score,
          evidence: truncate(turn.action.evidence),
        },
        result: {
          score: turn.result.score,
          evidence: truncate(turn.result.evidence),
        },
        learning: {
          score: turn.learning.score,
          evidence: truncate(turn.learning.evidence),
        },
        strength: truncate(turn.strength),
        improvement: truncate(turn.improvement),
      })),
  };
}

/** Same positions, no gaps, no duplicates, nothing invented. */
function coversExactly(
  report: StructuredReport,
  expected: ReadonlyArray<number>,
): boolean {
  const scored = report.turns.map((turn) => turn.position);
  if (scored.length !== expected.length) return false;
  const wanted = [...expected].sort((a, b) => a - b);
  return scored.every((position, index) => position === wanted[index]);
}

/**
 * Pulls a scored report out of a response, degrading rather than failing where
 * it can.
 *
 * A session with no report is already a valid state, so throwing is safe — but
 * it is the worst outcome, and prose alone is worth more than nothing. So the
 * order is: usable JSON, else usable prose, else throw. `content` is non-empty
 * on every returned path, which is what the NOT NULL column relies on.
 */
export function parseReportResponse(
  response: GenerateContentLike,
  expectedPositions: ReadonlyArray<number>,
): ParsedReport {
  const raw = response.text?.trim() ?? "";
  if (raw === "") {
    const finishReason = response.candidates?.[0]?.finishReason;
    throw new Error(
      finishReason
        ? `Model returned no report text (finishReason: ${finishReason}).`
        : "Model returned no report text.",
    );
  }

  const unfenced = stripCodeFence(raw);

  let json: unknown;
  try {
    json = JSON.parse(unfenced);
  } catch {
    // Prose where JSON was asked for is still a usable report. A blob that
    // started as JSON and stopped mid-way is not — rendering a truncated
    // object as a coaching note would be worse than admitting failure.
    if (!unfenced.startsWith("{")) {
      return { content: unfenced, structured: null };
    }
    throw new Error("Model returned malformed JSON.");
  }

  const parsed = structuredReportSchema.safeParse(json);
  if (parsed.success) {
    const report = normalise(parsed.data, expectedPositions);
    if (report.narrative !== "" && coversExactly(report, expectedPositions)) {
      return { content: report.narrative, structured: report };
    }
  }

  // The rubric did not survive, but the prose might have. Salvage it so the
  // candidate still gets feedback.
  const salvaged = salvageNarrative(json);
  if (salvaged !== null) return { content: salvaged, structured: null };

  const issues = parsed.success
    ? "turns did not match the questions asked"
    : parsed.error.issues
        .slice(0, 2)
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join("; ");
  throw new Error(`Model returned an unusable report (${issues}).`);
}

function salvageNarrative(json: unknown): string | null {
  if (json === null || typeof json !== "object") return null;
  const narrative = (json as { narrative?: unknown }).narrative;
  if (typeof narrative !== "string") return null;
  const trimmed = narrative.trim();
  return trimmed === "" ? null : trimmed;
}
