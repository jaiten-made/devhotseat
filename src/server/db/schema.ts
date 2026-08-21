import {
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * A session is only ever running or finished. "Finished but the report failed"
 * is not a status: the absence of a `reports` row already says that, and the
 * UI has to handle a missing report regardless.
 */
export const sessionStatus = pgEnum("session_status", [
  "in_progress",
  "completed",
]);

/** The question bank. Added and deleted by hand; never edited. */
export const questions = pgTable("questions", {
  id: uuid("id").primaryKey().defaultRandom(),
  text: text("text").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  status: sessionStatus("status").notNull().default("in_progress"),
  /**
   * How many questions the bank held when this session started. Stored rather
   * than derived, so growing the bank later does not retroactively change how
   * far along a finished session appears to be.
   */
  questionCount: integer("question_count").notNull(),
  startedAt: timestamp("started_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
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
export type SessionStatus = Session["status"];
