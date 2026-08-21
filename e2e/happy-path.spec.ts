import { expect, test } from "@playwright/test";
import { resetDatabase } from "./support/db";

const QUESTIONS = [
  "Tell me about a time you disagreed with a technical decision.",
  "Describe the hardest bug you have debugged.",
  "How do you decide what to test?",
  "Tell me about a project that did not go well.",
  "How do you give difficult feedback?",
];

test("add questions, run a session, read the transcript and report", async ({
  page,
}) => {
  await resetDatabase();
  await page.goto("/");

  for (const question of QUESTIONS) {
    await page.getByLabel("New question").fill(question);
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await expect(page.getByText(question)).toBeVisible();
  }

  await page.getByRole("button", { name: "Start a session" }).click();
  await expect(page.getByText("Question 1 of 5")).toBeVisible();

  // These specs drive the text UI only: no microphone, no fake device flags.
  // The same switch a user gets when speech is unavailable or unwanted.
  await page.getByRole("button", { name: "Type" }).click();

  for (let turn = 1; turn <= 5; turn++) {
    await expect(page.getByText(`Question ${turn} of 5`)).toBeVisible();

    // Mid-session the call bar's transcript drawer holds the answers given so
    // far, and nothing else: the questions still to come must not leak.
    if (turn === 3) {
      await page.getByRole("button", { name: "Transcript" }).click();
      await expect(page.getByText("This is answer number 1.")).toBeVisible();
      await expect(page.getByText("This is answer number 2.")).toBeVisible();
      await expect(page.getByText("This is answer number 3.")).toHaveCount(0);
      await page.getByRole("button", { name: "Hide" }).click();
      await expect(page.getByText("This is answer number 1.")).toBeHidden();
    }

    await page.getByLabel("Your answer").fill(`This is answer number ${turn}.`);
    await page
      .getByRole("button", {
        name: turn === 5 ? "Submit final" : "Submit",
        exact: true,
      })
      .click();
  }

  // The session auto-ends on the last answer and swaps to the transcript.
  await expect(page.getByRole("heading", { name: "Transcript" })).toBeVisible();
  await expect(page.getByText("5 of 5 answered")).toBeVisible();

  for (let turn = 1; turn <= 5; turn++) {
    await expect(
      page.getByText(`This is answer number ${turn}.`),
    ).toBeVisible();
  }

  await expect(page.getByRole("heading", { name: "Feedback" })).toBeVisible();
  await expect(
    page.getByText("This is a stubbed feedback report"),
  ).toBeVisible();

  await page.getByRole("link", { name: "Sessions" }).click();
  await expect(page.getByText("5 of 5 answered")).toBeVisible();
  await expect(page.getByText("Report ready")).toBeVisible();
});
