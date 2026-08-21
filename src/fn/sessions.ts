import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { SESSION_LENGTH } from "../config";
import { getDb, getReportGenerator } from "../server/deps";
import {
  createSession,
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
    const result = await createSession(db, SESSION_LENGTH);
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
  .validator(z.object({ id: z.uuid(), answer: z.string().trim().min(1) }))
  .handler(async ({ data }) => {
    const db = getDb();
    const result = await submitAnswer(
      db,
      getReportGenerator(),
      data.id,
      data.answer,
    );
    if (result === null)
      return { ok: false as const, reason: "not_found" as const };
    if (!result.ok) return { ok: false as const, reason: result.reason };
    return { ok: true as const, session: await getSessionDetail(db, data.id) };
  });
