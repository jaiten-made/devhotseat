/**
 * Captures the README screenshots: the room mid-answer, and a finished report.
 *
 * Both are taken against the *test* database, so a run never touches the
 * transcripts in the dev one, and against the real report generator rather than
 * the stub the e2e suite uses — a screenshot of stubbed feedback would be a
 * screenshot of nothing. That costs one Gemini call per run.
 *
 * Start the stack it drives first, in another terminal:
 *
 *   set -a; . ./.env; set +a
 *   DATABASE_URL="$TEST_DATABASE_URL" pnpm dev --port 3200
 *
 * Then, from the repository root:
 *
 *   set -a; . ./.env; set +a
 *   node scripts/capture-screenshots.ts        # both
 *   node scripts/capture-screenshots.ts report # just the report
 *   node scripts/capture-screenshots.ts room   # just the room
 */
import { mkdirSync } from "node:fs";
import { type Browser, chromium, type Page } from "@playwright/test";
import { config } from "dotenv";
import { Pool } from "pg";

config();

const BASE = "http://localhost:3200";
const OUT = new URL("../docs/screenshots/", import.meta.url).pathname;
const connectionString = process.env.TEST_DATABASE_URL;

if (!connectionString) throw new Error("TEST_DATABASE_URL is not set.");
// The same guard the e2e helpers use: seeding truncates, so it may only ever
// point at the test database.
if (!new URL(connectionString).pathname.endsWith("_test")) {
  throw new Error("Refusing to seed a database not named *_test.");
}

const only = process.argv[2] ?? "all";
if (!["all", "room", "report"].includes(only)) {
  throw new Error(`Unknown target "${only}". Use all, room or report.`);
}

const BANK = [
  "Tell me about a time you disagreed with a technical decision.",
  "Describe the hardest bug you have ever debugged.",
  "How do you decide what to test?",
  "Tell me about a project that did not go to plan.",
  "How do you give a colleague difficult feedback?",
  "Walk me through a decision you made without enough information.",
];

/**
 * The session photographed mid-interview: three answers behind it, the fourth
 * question on the stage. Spoken register on purpose — these were dictated.
 */
const ROOM_TURNS = [
  {
    q: "How do you decide what to test?",
    a: "I start from what breaks the product rather than what is easy to cover. Anything that handles money, permissions or data loss gets a test before it ships, and I push that as low as it will go — a pure function over an integration test over an end to end run. The end to end suite I keep deliberately thin, maybe five journeys, because a slow suite that everyone reruns on red is worse than no suite at all.",
  },
  {
    q: "How do you give a colleague difficult feedback?",
    a: "Privately, quickly, and about the work rather than the person. We had someone whose reviews were technically sharp but read as dismissive, and two people had quietly stopped asking him for review. I told him what I had observed, gave him the two comments I meant, and said what I thought the effect was. He did not enjoy it, but he asked me to flag it if it happened again, and it did not.",
  },
  {
    q: "Tell me about a time you disagreed with a technical decision.",
    a: "The team wanted to move a reporting service onto Kafka for a throughput problem we had not measured. I asked for a day to instrument it first, and it turned out we were doing a query per row inside a loop — about eleven thousand queries a page. Batching it took the p95 from nine seconds to under three hundred milliseconds. We kept the boring stack, and I would have been wrong to dig in if the numbers had gone the other way.",
  },
];
const ROOM_ON_STAGE = "Describe the hardest bug you have ever debugged.";
const ROOM_REMAINING = [
  "Tell me about a project that did not go to plan.",
  "Walk me through a decision you made without enough information.",
];

/**
 * The session photographed after it ended, written to land mid-rubric: real
 * situations and concrete first-person action, but outcomes given as "it was
 * fine" and almost no reflection. A session where everything scores a 4 is a
 * screenshot of a product that does not judge you, and the two weakest pillars
 * are the whole reason to read a report.
 */
