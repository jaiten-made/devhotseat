import { queryOptions } from "@tanstack/react-query";
import { fetchAiStatus } from "@/fn/ai";
import { fetchQuestions } from "@/fn/questions";
import { fetchSession, fetchSessions } from "@/fn/sessions";
import { queryKeys } from "./query-keys";

export const questionsQuery = () =>
  queryOptions({
    queryKey: queryKeys.questions,
    queryFn: () => fetchQuestions(),
  });

export const sessionsQuery = () =>
  queryOptions({
    queryKey: queryKeys.sessions,
    queryFn: () => fetchSessions(),
  });

export const sessionQuery = (id: string) =>
  queryOptions({
    queryKey: queryKeys.session(id),
    queryFn: () => fetchSession({ data: { id } }),
  });

export const aiStatusQuery = () =>
  queryOptions({
    queryKey: queryKeys.aiStatus,
    queryFn: () => fetchAiStatus(),
    staleTime: 10000,
  });
