# 10. Which devprep Query patterns were kept, and which were changed

## Decision

Kept from devprep: one `QueryClient` handed to components through the router
context, mutations invalidating in `onSuccess`, no optimistic updates, and
`defaultPreload: "intent"`.

Changed:

- **Keys live in one factory.** devprep declared them inline with three naming
  conventions (`["mock-meeting", id]`, `["list-decks"]`, `["sources"]`), so a
  typo in an invalidation failed silently: the mutation succeeded and the list
  never refreshed.
- **Explicit `defaultOptions`.** A bare `new QueryClient()` means `staleTime: 0`
  plus refetch-on-focus, which refires every query on each alt-tab.
- **No `{ success, error }` envelope.** devprep unwrapped that everywhere, so a
  failure rendered as an empty list and `isError` was dead code. Server
  functions throw, so Query's error state does its job.
- **No `useEffect` fetching.** devprep's session hook chained effects and refs;
  here the turn loop is a query plus a mutation that invalidates it.
- **Devtools added**, dev-only behind a dynamic import.

## Cons

- The key factory is one more file to keep in step with the server functions.
