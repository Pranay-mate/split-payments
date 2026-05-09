import { describe, it, expect } from "vitest";
import { parseVoiceTranscript } from "./voice-input";

describe("parseVoiceTranscript", () => {
  describe("trailing digits", () => {
    it("parses 'pizza 600'", () => {
      expect(parseVoiceTranscript("pizza 600")).toEqual({
        description: "pizza",
        amount: 600,
      });
    });

    it("parses 'uber 350'", () => {
      expect(parseVoiceTranscript("uber 350")).toEqual({
        description: "uber",
        amount: 350,
      });
    });

    it("parses 'rent 15000' with no decimal", () => {
      expect(parseVoiceTranscript("rent 15000")).toEqual({
        description: "rent",
        amount: 15000,
      });
    });

    it("parses 'pizza ₹600' with rupee symbol", () => {
      expect(parseVoiceTranscript("pizza ₹600")).toEqual({
        description: "pizza",
        amount: 600,
      });
    });

    it("parses 'rent rs 15000' with rs prefix", () => {
      expect(parseVoiceTranscript("rent rs 15000")).toEqual({
        description: "rent",
        amount: 15000,
      });
    });

    it("parses 'pizza 600 rupees' with trailing rupees", () => {
      expect(parseVoiceTranscript("pizza 600 rupees")).toEqual({
        description: "pizza",
        amount: 600,
      });
    });

    it("parses 'uber 1,200' with comma thousands separator", () => {
      expect(parseVoiceTranscript("uber 1,200")).toEqual({
        description: "uber",
        amount: 1200,
      });
    });

    it("parses 'lunch 250.50' with decimal", () => {
      expect(parseVoiceTranscript("lunch 250.50")).toEqual({
        description: "lunch",
        amount: 250.5,
      });
    });
  });

  describe("word numbers", () => {
    it("parses 'pizza six hundred'", () => {
      expect(parseVoiceTranscript("pizza six hundred")).toEqual({
        description: "pizza",
        amount: 600,
      });
    });

    it("parses 'rent twenty thousand'", () => {
      expect(parseVoiceTranscript("rent twenty thousand")).toEqual({
        description: "rent",
        amount: 20000,
      });
    });

    it("parses 'investment two lakh'", () => {
      expect(parseVoiceTranscript("investment two lakh")).toEqual({
        description: "investment",
        amount: 200000,
      });
    });

    it("parses 'rent two thousand five hundred'", () => {
      expect(parseVoiceTranscript("rent two thousand five hundred")).toEqual({
        description: "rent",
        amount: 2500,
      });
    });

    it("ignores 'and' between number words", () => {
      expect(parseVoiceTranscript("rent two thousand and five hundred")).toEqual(
        {
          description: "rent",
          amount: 2500,
        },
      );
    });

    it("handles trailing 'rupees' word", () => {
      expect(parseVoiceTranscript("pizza six hundred rupees")).toEqual({
        description: "pizza",
        amount: 600,
      });
    });

    it("doesn't misread embedded numerals", () => {
      // "twenty pizzas were ordered" — no trailing-number-word run, so no amount
      const out = parseVoiceTranscript("twenty pizzas were ordered");
      expect(out.amount).toBeUndefined();
      expect(out.description).toBe("twenty pizzas were ordered");
    });
  });

  describe("command-prefix stripping", () => {
    it("strips 'add expense for'", () => {
      expect(parseVoiceTranscript("add expense for pizza 600")).toEqual({
        description: "pizza",
        amount: 600,
      });
    });

    it("strips 'I just spent on'", () => {
      expect(parseVoiceTranscript("I just spent on uber 350")).toEqual({
        description: "uber",
        amount: 350,
      });
    });

    it("strips 'log'", () => {
      expect(parseVoiceTranscript("log rent 15000")).toEqual({
        description: "rent",
        amount: 15000,
      });
    });

    it("strips 'add'", () => {
      expect(parseVoiceTranscript("add pizza 600")).toEqual({
        description: "pizza",
        amount: 600,
      });
    });
  });

  describe("no-amount fallbacks", () => {
    it("returns description only when no number is present", () => {
      expect(parseVoiceTranscript("groceries")).toEqual({
        description: "groceries",
      });
    });

    it("trims trailing punctuation", () => {
      expect(parseVoiceTranscript("groceries.")).toEqual({
        description: "groceries",
      });
    });

    it("returns empty description for empty input", () => {
      expect(parseVoiceTranscript("")).toEqual({ description: "" });
      expect(parseVoiceTranscript("   ")).toEqual({ description: "" });
    });

    it("doesn't return amount=0 for legitimate description-only input", () => {
      const out = parseVoiceTranscript("dinner with the team");
      expect(out.amount).toBeUndefined();
    });
  });
});
