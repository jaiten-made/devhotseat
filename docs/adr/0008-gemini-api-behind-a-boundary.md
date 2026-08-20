# 8. The Gemini API with an API key, behind one interface

## Decision

`@google/genai` initialised as `{ apiKey }`, calling the Gemini API. No
`vertexai` flag, no project, no location, no ADC, no gcloud. No Genkit.

The model is one pinned constant, `REPORT_MODEL`; the prompt lives in
`prompt.md`. The app sees only a `ReportGenerator` interface, and `client.ts`
is the only file importing the SDK.

## Why

Vertex AI express mode was the original choice and is unreachable from a
consumer Google account: its keys are service-account-bound and pinned to the
Gemini API by the managed policy
`iam.managed.disableServiceAccountApiKeyCreation`, which cannot be edited on a
project with no organization parent.

The Gemini API keeps the intent — one API key, no service account, no ADC.

## Pros

- Nothing to authenticate beyond one variable.
- Swapping to Vertex or Genkit later touches one file.
- Iterating on the prompt is a text edit, not a code change.
- Tests stub the same seam the real client implements.

## Cons

- Quota and billing attach to the key, not a project.
- Model availability differs from Vertex's catalogue, so `REPORT_MODEL` must be
  checked against the live model list when bumped.
