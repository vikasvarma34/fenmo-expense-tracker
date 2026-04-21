import { z } from "zod";

export const listExpensesQuerySchema = z.object({
  category: z
    .string()
    .trim()
    .min(1)
    .optional(),
  sort: z
    .enum(["date_desc", "date_asc", "amount_desc", "amount_asc"])
    .optional(),
});

export const expensePayloadSchema = z.object({
  amount: z.union([z.number(), z.string()]),
  category: z.string().trim().min(1, "Please select a category."),
  description: z.string().trim().optional().default(""),
  date: z
    .string()
    .date("Please enter a valid date.")
    .refine((value) => value <= new Date().toISOString().slice(0, 10), {
      message: "Date cannot be in the future.",
    }),
});

export const createExpenseSchema = expensePayloadSchema.extend({
  idempotencyKey: z.string().trim().min(1, "Request key is required."),
});

export function amountToCents(amount) {
  if (typeof amount === "number") {
    if (!Number.isFinite(amount) || amount <= 0) {
      return null;
    }

    return Math.round(amount * 100);
  }

  if (typeof amount !== "string") {
    return null;
  }

  const normalizedAmount = Number(amount.trim());

  if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
    return null;
  }

  return Math.round(normalizedAmount * 100);
}

export function json(data, init) {
  return Response.json(data, init);
}

export function buildExpenseMutation(payload) {
  return {
    amount_cents: amountToCents(payload.amount),
    category: payload.category,
    description: payload.description || "",
    expense_date: payload.date,
  };
}
