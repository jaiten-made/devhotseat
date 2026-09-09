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
/**
 * A session already open in the room, so the recording can start inside the
 * interview rather than spending its first seconds creating one. Nothing is
 * answered yet: the room opens on its briefing and waits to be started.
 */
const SESSION_LIVE = "d3305eed-0000-4000-8000-00000000cafe";

/**
 * One question. A session is as long as you make it, and a demo of a
 * three-question interview is mostly watching someone type.
 */
const LIVE_QUESTIONS = ["Tell me about a time you missed a deadline."];

/** What the bank already holds when the recording starts. */
const BANK = [
  "Describe the hardest bug you have ever debugged.",
  "How do you decide what to test?",
];

/**
 * The answer the finished report is written about.
 *
 * Deliberately a middling one. It has real execution in it and stops dead
 * before the outcome, which is the most common shape of a rehearsed answer —
 * and a report that hands out full marks demonstrates nothing.
 */
const ANSWERED = {
  q: "Tell me about a time you missed a deadline.",
  a: "We were migrating off an old scheduling service and I had estimated six weeks for it. Once we started moving data across, a lot of the rows had timestamps we could not trust, so I wrote a normaliser and hand-checked batches of it against the source. I kept everyone posted in standup while that was going on. We got it all across in the end, but it took longer than I had told people it would.",
  strength:
    "The recovery is concrete and in order: you say what you found and what you built to deal with it.",
  improvement:
    "End on the outcome, not the apology. Say how much longer, and what it cost.",
};

/**
 * A proper STAR-L read: five pillars judged separately, each against what the
 * answer actually says, rather than one impression spread across all of them.
 *
 * Action carries 55% and is the strongest part here; Result is the floor,
 * because the answer never lands one. Weighted, that comes out at 2.4 — a
 * leaning no-hire, which is the honest read of an answer like this.
 */
const structured = {
  turns: [
    {
      position: 1,
      situation: {
        score: 3,
        evidence:
          "Sets up the migration and the six-week estimate, but not what was riding on the date.",
      },
      task: {
        score: 2,
        evidence:
          "The estimate is owned, but your remit beyond it stays vague — mostly \"we\".",
      },
      action: {
        score: 3,
        evidence:
          "Wrote a normaliser for the untrusted timestamps and hand-checked batches against the source.",
      },
      result: {
        score: 1,
        evidence:
          "Closes on \"longer than I had told people\" — no revised date, no cost, nothing measured.",
      },
      learning: {
        score: 1,
        evidence: "Nothing on what you would estimate differently next time.",
      },
      strength: ANSWERED.strength,
      improvement: ANSWERED.improvement,
    },
  ],
  headline: "Real execution, but the story stops before the result.",
  narrative:
    "The middle of this answer is the strong part. You found the timestamps you could not trust, you wrote something to deal with them, and you checked the output by hand rather than assuming. That is the pillar worth the most and you did not have to be asked for it.\n\nIt falls over at the end. \"It took longer than I had told people\" is an apology, not a result — there is no revised date, no sense of what the overrun cost, and no one is left knowing whether the migration was a success. An interviewer has to take the outcome on trust, and most will not.\n\nThe learning is missing entirely. You owned the bad estimate, which is worth something, but you never say what you would do differently, so it reads as a confession rather than a lesson.\n\nTry it again and decide the last sentence before you start. If it is not an outcome, you are ending in the wrong place.",
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
            SELECT 1, started, started + interval '12 minutes' FROM sat
            RETURNING id, started_at
          )
     INSERT INTO turns (session_id, position, question_text, answer_text, answered_at)
     SELECT inserted.id, asked.position, asked.text,
            '(seeded practice history, not a real answer)',
            inserted.started_at + asked.position * interval '2 minutes'
     FROM inserted
     CROSS JOIN unnest($2::text[]) WITH ORDINALITY AS asked(text, position)`,
    [days.map(evening), [ANSWERED.q]],
  );

  // The finished session the storyboard links to, ended earlier today so it
  // sits at the top of the list and fills in today's square.
  await pool.query(
    `INSERT INTO sessions (id, question_count, started_at, ended_at)
     VALUES ($1, 1, now() - interval '38 minutes', now() - interval '22 minutes')`,
    [SESSION_ID],
  );
  await pool.query(
    `INSERT INTO turns (session_id, position, question_text, answer_text, answered_at)
     VALUES ($1, 1, $2, $3, now() - interval '25 minutes')`,
    [SESSION_ID, ANSWERED.q, ANSWERED.a],
  );
  // The session the recording opens in: started, nothing answered.
  await pool.query(
    `INSERT INTO sessions (id, question_count, started_at)
     VALUES ($1, $2, now() - interval '2 minutes')`,
    [SESSION_LIVE, LIVE_QUESTIONS.length],
  );
  for (const [i, question] of LIVE_QUESTIONS.entries()) {
    await pool.query(
      "INSERT INTO turns (session_id, position, question_text) VALUES ($1, $2, $3)",
      [SESSION_LIVE, i + 1, question],
    );
  }

  await pool.query(
    "INSERT INTO reports (session_id, content, structured, model) VALUES ($1, $2, $3, $4)",
    [SESSION_ID, content, structured, "seeded-for-demo"],
  );

  console.log(`seeded: ${BANK.length} questions, ${days.length + 1} practice days`);
  console.log(`report at /sessions/${SESSION_ID}`);
  console.log(`open room at /sessions/${SESSION_LIVE}`);
} finally {
  await pool.end();
}
