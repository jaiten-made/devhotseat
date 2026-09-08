import { expect, test } from "@playwright/test";
import { resetDatabase } from "./support/db";

const QUESTIONS = [
  "Tell me about a time you disagreed with a technical decision.",
  "Describe the hardest bug you have debugged.",
  "How do you decide what to test?",
  "Tell me about a project that did not go well.",
];

/**
 * A session is the questions picked for it, not the whole bank. See ADR 32.
 *
 * The point of the picker is a short sitting against a bank too big to sit in
 * one go, so this unticks most of it and checks the session is as long as what
 * was left — and that the bank itself is untouched by the pick.
 */
test("a session asks only the questions ticked for it", async ({ page }) => {
  await resetDatabase();
  await page.goto("/questions");

  for (const question of QUESTIONS) {
    await page.getByLabel("New question").fill(question);
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await expect(page.getByText(question)).toBeVisible();
  }

  await page.getByRole("link", { name: "New session" }).click();
  await expect(page.getByText("All 4 picked")).toBeVisible();

  // Two of the four, chosen by name rather than by row order: the bank lists
  // newest first, and this spec should not depend on that.
  await page.getByRole("checkbox", { name: QUESTIONS[0] }).click();
  await page.getByRole("checkbox", { name: QUESTIONS[1] }).click();
  await expect(page.getByText("2 of 4 picked")).toBeVisible();
  await expect(
    page.getByText("This session will ask 2 questions."),
  ).toBeVisible();

  await page.getByRole("button", { name: "Start a session" }).click();
  await expect(page.getByText("2 questions", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Type" }).click();
  for (let turn = 1; turn <= 2; turn++) {
    await expect(page.getByText(`Question ${turn} of 2`)).toBeVisible();
    await page.getByLabel("Your answer").fill(`This is answer number ${turn}.`);
    await page
      .getByRole("button", {
        name: turn === 2 ? /^Submit final answer/ : /^Submit answer/,
      })
      .click();
  }

  // The session was the pick, so only the two left ticked were asked. Each
  // asked question is on this screen twice — once in the transcript, once on
  // its report card — so these match the first of the pair.
  await expect(page.getByRole("heading", { name: "Transcript" })).toBeVisible();
  await expect(page.getByText(QUESTIONS[2]).first()).toBeVisible();
  await expect(page.getByText(QUESTIONS[3]).first()).toBeVisible();
  await expect(page.getByText(QUESTIONS[0])).toHaveCount(0);

  // Picking is not deleting: the bank still holds all four.
  await page.getByRole("link", { name: "Questions" }).click();
  await expect(page.getByText("4 questions in the bank")).toBeVisible();
});
