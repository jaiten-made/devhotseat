/**
 * Seeds the demo recording's synthetic data.
 *
 *   set -a; . ./.env; set +a
 *   DATABASE_URL="$TEST_DATABASE_URL" node .demos/seed.mjs
 *
 * Everything here is invented. The recording must never point at the dev
 * database, because a video of real practice transcripts is a video of the
 * user's own interview answers.
 *
 * Two things are seeded: a small question bank, so the live half of the demo
 * has somewhere to add to, and one finished session with a written report,
 * because a report cannot be generated on camera — the model call costs money,
 * takes an unpredictable few seconds, and the stub writes placeholder prose.
 * Its id is fixed so the storyboard can link straight to it.
 */
import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is not set.");
// The same guard the screenshot script uses: this truncates, so it may only
// ever point at the test database.
if (!new URL(connectionString).pathname.endsWith("_test")) {
  throw new Error("Refusing to seed a database not named *_test.");
}

/** Fixed, so .demos/main-flow.json can link to the finished report. */
const SESSION_ID = "d3305eed-0000-4000-8000-00000000de00";

/** What the bank already holds when the recording starts. */
const BANK = [
  "Describe the hardest bug you have ever debugged.",
  "How do you decide what to test?",
];

const ANSWERED = [
  {
    q: "Describe the hardest bug you have ever debugged.",
    a: "We had a webhook dropping deliveries, and only ever in production. I turned on logging around the handler, replayed the failed payloads locally, and worked through it with another backend dev until the pattern showed up — something upstream was closing the connection before our retry landed. I shortened our timeout so we closed first, and the drops stopped.",
    strength:
      "The debugging is walked through step by step, in the order you actually did it.",
    improvement:
      "Say what the drops were costing. A number turns a fix into a result.",
  },
  {
    q: "How do you decide what to test?",
    a: "I go after the parts where a mistake costs something — payments, permissions, anything that writes or deletes. Those get unit tests wherever I can, and I keep the browser tests to the few journeys nobody can avoid. If I fix a bug I add a test for it too.",
    strength: "A clear, defensible rule rather than a list of test types.",
    improvement:
      "Ground it in one real decision you made, and what it caught.",
  },
  {
    q: "Tell me about a project that did not go to plan.",
    a: "A migration off an old scheduling service. I estimated six weeks. Once the data started moving it turned out a lot of rows had timestamps we could not trust, so I wrote a normaliser and hand-checked batches of it. Everything got across and nothing was lost, but it took far longer than I had told people.",
    strength: "You own the estimate rather than explaining it away.",
    improvement:
      "Finish on the lesson — what you would do differently on the next estimate.",
  },
];

const pillars = (situation, task, action, result, learning, evidence) => ({
  situation: { score: situation, evidence },
  task: { score: task, evidence },
  action: { score: action, evidence },
  result: { score: result, evidence },
  learning: { score: learning, evidence },
});

const structured = {
  turns: [
    {
      position: 1,
      ...pillars(3, 3, 4, 3, 3, "Replayed the failed payloads locally to find the pattern."),
      strength: ANSWERED[0].strength,
      improvement: ANSWERED[0].improvement,
    },
    {
      position: 2,
      ...pillars(2, 3, 3, 2, 3, "Covers payments and permissions first, browser tests last."),
      strength: ANSWERED[1].strength,
      improvement: ANSWERED[1].improvement,
    },
    {
      position: 3,
      ...pillars(3, 3, 3, 2, 4, "Wrote a normaliser and hand-checked batches of the data."),
      strength: ANSWERED[2].strength,
      improvement: ANSWERED[2].improvement,
    },
  ],
  headline: "Strong on execution, thin on the results your work produced.",
  narrative:
    "Your actions are the best part of these answers. You walk through what you did in the order you did it, you say \"I\" where it matters, and the technical detail is concrete without turning into a tour of the codebase. That is the pillar worth the most, and you are already good at it.\n\nWhere you lose ground is the result. Two of these three answers stop at the point the work was finished, without saying what changed because of it. The migration answer is the clearest case: you got everything across and lost nothing, which is the result, but it arrives as an aside after the apology about the estimate. Lead with it.\n\nOne thing to try: before each answer, decide the last sentence first. If it is not a number or an outcome, you are ending in the wrong place.",
};

// Rendered as plain text, not markdown: a `##` here shows up as a `##`.
const content = structured.narrative;

/** Evening practice days for the heatmap: a year, thickening towards today. */
function practiceDays() {
  const days = [];
  let seed = 20260909;
  const random = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
  for (let daysAgo = 369; daysAgo >= 9; daysAgo--) {
    // Likelier the closer it gets to today: a year of even squares says
    // nothing, and the shape of a habit forming is what the screen is for.
    if (random() < 0.12 + 0.5 * ((370 - daysAgo) / 370) ** 2) days.push(daysAgo);
  }
  // An unbroken run ending today, so the streak reads as nine.
  for (let daysAgo = 8; daysAgo >= 0; daysAgo--) days.push(daysAgo);
  return days;
}

function evening(daysAgo) {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  date.setHours(20, 15, 0, 0);
  return date.toISOString();
}

const pool = new Pool({ connectionString });
try {
  await pool.query("TRUNCATE questions, sessions, turns, reports RESTART IDENTITY CASCADE");

  for (const text of BANK) {
    await pool.query("INSERT INTO questions (text) VALUES ($1)", [text]);
  }

  // The practice history behind the dashboard. Turns exist only so each day
  // counts as practice; nothing reads their text on camera.
  const days = practiceDays().filter((d) => d !== 0);
  await pool.query(
    `WITH sat AS (SELECT started FROM unnest($1::timestamptz[]) AS started),
          inserted AS (
            INSERT INTO sessions (question_count, started_at, ended_at)
            SELECT 3, started, started + interval '12 minutes' FROM sat
            RETURNING id, started_at
          )
     INSERT INTO turns (session_id, position, question_text, answer_text, answered_at)
     SELECT inserted.id, asked.position, asked.text,
            '(seeded practice history, not a real answer)',
            inserted.started_at + asked.position * interval '2 minutes'
     FROM inserted
     CROSS JOIN unnest($2::text[]) WITH ORDINALITY AS asked(text, position)`,
    [days.map(evening), ANSWERED.map((t) => t.q)],
  );

  // The finished session the storyboard links to, ended earlier today so it
  // sits at the top of the list and fills in today's square.
  await pool.query(
    `INSERT INTO sessions (id, question_count, started_at, ended_at)
     VALUES ($1, 3, now() - interval '38 minutes', now() - interval '22 minutes')`,
    [SESSION_ID],
  );
  for (const [i, turn] of ANSWERED.entries()) {
    await pool.query(
      `INSERT INTO turns (session_id, position, question_text, answer_text, answered_at)
       VALUES ($1, $2, $3, $4, now() - interval '25 minutes')`,
      [SESSION_ID, i + 1, turn.q, turn.a],
    );
  }
  await pool.query(
    "INSERT INTO reports (session_id, content, structured, model) VALUES ($1, $2, $3, $4)",
    [SESSION_ID, content, structured, "seeded-for-demo"],
  );

  console.log(`seeded: ${BANK.length} questions, ${days.length + 1} practice days`);
  console.log(`report at /sessions/${SESSION_ID}`);
} finally {
  await pool.end();
}
