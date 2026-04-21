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

export function applyCategoryFilterToExpensesQuery(expensesQuery, category) {
  if (!category) {
    return expensesQuery;
  }

  return expensesQuery.eq("category", category);
}

export function applySortToExpensesQuery(expensesQuery, sort = "date_desc") {
  switch (sort) {
    case "date_asc":
      return expensesQuery
        .order("expense_date", { ascending: true })
        .order("created_at", { ascending: true });
    case "amount_desc":
      return expensesQuery
        .order("amount_cents", { ascending: false })
        .order("expense_date", { ascending: false })
        .order("created_at", { ascending: false });
    case "amount_asc":
      return expensesQuery
        .order("amount_cents", { ascending: true })
        .order("expense_date", { ascending: false })
        .order("created_at", { ascending: false });
    case "date_desc":
    default:
      return expensesQuery
        .order("expense_date", { ascending: false })
        .order("created_at", { ascending: false });
  }
}

export async function createExpenseWithIdempotency(
  supabase,
  expenseToInsert,
  idempotencyKey,
) {
  const { data: createdExpense, error: insertError } = await supabase
    .from("expenses")
    .insert(expenseToInsert)
    .select("*")
    .single();

  if (!insertError) {
    return { expense: createdExpense, status: 201 };
  }

  if (insertError.code === "23505") {
    const { data: existingExpense, error: existingExpenseError } = await supabase
      .from("expenses")
      .select("*")
      .eq("idempotency_key", idempotencyKey)
      .single();

    if (existingExpenseError || !existingExpense) {
      return {
        error:
          "This expense was already submitted, but we could not fetch the saved record.",
        status: 500,
      };
    }

    return { expense: existingExpense, status: 200 };
  }

  return {
    error: "Could not save the expense right now. Please try again.",
    status: 500,
  };
}