const REPORT_TURNS = [
  {
    q: "Describe the hardest bug you have ever debugged.",
    a: "We had a webhook that was dropping deliveries, and it only ever happened in production. I turned on more logging around the handler, replayed some of the failed payloads locally, and went through it with one of the other backend devs until we could see the pattern — something was closing the connection on us before the retry landed. I changed the timeout so ours closed first, and the drops stopped. It has been fine since.",
  },
  {
    q: "Tell me about a project that did not go to plan.",
    a: "A migration off an old scheduling service. I was the one running it and I said six weeks in planning. Once we started moving the data across, it turned out a lot of the rows had timestamps we could not trust, so I wrote a script to normalise them and checked batches of it by hand. We got everything across and nothing was lost, but it took a lot longer than I had told people it would.",
  },
  {
    q: "How do you give a colleague difficult feedback?",
    a: "A teammate had started merging his own work without waiting for review. I asked him for a quick call rather than raising it in standup, told him what I had noticed and why it bothered me, and asked what was making him skip it. He said the review queue was too slow, which was fair enough. We agreed he would wait, and I have not seen it happen since.",
  },
  {
    q: "Walk me through a decision you made without enough information.",
    a: "We saw checkout errors climbing about an hour before a release. I could not tell whether it was us or not, so I put the change behind a flag and shipped it to a small slice of traffic rather than all of it, and said in the channel what I was doing. It turned out not to be our code at all. We ramped it up properly the next day.",
  },
];
/** Submitted through the UI, because that is what ends a session. */
const REPORT_FINAL = {
  q: "How do you decide what to test?",
  a: "I go after the parts where a mistake actually costs something — payments, permissions, anything that writes or deletes. Those I cover at the unit level where I can, and I keep the browser tests to the few journeys people cannot avoid. If I fix a bug I will usually add a test for it as well.",
};

interface SeededTurn {
  readonly q: string;
  readonly a: string;
}

/** Inserts one session with `answered` filled in and the rest still to ask. */
async function seedSession(
  pool: Pool,
  {
    answered,
    unanswered,
    startedMinutesAgo,
  }: {
    answered: ReadonlyArray<SeededTurn>;
    unanswered: ReadonlyArray<string>;
    startedMinutesAgo: number;
  },
): Promise<string> {
  const { rows } = await pool.query(
    `INSERT INTO sessions (question_count, started_at)
     VALUES ($1, now() - ($2 || ' minutes')::interval) RETURNING id`,
    [answered.length + unanswered.length, startedMinutesAgo],
  );
  const id = rows[0].id;

  let position = 0;
  for (const turn of answered) {
    position += 1;
    await pool.query(
      `INSERT INTO turns (session_id, position, question_text, answer_text, answered_at)
       VALUES ($1, $2, $3, $4, now())`,
      [id, position, turn.q, turn.a],
    );
  }
  for (const question of unanswered) {
    position += 1;
    await pool.query(
      "INSERT INTO turns (session_id, position, question_text) VALUES ($1, $2, $3)",
      [id, position, question],
    );
  }
  return id;
}

async function seed() {
  const pool = new Pool({ connectionString });
  try {
    await pool.query(
      "TRUNCATE questions, sessions, turns, reports RESTART IDENTITY CASCADE",
    );
    for (const text of BANK) {
      await pool.query("INSERT INTO questions (text) VALUES ($1)", [text]);
    }

    const roomId = await seedSession(pool, {
      answered: ROOM_TURNS,
      // The stage shows the lowest-position turn with no answer, so listing
      // the question to be photographed first is what puts it there.
      unanswered: [ROOM_ON_STAGE, ...ROOM_REMAINING],
      startedMinutesAgo: 6,
    });
    const reportId = await seedSession(pool, {
      answered: REPORT_TURNS,
      unanswered: [REPORT_FINAL.q],
      startedMinutesAgo: 18,
    });
    return { roomId, reportId };
  } finally {
    await pool.end();
  }
}

/**
 * Stands in for the Web Speech API, which is a hosted service no automated
 * browser can reach. It reports the two things the real one does — words the
 * engine has committed and words still in flight — so the room renders exactly
 * what a user sees mid-answer.
 */
const SPEECH_STUB = ({
  committed,
  inFlight,
}: {
  committed: string;
  inFlight: string;
}) => {
  class FakeRecognition {
    constructor() {
      this.continuous = false;
      this.interimResults = false;
      this.lang = "en-US";
      this.onresult = null;
      this.onerror = null;
      this.onend = null;
      this._timer = 0;
    }
    start() {
      this._timer = window.setTimeout(() => {
        const final = [{ transcript: committed }];
        final.isFinal = true;
        const interim = [{ transcript: inFlight }];
        interim.isFinal = false;
        this.onresult?.({ resultIndex: 0, results: [final, interim] });
      }, 150);
    }
    stop() {
      window.clearTimeout(this._timer);
    }
    abort() {
      this.stop();
    }
  }
  const define = (name: string, value: unknown) =>
    Object.defineProperty(window, name, {
      value,
      configurable: true,
      writable: true,
    });

  define("SpeechRecognition", FakeRecognition);
  define("webkitSpeechRecognition", FakeRecognition);
  // Synthesis that engages and then holds, which is the state the room is in
  // while a question is being read aloud.
  define("speechSynthesis", {
    speaking: true,
    pending: false,
    getVoices: () => [],
    speak(utterance: SpeechSynthesisUtterance) {
      utterance.onstart?.();
    },
    cancel() {},
  });
  if (!("SpeechSynthesisUtterance" in window)) {
    define(
      "SpeechSynthesisUtterance",
      class {
        text: string;
        constructor(text: string) {
          this.text = text;
        }
      },
    );
  }
};

