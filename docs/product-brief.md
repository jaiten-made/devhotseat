# Demo recorder

## Problem

Posting an MVP to Reddit needs a short video. Recording one by hand means
running a screen recorder, driving the app without fumbling, and then trimming
the result — every time, for every change. The mechanical half of that is
already solved: a script can drive the app in Playwright and write an mp4.

What is left is the storyboard — deciding which screens to visit, in what
order, what the cursor touches, and what each caption says. That is the actual
work, it needs to know what the app does, and it is the part that gets redone
whenever the UI moves.

## Feature

Ask Claude, in this repo, to record a demo. Get back an mp4 worth posting.

## Solution

Two pieces, and nothing else:

- `scripts/record.mjs` — replays a storyboard JSON against a running dev
  server, with an animated cursor and caption overlays, and writes an mp4.
- A Claude Code skill (`.claude/skills/demo/`) — reads the source, works out
  the flow, writes the storyboard, runs the recorder, and iterates on feedback
  like "slower on step 3" by editing the JSON.

The skill is what closes the gap. The recorder is a replay engine; the skill is
the thing that knows what devhotseat does and can write a storyboard for it.

## Who it is for

Me, solo, recording my own MVPs. One person, one machine, no team and no
handover. Nothing here needs to work for anybody else.

## Non-goals

Not being built, and a request for one of these is a signal something has gone
wrong: an API server, Docker packaging for the recorder, an MCP server, an
inspect endpoint, a job queue, storage, anything hosted, GitHub Actions or CI,
third-party video APIs, audio or text-to-speech, a config system, a web UI.

Captions carry the video because Reddit autoplays muted, so audio buys nothing.

## Done when

I post one Reddit video made this way start to finish — asked for in chat,
recorded, posted — without hand-editing the storyboard JSON.

## Risks and open questions

- **`scripts/record.mjs` does not exist yet.** The rest of this brief assumes
  it does. Until it lands, the skill has nothing to call.
- **The room cannot be driven by a real browser.** A session is voice turns on
  the Web Speech API, which is a hosted service an automated browser cannot
  reach. `scripts/capture-screenshots.ts` already works around this with an
  injected stub; the recorder needs the same trick, or the demo has to avoid
  the room and show the question bank, the report and the dashboard instead.
- **The flow needs data that looks used.** An empty dashboard and a session
  with no turns demo nothing. Seeding synthetic data is part of recording, and
  it must stay synthetic — no real names, emails or transcripts on camera.
- **Report generation costs a Gemini call** unless `HOTSEAT_STUB_REPORTS` is
  set, and stubbed feedback is a screenshot of nothing. Which one a recording
  wants is unresolved.
- **45 seconds is tight** for bank → session → report → dashboard. The flow may
  have to lose a step.
- **Selectors drift.** The storyboard pins elements by `data-testid`; the demo
  breaks silently as the UI moves, and only re-recording reveals it.
