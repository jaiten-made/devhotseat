import { expect, test } from "@playwright/test";
import { resetDatabase } from "./support/db";

const QUESTIONS = [
  "Tell me about a time you disagreed with a technical decision.",
  "Describe the hardest bug you have debugged.",
  "How do you decide what to test?",
];

/**
 * Leaving the room ends the interview: a session cannot be left running, so
 * there is no way back into one and nothing in the list is ever mid-flight.
 * See ADR 24.
 */
test("leaving part way through ends the interview and reports on what was answered", async ({
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
  // Typing throughout: these specs drive no microphone.
  await page.getByRole("button", { name: "Type" }).click();

  await page.getByLabel("Your answer").fill("My first answer.");
  await page.getByRole("button", { name: /^Submit answer/ }).click();
  await expect(page.getByText("Question 2 of 3")).toBeVisible();

  // The way out says what it costs before taking it.
  await page.getByRole("button", { name: "End interview" }).click();
  await expect(
    page.getByText(/report will be written from the 1 answer/),
  ).toBeVisible();
  await expect(page.getByText(/remaining 2 questions/)).toBeVisible();

  // Backing out leaves the interview exactly where it was.
  await page.getByRole("button", { name: "Keep going" }).click();
  await expect(page.getByText("Question 2 of 3")).toBeVisible();

  await page.getByRole("button", { name: "End interview" }).click();
  await page
    .getByRole("button", { name: "End interview", exact: true })
    .last()
    .click();

  // Ending lands on the finished session: transcript, report and all.
  await expect(page.getByRole("heading", { name: "Transcript" })).toBeVisible();
  await expect(page.getByText("1 of 3 answered")).toBeVisible();
  await expect(page.getByText("My first answer.")).toBeVisible();
  await expect(page.getByText("(not answered)")).toHaveCount(2);
  await expect(
    page.getByText("This is a stubbed feedback report"),
  ).toBeVisible();

  // And nothing is left running.
  await page.getByRole("link", { name: "Sessions" }).click();
  await expect(page.getByText("1 of 3 answered")).toBeVisible();
  await expect(page.getByText("Report ready")).toBeVisible();
  await expect(page.getByText("In progress")).toHaveCount(0);

  // The room refuses to reopen: the session is over, so the URL is a transcript.
  await page.getByText("1 of 3 answered").click();
  await expect(page.getByRole("heading", { name: "Transcript" })).toBeVisible();
  await expect(page.getByRole("button", { name: "End interview" })).toHaveCount(
    0,
  );
});

test("leaving before answering anything ends it without a report", async ({
  page,
}) => {
  await resetDatabase();
  await page.goto("/");

  await page.getByLabel("New question").fill("The only question?");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await page.getByRole("button", { name: "Start a session" }).click();

  await expect(
    page.getByRole("heading", { name: "Ready when you are" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "End interview" }).click();
  await expect(page.getByText(/nothing to write a report from/)).toBeVisible();
  await page
    .getByRole("button", { name: "End interview", exact: true })
    .last()
    .click();

  await expect(page.getByRole("heading", { name: "Transcript" })).toBeVisible();
  await expect(page.getByText("0 of 1 answered")).toBeVisible();
  await expect(page.getByText(/No report was written/)).toBeVisible();
});
