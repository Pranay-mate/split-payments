/**
 * Voice-input helpers for the AddExpense form. Pure functions — the
 * SpeechRecognition lifecycle lives in the React hook
 * `src/lib/use-voice-input.ts`.
 *
 * Goal: take a natural-language utterance like "pizza six hundred" or
 * "uber 350" and split it into a description + numeric amount the form
 * can pre-fill. Best-effort; falls back to "just description" if no
 * amount pattern is recognised.
 */

export type VoiceParseResult = {
  description: string;
  amount?: number;
};

const WORD_NUMBERS: Record<string, number> = {
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
  hundred: 100,
  thousand: 1000,
  lakh: 100000,
  lakhs: 100000,
  lac: 100000,
  lacs: 100000,
};

const MULTIPLIERS = new Set([100, 1000, 100000]);

/**
 * Parse a sequence of number words into a single integer.
 * Examples:
 *   ["six", "hundred"]            → 600
 *   ["twenty", "thousand"]        → 20000
 *   ["two", "lakh"]               → 200000
 *   ["one", "thousand", "five", "hundred"] → 1500
 * Returns null if any token isn't recognised.
 */
function parseWordNumber(words: string[]): number | null {
  let total = 0;
  let current = 0;
  for (const w of words) {
    const v = WORD_NUMBERS[w];
    if (v === undefined) {
      if (w === "and" || w === "rupees" || w === "rupee" || w === "rs") continue;
      return null;
    }
    if (MULTIPLIERS.has(v)) {
      current = (current || 1) * v;
      // For thousands and lakhs we lock in the running sum so 'two thousand
      // five hundred' resolves correctly.
      if (v >= 1000) {
        total += current;
        current = 0;
      }
    } else {
      current += v;
    }
  }
  total += current;
  return total > 0 ? total : null;
}

/**
 * Strip a known leading filler ("add expense", "log", "I spent", etc.) so
 * the description is the actual subject of the transaction. Cheap heuristic
 * — regex over the very front of the string only.
 */
function stripCommandPrefix(text: string): string {
  return text.replace(
    /^(add\s+expense\s+for\s+|add\s+expense\s+|add\s+|log\s+|i\s+(?:just\s+)?spent\s+(?:on\s+)?|new\s+expense\s+(?:for\s+)?)/i,
    "",
  );
}

/**
 * Best-effort parse of a voice transcript into a description + amount.
 * The user can always edit the form fields after this fires.
 */
export function parseVoiceTranscript(transcript: string): VoiceParseResult {
  const cleaned = stripCommandPrefix(transcript.trim().replace(/[.!?,;]+$/u, ""));
  if (!cleaned) return { description: "" };

  // 1. Trailing digits with optional currency tokens.
  //    Matches: "pizza 600", "pizza ₹600", "pizza 600 rupees", "rent rs 15000"
  //    The optional currency prefix must be followed by whitespace before
  //    digits — otherwise "rent rs 15000" gets parsed with "rs" as part of
  //    the description.
  const digitMatch = cleaned.match(
    /^(.+?)\s+(?:(?:rs\.?|inr|rupees?)\s+|₹\s*)?(\d{1,3}(?:[,\s]\d{3})*|\d+)(?:\.(\d+))?\s*(?:rupees?|rs\.?|inr|₹)?$/i,
  );
  if (digitMatch) {
    const desc = digitMatch[1].trim();
    const intPart = digitMatch[2].replace(/[,\s]/g, "");
    const decPart = digitMatch[3] ?? "";
    const num = Number(decPart ? `${intPart}.${decPart}` : intPart);
    if (Number.isFinite(num) && num > 0 && desc.length > 0) {
      return { description: desc, amount: num };
    }
  }

  // 2. Word numbers — find where the trailing run of number-words begins.
  //    Only accept if the run reaches the end of the utterance, otherwise
  //    we'd misread "twenty pizzas were ordered" as having an amount.
  const words = cleaned.toLowerCase().split(/\s+/);
  let wordStart = -1;
  for (let i = 0; i < words.length; i++) {
    const v = WORD_NUMBERS[words[i]];
    if (v !== undefined) {
      // Need this run to extend to the end (modulo trailing rupees/and).
      const tail = words.slice(i);
      const allKnown = tail.every(
        (w) =>
          WORD_NUMBERS[w] !== undefined ||
          w === "and" ||
          w === "rupees" ||
          w === "rupee" ||
          w === "rs",
      );
      if (allKnown) {
        wordStart = i;
        break;
      }
    }
  }
  if (wordStart > 0) {
    const desc = words.slice(0, wordStart).join(" ");
    const num = parseWordNumber(words.slice(wordStart));
    if (num !== null && num > 0) {
      return { description: desc, amount: num };
    }
  }

  return { description: cleaned };
}
