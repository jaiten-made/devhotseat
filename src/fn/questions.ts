import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getDb } from "../server/deps";
import {
  addQuestion,
  deleteQuestion,
  listQuestions,
} from "../server/services/questions";

export const fetchQuestions = createServerFn({ method: "GET" }).handler(
  async () => listQuestions(getDb()),
);

export const createQuestion = createServerFn({ method: "POST" })
  .validator(z.object({ text: z.string().trim().min(1) }))
  .handler(async ({ data }) => addQuestion(getDb(), data.text));

/**
 * Returns whether a row was removed. Deleting a question never touches an
 * existing transcript: turns carry their own copy of the question text.
 */
export const removeQuestion = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.uuid() }))
  .handler(async ({ data }) => ({
    deleted: await deleteQuestion(getDb(), data.id),
  }));
