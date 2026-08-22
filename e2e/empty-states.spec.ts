import { expect, test } from "@playwright/test";
import {
  resetDatabase,
  seedSessionWithoutReport,
  seedSessionWithProseOnlyReport,
} from "./support/db";

test("an empty question bank blocks starting a session", async ({ page }) => {
  await resetDatabase();
  await page.goto("/");

  await expect(page.getByText("No questions yet")).toBeVisible();
  await expect(
    page.getByText("Add at least one question to start a session"),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Start a session" }),
  ).toBeDisabled();
});

test("a single question is enough to start a shorter session", async ({
  page,
}) => {
  await resetDatabase();
  await page.goto("/");

  await page.getByLabel("New question").fill("The only question?");
  await page.getByRole("button", { name: "Add", exact: true }).click();

  await expect(
    page.getByText("This session will ask 1 question."),
  ).toBeVisible();
  const start = page.getByRole("button", { name: "Start a session" });
  await expect(start).toBeEnabled();

  await start.click();
  await expect(page.getByText("1 question", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Type" }).click();
  await page.getByLabel("Your answer").fill("My only answer.");
  await page.getByRole("button", { name: "Submit final" }).click();

  await expect(page.getByRole("heading", { name: "Transcript" })).toBeVisible();
  await expect(page.getByText("My only answer.")).toBeVisible();
});

test("no sessions yet reads as an empty list, not an error", async ({
  page,
}) => {
  await resetDatabase();
  await page.goto("/sessions");

  await expect(page.getByText("No sessions yet")).toBeVisible();
});

test("a session whose report is missing still shows its transcript", async ({
  page,
}) => {
  await resetDatabase();
  const sessionId = await seedSessionWithoutReport();
  await page.goto(`/sessions/${sessionId}`);

  await expect(page.getByRole("heading", { name: "Transcript" })).toBeVisible();
  await expect(page.getByText("Seeded question one?")).toBeVisible();
  await expect(page.getByText("Seeded answer two.")).toBeVisible();

  // A missing report is a valid state, not a failure. The amber tint carries
  // that meaning, so it is asserted rather than left to the eye.
  const notice = page.getByText("No report was written for this session");
  await expect(notice).toBeVisible();
  await expect(notice).toHaveCSS(
    "border-top-color",
    "oklab(0.52 0.0410424 0.112763 / 0.5)",
  );
});

/**
 * The backwards-compatibility case. Reports written before scoring existed
 * have no rubric, and must still read as feedback rather than as a broken
 * page — no charts, no error, no empty axes.
 */
test("a prose-only report renders without any scoring", async ({ page }) => {
  await resetDatabase();
  const sessionId = await seedSessionWithProseOnlyReport();
  await page.goto(`/sessions/${sessionId}`);

  await expect(
    page.getByText(
      "This report is prose only, written before scoring existed.",
    ),
  ).toBeVisible();
  await expect(
    page.getByText("Scored feedback isn’t available for this session."),
  ).toBeVisible();

  // No radar, and nothing claiming a verdict it does not have.
  await expect(page.getByRole("img", { name: /STAR-L scores/ })).toHaveCount(0);
  await expect(page.getByText("Overall")).toHaveCount(0);
  await expect(page.getByText("No report was written")).toHaveCount(0);
});