/** The dev-only React Query bubble is not part of the product. */
async function hideDevtools(page: Page): Promise<void> {
  await page.addStyleTag({
    content:
      ".tsqd-parent-container, .tsqd-open-btn-container, [aria-label*='query devtools' i] { display: none !important; }",
  });
}

async function captureRoom(browser: Browser, sessionId: string): Promise<void> {
  const context = await browser.newContext({
    // Wide enough that the transcript stands beside the stage rather than
    // sliding over it, which is the layout below md.
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 2,
    colorScheme: "light",
  });
  await context.addInitScript(SPEECH_STUB, {
    committed:
      "The hardest one was a payments webhook that dropped about one delivery in a thousand, and only in production.",
    inFlight:
      "so I added a correlation id at the edge and traced a single request all the way through",
  });
  const page = await context.newPage();
  await page.goto(`${BASE}/sessions/${sessionId}`);

  await page
    .getByRole("button", { name: /^Start the interview/ })
    .click({ timeout: 30_000 });
  await page.getByRole("button", { name: /^Start answering/ }).click();
  // The caption only renders once the microphone is open and words have landed.
  await page.getByText("The hardest one was a payments webhook").waitFor();
  await page.getByRole("button", { name: "Transcript" }).click();
  await page.getByRole("complementary", { name: "Transcript" }).waitFor();
  // Let the panel settle at the newest turn and the orb finish its fade.
  await page.waitForTimeout(1200);
  await hideDevtools(page);

  await page.screenshot({ path: `${OUT}interview-room.png` });
  await context.close();
}

async function captureReport(
  browser: Browser,
  sessionId: string,
): Promise<string> {
  const context = await browser.newContext({
    viewport: { width: 1024, height: 900 },
    deviceScaleFactor: 2,
    colorScheme: "light",
  });
  const page = await context.newPage();
  await page.goto(`${BASE}/sessions/${sessionId}`);

  // Chromium exposes webkitSpeechRecognition even headless, so the room opens
  // on the spoken lobby. Typing is the switch a user gets, and it is what puts
  // the last answer in. Waited for rather than probed, so the check cannot run
  // before React has hydrated.
  const type = page.getByRole("button", { name: "Type" });
  await type.waitFor({ timeout: 30_000 });
  await type.click();

  await page.getByLabel("Your answer").fill(REPORT_FINAL.a);
  await page.getByRole("button", { name: /^Submit final answer/ }).click();

  // A real model writes this one, so give it room.
  await page
    .getByRole("heading", { name: "Feedback" })
    .waitFor({ timeout: 180_000 });
  await page.getByRole("img", { name: /STAR-L scores/ }).waitFor();
  await page.waitForTimeout(1500);
  await hideDevtools(page);

  await page.screenshot({
    path: `${OUT}feedback-report-full.png`,
    fullPage: true,
  });
  // Cropped to the verdict, the radar and the breakdown: the per-answer cards
  // run several screens deep and shrink to nothing in a README.
  await page.screenshot({ path: `${OUT}feedback-report.png` });

  // Printed because the verdict is the model's call, not this script's: the
  // answers above are written to land mid-rubric, and a run that comes out at
  // either extreme means they need another pass.
  const verdict = await page
    .getByText("Verdict")
    .locator("xpath=../..")
    .innerText();
  await context.close();
  return verdict.replace(/\s+/g, " ").trim();
}

const response = await fetch(BASE).catch(() => null);
if (!response?.ok) {
  throw new Error(
    `Nothing is serving ${BASE}. Start it with:\n  DATABASE_URL="$TEST_DATABASE_URL" pnpm dev --port 3200`,
  );
}

mkdirSync(OUT, { recursive: true });
const { roomId, reportId } = await seed();
console.log("seeded", { roomId, reportId });

const browser = await chromium.launch();
try {
  if (only === "all" || only === "report") {
    console.log("report:", await captureReport(browser, reportId));
  }
  if (only === "all" || only === "room") {
    await captureRoom(browser, roomId);
    console.log("room: captured");
  }
} finally {
  await browser.close();
}
