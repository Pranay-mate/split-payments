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

const ENGLISH_NUMBERS: Record<string, number> = {
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

/**
 * Hindi + Marathi numerals (romanised). Single-token lookups so the
 * parser can recognise utterances like "tees rupay" → 30. Includes
 * common Marathi-specific variants (saha=6, daha=10, vees=20,
 * pannas=50, ainshi=80, navvad=90, shambhar=100). Compound numerals
 * (24=chaubees etc.) are listed individually rather than decomposed —
 * Hindi/Marathi don't have an "X+Y" surface form like English's
 * "twenty four".
 */
const HINDI_NUMBERS: Record<string, number> = {
  // 1-9
  ek: 1,
  do: 2,
  teen: 3,
  tin: 3,
  char: 4,
  chaar: 4,
  paanch: 5,
  panch: 5,
  paach: 5,
  chhe: 6,
  che: 6,
  chha: 6,
  saha: 6, // mr
  saat: 7,
  aath: 8,
  nau: 9,
  nav: 9,
  // 10-19
  das: 10,
  dus: 10,
  daha: 10, // mr
  gyarah: 11,
  egyarah: 11,
  akra: 11,
  barah: 12,
  bara: 12,
  terah: 13,
  tera: 13,
  chaudah: 14,
  chauda: 14,
  pandrah: 15,
  pandra: 15,
  solah: 16,
  sola: 16,
  satrah: 17,
  satra: 17,
  atharah: 18,
  athara: 18,
  athra: 18,
  unnees: 19,
  unees: 19,
  // 20-29
  bees: 20,
  vees: 20, // mr
  ikkees: 21,
  ekkees: 21,
  baees: 22,
  baais: 22,
  teyees: 23,
  teis: 23,
  taees: 23,
  chaubees: 24,
  pachees: 25,
  pachis: 25,
  chhabbees: 26,
  sattaees: 27,
  satais: 27,
  atthaees: 28,
  untees: 29,
  // 30s
  tees: 30,
  tris: 30, // mr
  ikatees: 31,
  battees: 32,
  battis: 32,
  taittees: 33,
  chautees: 34,
  paintees: 35,
  chhattees: 36,
  chhattis: 36,
  saintees: 37,
  athtees: 38,
  adhtees: 38,
  untalees: 39,
  // 40s
  chalees: 40,
  chalis: 40,
  chaalis: 40,
  iktalees: 41,
  bayalees: 42,
  tetalees: 43,
  chavalees: 44,
  paintalees: 45,
  chhayalees: 46,
  saitalees: 47,
  athalees: 48,
  unchaas: 49,
  // 50s
  pachaas: 50,
  pachas: 50,
  pannas: 50, // mr
  pannaas: 50, // mr
  ikyaavan: 51,
  baavan: 52,
  trepan: 53,
  chauvan: 54,
  pachpan: 55,
  chhappan: 56,
  sattavan: 57,
  atthaavan: 58,
  unsath: 59,
  // 60s
  saath: 60,
  iksath: 61,
  baasath: 62,
  tirsath: 63,
  chausath: 64,
  paisath: 65,
  chhiyaasath: 66,
  sadsath: 67,
  satsath: 67,
  adhsath: 68,
  unhattar: 69,
  // 70s
  sattar: 70,
  ikhattar: 71,
  bahattar: 72,
  tihattar: 73,
  chauhattar: 74,
  pachhattar: 75,
  chhihattar: 76,
  sathattar: 77,
  athhattar: 78,
  unaasi: 79,
  // 80s
  assi: 80,
  ainshi: 80, // mr
  ikaasi: 81,
  bayaasi: 82,
  tiraasi: 83,
  chauraasi: 84,
  pachaasi: 85,
  chhiyaasi: 86,
  sataasi: 87,
  athaasi: 88,
  navaasi: 89,
  // 90s
  nabbe: 90,
  nabe: 90,
  navvad: 90, // mr
  ikyaanve: 91,
  baanave: 92,
  tiraanve: 93,
  chauraanve: 94,
  pachaanve: 95,
  chhiyaanve: 96,
  sataanve: 97,
  athaanve: 98,
  ninyaanve: 99,
  // Multipliers
  sau: 100,
  shambhar: 100, // mr
  hazaar: 1000,
  hazar: 1000,
};

const WORD_NUMBERS: Record<string, number> = {
  ...ENGLISH_NUMBERS,
  ...HINDI_NUMBERS,
};

const MULTIPLIERS = new Set([100, 1000, 100000]);

/** Filler words harmlessly stripped during number-token runs. Hindi/
 *  Marathi additions (rupay, rupaye, rupaya, ka, ki, ke) so utterances
 *  like "tees rupay" or "pachas ka" parse cleanly. */
const NUMBER_FILLERS = new Set([
  "and",
  "rupees",
  "rupee",
  "rs",
  "rupay",
  "rupaye",
  "rupaya",
  "paisa",
  "paise",
  "ka",
  "ki",
  "ke",
]);

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
      if (NUMBER_FILLERS.has(w)) continue;
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
        (w) => WORD_NUMBERS[w] !== undefined || NUMBER_FILLERS.has(w),
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
