# 29. The dashboard is one heatmap, derived in the browser

## Decision

The Dashboard screen holds exactly one visualisation: a contribution-graph
heatmap of practice, a square a day for the last 53 weeks, with the current
streak, the longest streak and the number of days practised stated above it.
There is no second chart, no score trend, no per-question breakdown.

Everything on it is derived in the browser from `sessionsQuery` — the same
query the Sessions list already runs. There is no analytics server function, no
aggregate SQL and no new table.

Five rules decide what a square means:

- **A day is practised if a session that started on it was answered at all.**
  A room opened and left again is not practice. A session ended after three of
  five questions is, for those three, which is the line the report generator
  already draws.
- **Days are bucketed in the user's own timezone.** A session sat at nine on a
  Brisbane evening belongs to that evening. Postgres runs on UTC in the compose
  file and is not asked; the browser is the only party that knows where the
  user is standing.
- **Darkness is the session count, on absolute thresholds:** one sitting, two,
  three or more. Not quartiles of the busiest day.
- **A streak survives today.** A run ending yesterday is still current, and
  goes to zero once a whole day has been missed.
- **Weeks start on Monday**, and the streaks are computed over all history
  rather than over the year on screen.

The ramp is one ink at four opacities. No hue.

## Why

The screen was asked for as "analytics, only a streak heatmap", and the
restraint is the feature: a habit tracker answers one question — did I practise
today, and how long is the run — and every additional chart on the page makes
that question take longer to answer. Score trends over five sessions of a
question bank that changes underneath them would also be close to meaningless.

Deriving it client-side is not a shortcut, it is the smaller design. This app
holds one person's sessions on their own machine; a `GROUP BY` on the server
would be a round trip to count a few hundred rows the browser already has in
hand, and it would put a second definition of "a day of practice" in a second
place to disagree with the first. Arriving at the dashboard from Sessions now
costs no request at all, and the two screens cannot contradict each other about
what happened. `buildHeatmap` takes the shape an aggregate query would return,
so the day that stops being true, only its first ten lines move.

Greyscale follows from [27](0027-greyscale-with-colour-reserved-for-judgements.md).
Colour in this app says how an answer scored. How many times someone sat down
is a count, not a judgement, so it is told in density — which is all GitHub's
green is doing, with a hue laid over the top. It also keeps the report the only
coloured thing in the app.

Absolute thresholds rather than relative ones because a square that has not
changed should not change colour: shading against the busiest day repaints the
whole year the first time someone sits four sessions in an afternoon.

## Pros

- One screen, one question, no interpretation needed.
- No new server function, no new query key, no migration. The whole feature is
  a pure module, two components and a route.
- The heatmap and the session list are the same data, so they cannot disagree.
- Bucketing in the browser is correct across timezones and daylight saving,
  which a `date_trunc` on a UTC server is not.
- The grid is a real `<table>`: the days that hold something carry their own
  reading, so the tooltip enhances rather than gates.

## Cons

- The dashboard fetches every session to draw a year. That is a few hundred
  rows for the life of this tool, but it scales with the log and nothing warns
  when it stops being reasonable.
- Streaks are recomputed on every landing, and `new Date()` is read once when
  the screen mounts. A dashboard left open overnight shows yesterday's grid
  until it is reloaded.
- Darkness tops out at three, so a ten-session Sunday looks the same as a
  three-session one. The tooltip says the real number; the square does not.
- The window is a fixed year with no range control, so an older streak is
  visible only through the "longest" figure.
- Four steps of one grey are a narrower scale than a hue would give, and the
  lightest step had to be pushed darker than looked comfortable before it was
  clearly not an empty day.
