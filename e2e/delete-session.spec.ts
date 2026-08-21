import { expect, test } from "@playwright/test";
import { resetDatabase, seedSessionWithoutReport } from "./support/db";

test("deleting a session asks first, and cancelling keeps it", async ({
  page,
}) => {
  await resetDatabase();
  // A finished session with a transcript, seeded rather than played through:
  // this spec is about the delete, not about answering.
  await seedSessionWithoutReport();

  // A question in the bank, so the delete can be shown not to touch it.
  await page.goto("/");
  await page.getByLabel("New question").fill("Kept question?");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByText("Kept question?")).toBeVisible();

  await page.getByRole("link", { name: "Sessions" }).click();
  const trash = page.getByRole("button", { name: /^Delete session started/ });
  await expect(trash).toBeVisible();

  // A single click must not delete anything on its own.
  await trash.click();
  await expect(
    page.getByRole("heading", { name: "Delete this session?" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByText("2 of 2 answered")).toBeVisible();

  // Confirming deletes the session, and with it the transcript it owned.
  await trash.click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();

  await expect(page.getByText("No sessions yet")).toBeVisible();
  await expect(page.getByText("2 of 2 answered")).toHaveCount(0);

  // The question bank is a separate thing and must survive.
  await page.getByRole("link", { name: "Questions" }).click();
  await expect(page.getByText("Kept question?")).toBeVisible();
});
