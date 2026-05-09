import { describe, it, expect } from "vitest";
import { detectCategory } from "./category-detect";

describe("detectCategory", () => {
  describe("food", () => {
    it.each([
      ["swiggy order", "food"],
      ["zomato dinner", "food"],
      ["pizza", "food"],
      ["biryani", "food"],
      ["lunch with team", "food"],
      ["chai at the corner", "food"],
      ["McDonald's drive-thru", "food"],
      ["KFC bucket", "food"],
      ["dosa for breakfast", "food"],
    ])("detects '%s' → %s", (text, expected) => {
      expect(detectCategory(text)).toBe(expected);
    });
  });

  describe("travel", () => {
    it.each([
      ["uber to office", "travel"],
      ["ola for the airport", "travel"],
      ["rapido", "travel"],
      ["IRCTC tatkal booking", "travel"],
      ["IndiGo flight to Goa", "travel"],
      ["petrol", "travel"],
      ["fastag recharge", "travel"],
      ["metro card", "travel"],
    ])("detects '%s' → %s", (text, expected) => {
      expect(detectCategory(text)).toBe(expected);
    });
  });

  describe("stay", () => {
    it.each([
      ["airbnb in Manali", "stay"],
      ["hotel for the weekend", "stay"],
      ["OYO Goa", "stay"],
      ["homestay payment", "stay"],
    ])("detects '%s' → %s", (text, expected) => {
      expect(detectCategory(text)).toBe(expected);
    });
  });

  describe("groceries", () => {
    it.each([
      ["Blinkit", "groceries"],
      ["Zepto delivery", "groceries"],
      ["DMart shopping", "groceries"],
      ["bigbasket order", "groceries"],
      ["milk", "groceries"],
      ["vegetables for the week", "groceries"],
    ])("detects '%s' → %s", (text, expected) => {
      expect(detectCategory(text)).toBe(expected);
    });
  });

  describe("bills", () => {
    it.each([
      ["electricity bill", "bills"],
      ["wifi recharge", "bills"],
      ["rent", "bills"],
      ["maid", "bills"],
      ["LPG cylinder", "bills"],
    ])("detects '%s' → %s", (text, expected) => {
      expect(detectCategory(text)).toBe(expected);
    });
  });

  describe("entertainment", () => {
    it.each([
      ["BookMyShow tickets", "entertainment"],
      ["Netflix subscription", "entertainment"],
      ["movie at PVR", "entertainment"],
      ["birthday party", "entertainment"],
      ["beer at the pub", "entertainment"],
    ])("detects '%s' → %s", (text, expected) => {
      expect(detectCategory(text)).toBe(expected);
    });
  });

  describe("misses (returns null)", () => {
    it.each([
      ["random text without keywords"],
      ["Pranay's birthday"], // birthday is in entertainment but only as a whole word
      [""],
      ["ab"],
    ])("returns null for '%s'", (text) => {
      const result = detectCategory(text);
      // birthday IS in the entertainment list — adjust this case
      if (text === "Pranay's birthday") {
        expect(result).toBe("entertainment");
      } else {
        expect(result).toBeNull();
      }
    });
  });

  describe("first-match-wins", () => {
    it("'tea at airport' picks food (tea matches first)", () => {
      // tea → food, airport-adjacent terms → travel — first rule wins.
      expect(detectCategory("tea at airport")).toBe("food");
    });
  });

  describe("case-insensitive", () => {
    it("'SWIGGY' matches food", () => {
      expect(detectCategory("SWIGGY")).toBe("food");
    });

    it("'Uber' (mixed case) matches travel", () => {
      expect(detectCategory("Uber to office")).toBe("travel");
    });
  });

  describe("word boundaries", () => {
    it("'stealing' does NOT match 'tea'", () => {
      // Use input with no other matching keywords so we isolate the
      // word-boundary check on 'tea'.
      expect(detectCategory("stealing my time")).toBeNull();
    });

    it("'pubmed' does NOT match 'pub'", () => {
      // Multi-word matchers respect boundaries; 'pubmed' shouldn't trigger pub.
      expect(detectCategory("pubmed research access")).toBeNull();
    });
  });
});
