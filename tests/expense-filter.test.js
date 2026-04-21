import { describe, expect, it } from "vitest";

import { applyCategoryFilterToExpensesQuery } from "../src/lib/expense-api";

function createQueryRecorder() {
  const calls = [];
  const query = {
    eq(field, value) {
      calls.push({ type: "eq", field, value });
      return query;
    },
  };

  return { calls, query };
}

describe("expense filter query", () => {
  it("applies category filter when category is provided", () => {
    const { calls, query } = createQueryRecorder();

    applyCategoryFilterToExpensesQuery(query, "Entertainment");

    expect(calls).toEqual([
      { type: "eq", field: "category", value: "Entertainment" },
    ]);
  });
});
