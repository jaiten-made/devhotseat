/**
 * Every query key in one place.
 *
 * devprep declared keys inline at each call site with three different naming
 * conventions, so a typo in an invalidation silently did nothing: the mutation
 * succeeded and the list just never refreshed. Naming them once makes that a
 * type error instead.
 *
 * The keys nest on purpose. Invalidating `sessions` also invalidates every
 * `session(id)` beneath it, which is what submitting an answer needs.
 */
export const queryKeys = {
  questions: ["questions"] as const,
  sessions: ["sessions"] as const,
  session: (id: string) => ["sessions", id] as const,
  aiStatus: ["ai-status"] as const,
};
