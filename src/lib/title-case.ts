/**
 * The short joining words a headline leaves in lower case: articles,
 * conjunctions and prepositions. Length is not the test — "over" stays down
 * and "is" goes up — so this is a list rather than a rule about characters.
 */
const SMALL_WORDS = new Set([
  "a",
  "an",
  "and",
  "as",
  "at",
  "but",
  "by",
  "for",
  "from",
  "if",
  "in",
  "into",
  "nor",
  "of",
  "off",
  "on",
  "onto",
  "or",
  "over",
  "per",
  "so",
  "the",
  "to",
  "up",
  "via",
  "vs",
  "with",
  "yet",
]);

/**
 * Headline capitalisation for a title.
 *
 * The rule is the newspaper one: capitalise every word except the small
 * joining ones, and capitalise those too when they open or close the title or
 * start a clause after a colon. "Everything you said" becomes "Everything You
 * Said"; "the end of the interview" becomes "The End of the Interview".
 *
 * Two things are deliberately left alone. A word already carrying an uppercase
 * letter is passed through untouched, so "AI", "STAR" and "iOS" survive rather
 * than being flattened to "Ai", "Star" and "IOs" — the author capitalised it
 * on purpose. And the spacing is preserved exactly, because the split keeps
 * its separators.
 *
 * This is a function rather than a `capitalize` class because CSS has no
 * notion of a small word: it would give "Everything You Said" but also "The
 * End Of The Interview", which reads as a shout.
 */
export function titleCase(title: string): string {
  // The capture group keeps the whitespace in the array, so the join puts the
  // original spacing back rather than collapsing it.
  const tokens = title.split(/(\s+)/);
  const words = tokens.flatMap((token, index) =>
    token.trim() === "" ? [] : [index],
  );
  const first = words[0];
  const last = words[words.length - 1];

  // A title can carry a subtitle — "Sessions: the ones you finished" — and the
  // word after the colon opens it, so it is capitalised like a first word.
  let opensClause = false;

  return tokens
    .map((token, index) => {
      if (token.trim() === "") return token;
      const forced = opensClause || index === first || index === last;
      opensClause = /[:.?!—]$/.test(token);
      return castWord(token, forced);
    })
    .join("");
}

/**
 * A hyphenated or slashed compound is several words wearing one token, so each
 * side is cast on its own: "follow-up" keeps its small second half, while
 * "read/write" gets both. Only the opening side can inherit the first-or-last
 * exemption — the rest are judged on their own merit.
 */
function castWord(word: string, forced: boolean): string {
  return word
    .split(/([-/])/)
    .map((part, index) =>
      index % 2 === 1 ? part : castPart(part, forced && index === 0),
    )
    .join("");
}

function castPart(part: string, forced: boolean): string {
  if (part === "") return part;
  if (/\p{Lu}/u.test(part)) return part;
  if (!forced && SMALL_WORDS.has(part.replace(/[^\p{L}\p{N}]/gu, ""))) {
    return part;
  }
  // Replacing the first letter rather than the first character means an opening
  // quote or bracket does not swallow the capital.
  return part.replace(/\p{L}/u, (letter) => letter.toUpperCase());
}
