import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getDb, getReportGenerator } from "../server/deps";
import {
  createSession,
  deleteSession,
  endSession,
  getSessionDetail,
  listSessions,
  submitAnswer,
} from "../server/services/sessions";

export const fetchSessions = createServerFn({ method: "GET" }).handler(
  async () => listSessions(getDb()),
);

export const fetchSession = createServerFn({ method: "GET" })
  .validator(z.object({ id: z.uuid() }))
  .handler(async ({ data }) => getSessionDetail(getDb(), data.id));

/**
 * Starts a session, or reports why it cannot start. An empty bank is an
 * expected answer, not an exception, so the UI can say so without catching
 * anything.
 */
export const startSession = createServerFn({ method: "POST" }).handler(
  async () => {
    const db = getDb();
    const result = await createSession(db);
    if (!result.ok) {
      return { ok: false as const, reason: result.reason, have: result.have };
    }
    return {
      ok: true as const,
      session: await getSessionDetail(db, result.sessionId),
    };
  },
);

/**
 * Records an answer. Submitting the last one ends the session and generates
 * the report, both decided by the state machine.
 */
export const answerTurn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      id: z.uuid(),
      answer: z.string().trim().min(1),
      aiProvider: z.enum(["local", "gemini"]).optional(),
    }),
  )
  .handler(async ({ data }) => {
    const db = getDb();
    const result = await submitAnswer(
      db,
      getReportGenerator(data.aiProvider),
      data.id,
      data.answer,
    );
    if (result === null)
      return { ok: false as const, reason: "not_found" as const };
    if (!result.ok) return { ok: false as const, reason: result.reason };
    return { ok: true as const, session: await getSessionDetail(db, data.id) };
  });

/**
 * Ends a session where it stands, which is what leaving the room does: the
 * report is written on the answers given so far. Nothing is left running.
 */
export const leaveSession = createServerFn({ method: "POST" })
  .validator(
    z.object({
      id: z.uuid(),
      aiProvider: z.enum(["local", "gemini"]).optional(),
    }),
  )
  .handler(async ({ data }) => {
    const db = getDb();
    const result = await endSession(
      db,
      getReportGenerator(data.aiProvider),
      data.id,
    );
    if (result === null)
      return { ok: false as const, reason: "not_found" as const };
    if (!result.ok) return { ok: false as const, reason: result.reason };
    return { ok: true as const, session: await getSessionDetail(db, data.id) };
  });

/**
 * Deletes a session with its turns and its report. Returns whether a row was
 * removed, so a list that was already stale does not report a false success.
 */
export const removeSession = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.uuid() }))
  .handler(async ({ data }) => ({
    deleted: await deleteSession(getDb(), data.id),
  }));
