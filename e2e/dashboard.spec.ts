import { expect, test } from "@playwright/test";
import { resetDatabase, seedPractice } from "./support/db";

test("the dashboard invites a first session rather than charting a blank year", async ({
  page,
}) => {
  await resetDatabase();
  await page.goto("/dashboard");

  await expect(page.getByText("No practice to chart yet")).toBeVisible();
  await expect(page.getByText("Nothing practised yet")).toBeVisible();
  // Nothing claiming a streak, and no grid of empty squares.
  await expect(
    page.getByRole("term").filter({ hasText: "Current streak" }),
  ).toHaveCount(0);
  await expect(page.getByRole("table")).toHaveCount(0);
});

test("a run of days reads as a current streak, and a gap ends the last one", async ({
  page,
}) => {
  await resetDatabase();
  // Today, yesterday and the day before — then a fortnight-old pair that ran
  // longer, so the current and longest runs are different numbers.
  await seedPractice([0, 1, 2, 14, 15, 16, 17]);
  await page.goto("/dashboard");

  // Located by the term rather than by its text: "Days practised" also
  // appears in the header's eyebrow and in the table's caption.
  const stat = (label: string) =>
    page.getByRole("term").filter({ hasText: label }).locator("..");

  await expect(stat("Current streak")).toContainText("3 days");
  await expect(stat("Longest streak")).toContainText("4 days");
  await expect(stat("Days practised")).toContainText("7 days");
  await expect(page.getByText("7 days practised")).toBeVisible();
});

test("a day names its own sessions, and two sittings read darker than one", async ({
  page,
}) => {
  await resetDatabase();
  // Two sessions today, one yesterday.
  await seedPractice([0, 0, 1]);
  await page.goto("/dashboard");

  const today = page.getByTitle(/^2 sessions, 4 answers on /);
  const yesterday = page.getByTitle(/^1 session, 2 answers on /);
  await expect(today).toBeVisible();
  await expect(yesterday).toBeVisible();

  // The ramp is one ink at four densities, so a busier day is a darker square
  // and never a different hue. Asserted rather than left to the eye, because
  // a coloured heatmap would break the rule the whole palette is built on.
  const fill = (locator: typeof today) =>
    locator.evaluate((node) => getComputedStyle(node).backgroundColor);
  const busy = await fill(today);
  const quiet = await fill(yesterday);
  expect(busy).not.toBe(quiet);
  for (const colour of [busy, quiet]) {
    expect(colour).toMatch(/^(?:oklab|color|rgba?)\(/);
    expect(greyscale(colour)).toBe(true);
  }
});

/**
 * Whether a computed colour carries any hue. `oklab(l a b / alpha)` is grey
 * when a and b are zero; an `rgb()` fallback is grey when its channels match.
 */
function greyscale(colour: string): boolean {
  const numbers = [...colour.matchAll(/-?\d*\.?\d+/g)].map((match) =>
    Number(match[0]),
  );
  if (colour.startsWith("oklab")) {
    return numbers[1] === 0 && numbers[2] === 0;
  }
  return numbers[0] === numbers[1] && numbers[1] === numbers[2];
}
