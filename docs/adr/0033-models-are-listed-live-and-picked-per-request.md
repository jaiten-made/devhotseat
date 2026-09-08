# 33. Models are listed live and picked per request

Amends [0030](0030-local-ai-support-and-gemini-toggle.md), which fixed the
model per provider in `.env`.

## Decision

Both providers report what they can run, and the picker offers it. Ollama is
asked for its pulled tags, the Gemini API for the catalogue this key can reach,
and each list is discovered when the picker is opened rather than written down
here. The choice is stored per provider in the browser and travels with each
report request as `aiModel`, beside the `aiProvider` that was already there.
`LOCAL_AI_MODEL` and `GEMINI_MODEL` stay as the default when nothing is picked.

The id is checked for shape, not membership. A Gemini id is interpolated into
the request path, so `resolveModelId` discards anything carrying `..`, a scheme
or whitespace and falls back to the default. It is deliberately not checked
against the live list, which would put a listing round trip in front of every
report to catch something the provider rejects anyway.

Gemini's catalogue is cached for five minutes, because the picker polls status
while it is open. Ollama's is not: pulling a model is exactly when you reopen
the picker expecting to see it.

## Why

A pinned model is right for the API key and wrong for the picker. Daily drills
want the 3B model that answers in seconds; a session worth reading properly
wants the better one, and swapping meant editing `.env` and restarting. Listing
live rather than curating means a model released — or pulled — after this was
written appears without an upgrade, which is the whole point of not writing the
list down.

## Pros

- A model released tomorrow is selectable today.
- The installed-model list doubles as the liveness check already being made: an
  empty list from a reachable runner reads as "nothing pulled", not "offline".
- A pick that the provider no longer offers is dropped for the default, so
  deleting an Ollama tag does not fail a session later.
- The model is recorded on the report, so which one wrote it stays answerable.

## Cons

- Gemini lists embedding, image, video, speech and computer-use models that
  would accept the prompt and return something that is not a report. Filtering
  them on id substrings is a naming-convention guess, so a family named outside
  the convention slips through until the filter is taught about it.
- Scores are no longer comparable across a session history without reading the
  model off each report, since two reports a day apart may have been written by
  different models.
- The refresh button re-probes Ollama immediately but not Gemini, whose
  catalogue can be up to five minutes stale.
