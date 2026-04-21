import { z } from "zod";

import {
  DEFAULT_CURRENCY_CODE,
  SUPPORTED_CURRENCIES,
} from "@/lib/expense-options";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const supportedCurrencyCodes = SUPPORTED_CURRENCIES.map(
  (currency) => currency.code,
);

const createExpenseSchema = z.object({
  amount: z.union([z.number(), z.string()]),
  currencyCode: z
    .string()
    .trim()
    .toUpperCase()
    .refine(
      (currencyCode) => supportedCurrencyCodes.includes(currencyCode),
      "Currency is not supported.",
    ),
  category: z.string().trim().min(1, "Category is required."),
  description: z.string().trim().min(1, "Description is required."),
  date: z.string().date("Date must be a valid ISO date."),
  idempotencyKey: z.string().trim().min(1, "Idempotency key is required."),
});
const listExpensesQuerySchema = z.object({
  category: z
    .string()
    .trim()
    .min(1)
    .optional(),
  sort: z.enum(["date_desc"]).optional(),
});

function amountToCents(amount) {
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

function json(data, init) {
  return Response.json(data, init);
}

function normalizeExpense(expense) {
  return {
    ...expense,
    currency_code: expense.currency_code || DEFAULT_CURRENCY_CODE,
  };
}

export async function GET(request) {
  const url = new URL(request.url);
  const query = {
    category: url.searchParams.get("category") || undefined,
    sort: url.searchParams.get("sort") || undefined,
  };
  const parsedQuery = listExpensesQuerySchema.safeParse(query);

  if (!parsedQuery.success) {
    return json(
      {
        error: "Invalid expense query.",
        details: parsedQuery.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  const supabase = createSupabaseServerClient();
  let expensesQuery = supabase
    .from("expenses")
    .select("*")
    .order("expense_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (parsedQuery.data.category) {
    expensesQuery = expensesQuery.eq("category", parsedQuery.data.category);
  }

  const { data: expenses, error } = await expensesQuery;

  if (error) {
    return json({ error: "Failed to load expenses." }, { status: 500 });
  }

  return json({ expenses: (expenses ?? []).map(normalizeExpense) });
}

export async function POST(request) {
  let payload;

  try {
    payload = await request.json();
  } catch {
    return json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const parsedPayload = createExpenseSchema.safeParse(payload);

  if (!parsedPayload.success) {
    return json(
      {
        error: "Invalid expense payload.",
        details: parsedPayload.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  const amountCents = amountToCents(parsedPayload.data.amount);

  if (!amountCents || amountCents <= 0) {
    return json(
      {
        error: "Amount must be a positive number.",
      },
      { status: 400 },
    );
  }

  const supabase = createSupabaseServerClient();
  const expenseToInsert = {
    amount_cents: amountCents,
    currency_code: parsedPayload.data.currencyCode,
    category: parsedPayload.data.category,
    description: parsedPayload.data.description,
    expense_date: parsedPayload.data.date,
    idempotency_key: parsedPayload.data.idempotencyKey,
  };

  const { data: createdExpense, error: insertError } = await supabase
    .from("expenses")
    .insert(expenseToInsert)
    .select("*")
    .single();

  if (!insertError) {
    return json({ expense: normalizeExpense(createdExpense) }, { status: 201 });
  }

  if (insertError.code === "42703" || insertError.code === "PGRST204") {
    return json(
      {
        error:
          "The database is missing the currency_code column. Run db/2026-04-21-add-currency-code.sql and try again.",
      },
      { status: 500 },
    );
  }

  if (insertError.code === "23505") {
    const { data: existingExpense, error: existingExpenseError } = await supabase
      .from("expenses")
      .select("*")
      .eq("idempotency_key", parsedPayload.data.idempotencyKey)
      .single();

    if (existingExpenseError || !existingExpense) {
      return json(
        {
          error: "Expense already exists, but the saved record could not be loaded.",
        },
        { status: 500 },
      );
    }

    return json({ expense: normalizeExpense(existingExpense) }, { status: 200 });
  }

  return json({ error: "Failed to create expense." }, { status: 500 });
}
