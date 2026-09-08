import { expect, test } from "@playwright/test";
import { resetDatabase, seedPractice } from "./support/db";

test("the dashboard invites a first session rather than charting a blank year", async ({
  page,
}) => {
  await resetDatabase();
  await page.goto("/");

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
  await page.goto("/");

  // Located by the term rather than by its text: "Days practised" also
  // appears in the heatmap table's caption.
  const stat = (label: string) =>
    page.getByRole("term").filter({ hasText: label }).locator("..");

  await expect(stat("Current streak")).toContainText("3 days");
  await expect(stat("Longest streak")).toContainText("4 days");
  await expect(stat("Days practised")).toContainText("7 days");
});

/**
 * The square is the unit, not the sitting: two sessions in an afternoon fill
 * one square, and it is filled the same as a day that held one.
 *
 * The tooltip names the date and stops there — see the comment on `Cell` in
 * `streak-heatmap.tsx`. This spec used to expect a count of answers in it,
 * which `57d048e` deliberately removed; what is left to prove is that a day is
 * one square however often it was sat, and that only the days practised are
 * read out.
 */
test("twice in a day is one square, and only practised days are named", async ({
  page,
}) => {
  await resetDatabase();
  // Two sessions today, one yesterday, nothing the day before.
  await seedPractice([0, 0, 1]);
  await page.goto("/");

  // Formatted in the page, so these are the labels the component itself would
  // build: it formats in the browser's locale, which is not this process's.
  const label = (daysAgo: number) =>
    page.evaluate((offset) => {
      const now = new Date();
      const day = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() - offset,
      );
      return new Intl.DateTimeFormat(undefined, {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
      }).format(day);
    }, daysAgo);

  const [todayLabel, yesterdayLabel, dayBeforeLabel] = await Promise.all([
    label(0),
    label(1),
    label(2),
  ]);

  const square = (text: string) => page.getByTitle(text, { exact: true });
  const today = square(todayLabel);
  const yesterday = square(yesterdayLabel);
  const dayBefore = square(dayBeforeLabel);

  // Two sittings, one square. Every day in the window has exactly one.
  await expect(today).toHaveCount(1);
  await expect(yesterday).toHaveCount(1);
  await expect(dayBefore).toHaveCount(1);

  // Nothing in a tooltip counts sittings or answers.
  await expect(page.getByTitle(/answers?|sessions?/)).toHaveCount(0);

  // Only a practised day is read out. Scoped to the squares: the table's
  // caption names the window's last day too, which is today.
  const announced = (text: string) =>
    page.locator("td span").filter({ hasText: text });
  await expect(announced(todayLabel)).toHaveCount(1);
  await expect(announced(yesterdayLabel)).toHaveCount(1);
  await expect(announced(dayBeforeLabel)).toHaveCount(0);

  // A square is filled or it is empty, and both are the same ink: a coloured
  // heatmap would break the rule the whole palette is built on. Asserted
  // rather than left to the eye.
  const fill = (locator: typeof today) =>
    locator.evaluate((node) => getComputedStyle(node).backgroundColor);
  const practised = await fill(today);
  const unpractised = await fill(dayBefore);
  expect(practised).not.toBe(unpractised);
  // Once or twice in a day, the square is the same: the map does not grade it.
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
