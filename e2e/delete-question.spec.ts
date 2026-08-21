import { expect, test } from "@playwright/test";
import { resetDatabase } from "./support/db";

test("deleting a question asks first, and cancelling keeps it", async ({
  page,
}) => {
  await resetDatabase();
  await page.goto("/");

  await page.getByLabel("New question").fill("Doomed question?");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByText("Doomed question?")).toBeVisible();

  // A single click must not delete anything on its own.
  await page
    .getByRole("button", { name: "Delete question: Doomed question?" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Delete this question?" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByText("Doomed question?")).toBeVisible();

  // Confirming does delete it.
  await page
    .getByRole("button", { name: "Delete question: Doomed question?" })
    .click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();

  await expect(page.getByText("Doomed question?")).toBeHidden();
  await expect(page.getByText("No questions yet")).toBeVisible();
});
