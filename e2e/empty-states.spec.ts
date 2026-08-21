import { expect, test } from "@playwright/test";
import { resetDatabase, seedSessionWithoutReport } from "./support/db";

test("an empty question bank blocks starting a session", async ({ page }) => {
  await resetDatabase();
  await page.goto("/");

  await expect(page.getByText("No questions yet")).toBeVisible();
  await expect(
    page.getByText("Add 5 more questions to start a session"),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Start a session" }),
  ).toBeDisabled();
});

test("a partly filled bank says how many more are needed", async ({ page }) => {
  await resetDatabase();
  await page.goto("/");

  await page.getByLabel("New question").fill("Only question?");
  await page.getByRole("button", { name: "Add", exact: true }).click();

  await expect(
    page.getByText("Add 4 more questions to start a session"),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Start a session" }),
  ).toBeDisabled();
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

  // A missing report is a valid state, not a failure.
  await expect(
    page.getByText("No report was written for this session"),
  ).toBeVisible();
});
