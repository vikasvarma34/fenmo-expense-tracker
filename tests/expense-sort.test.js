import { describe, expect, it } from "vitest";

import { applySortToExpensesQuery } from "../src/lib/expense-api";

function createQueryRecorder() {
  const calls = [];
  const query = {
    order(field, options) {
      calls.push({ type: "order", field, options });
      return query;
    },
  };

  return { calls, query };
}

describe("expense sort query", () => {
  it("applies newest-first date sorting by default", () => {
    const { calls, query } = createQueryRecorder();

    applySortToExpensesQuery(query, "date_desc");

    expect(calls).toEqual([
      { type: "order", field: "expense_date", options: { ascending: false } },
      { type: "order", field: "created_at", options: { ascending: false } },
    ]);
  });
});
