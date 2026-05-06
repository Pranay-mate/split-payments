"use client";

import { useEffect, useReducer, useRef } from "react";
import type { Expense, Person } from "@/lib/calculators/trip-split";

const STORAGE_KEY = "easysplits-trip-v1";

export type TripState = {
  tripName: string;
  people: Person[];
  expenses: Expense[];
};

export type TripAction =
  | { type: "set-trip-name"; name: string }
  | { type: "add-person"; name: string }
  | { type: "remove-person"; id: string }
  | { type: "add-expense"; expense: Omit<Expense, "id"> }
  | { type: "remove-expense"; id: string }
  | { type: "load"; state: TripState }
  | { type: "reset" };

const initial: TripState = {
  tripName: "Goa weekend",
  people: [],
  expenses: [],
};

function genId(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
  }
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

function reducer(state: TripState, action: TripAction): TripState {
  switch (action.type) {
    case "set-trip-name":
      return { ...state, tripName: action.name };

    case "add-person": {
      const trimmed = action.name.trim();
      if (!trimmed) return state;
      const exists = state.people.some(
        (p) => p.name.toLowerCase() === trimmed.toLowerCase(),
      );
      if (exists) return state;
      return {
        ...state,
        people: [...state.people, { id: genId("p"), name: trimmed }],
      };
    }

    case "remove-person": {
      const remainingPeople = state.people.filter((p) => p.id !== action.id);
      const filteredExpenses = state.expenses
        .filter((e) => e.payerId !== action.id)
        .map((e) => ({
          ...e,
          sharerIds: e.sharerIds.filter((s) => s !== action.id),
        }))
        .filter((e) => e.sharerIds.length > 0);
      return {
        ...state,
        people: remainingPeople,
        expenses: filteredExpenses,
      };
    }

    case "add-expense": {
      if (action.expense.amount <= 0) return state;
      if (action.expense.sharerIds.length === 0) return state;
      return {
        ...state,
        expenses: [
          ...state.expenses,
          { id: genId("e"), ...action.expense },
        ],
      };
    }

    case "remove-expense":
      return {
        ...state,
        expenses: state.expenses.filter((e) => e.id !== action.id),
      };

    case "load":
      return action.state;

    case "reset":
      return initial;
  }
}

export function useTripState() {
  const [state, dispatch] = useReducer(reducer, initial);
  const hydratedRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as TripState;
        if (
          parsed &&
          Array.isArray(parsed.people) &&
          Array.isArray(parsed.expenses) &&
          typeof parsed.tripName === "string"
        ) {
          dispatch({ type: "load", state: parsed });
        }
      }
    } catch {
      // Ignore — localStorage may be unavailable or corrupted
    }
    hydratedRef.current = true;
  }, []);

  useEffect(() => {
    if (!hydratedRef.current) return;
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Storage full or disabled — non-fatal
    }
  }, [state]);

  return [state, dispatch] as const;
}
