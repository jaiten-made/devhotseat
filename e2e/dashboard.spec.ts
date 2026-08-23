import { expect, test } from "@playwright/test";
import { resetDatabase, seedPractice } from "./support/db";

test("the dashboard invites a first session rather than charting a blank year", async ({
  page,
}) => {
  await resetDatabase();
  await page.goto("/dashboard");

  await expect(page.getByText("No practice to chart yet")).toBeVisible();
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
});

test("a day names what was answered on it, however many sittings that took", async ({
  page,
}) => {
  await resetDatabase();
  // Two sessions today, one yesterday, nothing the day before.
  await seedPractice([0, 0, 1]);
  await page.goto("/dashboard");

  // Twice in a day is one square, and it counts the answers rather than the
  // sittings: sitting down is what the map records, not how often.
  const today = page.getByTitle(/^4 answers on /);
  const yesterday = page.getByTitle(/^2 answers on /);
  await expect(today).toBeVisible();
  await expect(yesterday).toBeVisible();
  await expect(page.getByTitle(/session/)).toHaveCount(0);

  // A square is filled or it is empty, and both are the same ink: a coloured
  // heatmap would break the rule the whole palette is built on. Asserted
  // rather than left to the eye.
  const fill = (locator: typeof today) =>
    locator.evaluate((node) => getComputedStyle(node).backgroundColor);
  const practised = await fill(today);
  const unpractised = await fill(page.getByTitle(/^No practice on /).first());
  expect(practised).not.toBe(unpractised);
  expect(await fill(yesterday)).toBe(practised);
  for (const colour of [practised, unpractised]) {
    expect(colour).toMatch(/^(?:oklab|oklch|color|rgba?)\(/);
    expect(greyscale(colour)).toBe(true);
  }
});

/**
 * Whether a computed colour carries any hue. Chrome reports a token with an
 * alpha as `oklab(l a b / alpha)` and one without as the `oklch(l c h)` it was
 * written in, so both spellings turn up in the same grid: the first is grey
 * when a and b are zero, the second when its chroma is. An `rgb()` fallback is
 * grey when its channels match.
 */
function greyscale(colour: string): boolean {
  const numbers = [...colour.matchAll(/-?\d*\.?\d+/g)].map((match) =>
    Number(match[0]),
  );
  if (colour.startsWith("oklab")) {
    return numbers[1] === 0 && numbers[2] === 0;
  }
  if (colour.startsWith("oklch")) {
    return numbers[1] === 0;
  }
  return numbers[0] === numbers[1] && numbers[1] === numbers[2];
}
