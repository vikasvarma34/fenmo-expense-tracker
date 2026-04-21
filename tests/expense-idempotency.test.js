import { describe, expect, it } from "vitest";

import { createExpenseWithIdempotency } from "../src/lib/expense-api";

function createDuplicateInsertSupabase(existingExpense) {
  const calls = [];

  const supabase = {
    from(table) {
      calls.push({ type: "from", table });

      return {
        insert(payload) {
          calls.push({ type: "insert", payload });

          return {
            select(columns) {
              calls.push({ type: "select-insert", columns });

              return {
                async single() {
                  return { data: null, error: { code: "23505" } };
                },
              };
            },
          };
        },
        select(columns) {
          calls.push({ type: "select", columns });

          return {
            eq(field, value) {
              calls.push({ type: "eq", field, value });

              return {
                async single() {
                  return { data: existingExpense, error: null };
                },
              };
            },
          };
        },
      };
    },
  };

  return { calls, supabase };
}

describe("expense idempotency", () => {
  it("reuses existing expense for duplicate idempotency key", async () => {
    const idempotencyKey = "fixed-key";
    const existingExpense = { id: "abc-123", idempotency_key: idempotencyKey };
    const { calls, supabase } = createDuplicateInsertSupabase(existingExpense);

    const result = await createExpenseWithIdempotency(
      supabase,
      { amount_cents: 1200, category: "Groceries" },
      idempotencyKey,
    );

    expect(result.status).toBe(200);
    expect(result.expense).toEqual(existingExpense);
    expect(
      calls.some(
        (call) =>
          call.type === "eq" &&
          call.field === "idempotency_key" &&
          call.value === idempotencyKey,
      ),
    ).toBe(true);
  });
});
