import {
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import type { StructuredReport } from "../../lib/report/schema";

/** The question bank. Added and deleted by hand; never edited. */
export const questions = pgTable("questions", {
  id: uuid("id").primaryKey().defaultRandom(),
  text: text("text").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * `ended_at` is the whole of a session's status. Running or finished was once a
 * `session_status` column beside it, saying the same thing twice — and a status
 * can disagree with its timestamp, where a timestamp cannot disagree with
 * itself. "Finished but the report failed" is not a status either: the absence
 * of a `reports` row already says that.
 */
export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  /**
   * How many questions the bank held when this session started. Stored rather
   * than derived, so growing the bank later does not retroactively change how
   * far along a finished session appears to be.
   */
  questionCount: integer("question_count").notNull(),
  startedAt: timestamp("started_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  /** Null only while the interview is still open in the room. */
  endedAt: timestamp("ended_at", { withTimezone: true }),
});

/**
 * All turns for a session are inserted when it starts, with the questions
 * already chosen and `answer_text` still null. The next question to ask is the
 * lowest-position turn with no answer.
 */
export const turns = pgTable(
  "turns",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    /** 1-based, up to the session's question_count. */
    position: integer("position").notNull(),
    /**
     * The question text as it was asked, copied from the bank. Deliberately
     * not a foreign key: a transcript is a record of what actually happened,
     * and deleting a question later must not change it.
     */
    questionText: text("question_text").notNull(),
    answerText: text("answer_text"),
    answeredAt: timestamp("answered_at", { withTimezone: true }),
  },
  (table) => [
    unique("turns_session_position_key").on(table.sessionId, table.position),
  ],
);

/** One report per session at most, written once when the session ends. */
export const reports = pgTable("reports", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionId: uuid("session_id")
    .notNull()
    .unique()
    .references(() => sessions.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  /**
   * The scored STAR-L rubric behind the prose. Nullable on purpose: reports
   * written before scoring existed have none, and a model that returns
   * unusable JSON but usable prose still writes a row.
   */
  structured: jsonb("structured").$type<StructuredReport>(),
  /** Which model wrote it, so a later prompt or model change is traceable. */
  model: text("model").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Question = typeof questions.$inferSelect;
export type NewQuestion = typeof questions.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
export type Turn = typeof turns.$inferSelect;
export type NewTurn = typeof turns.$inferInsert;
export type Report = typeof reports.$inferSelect;
export type NewReport = typeof reports.$inferInsert;
