import { z } from "zod";

import { createSupabaseServerClient } from "@/lib/supabase/server";

const createExpenseSchema = z.object({
  amount: z.union([z.number(), z.string()]),
  category: z.string().trim().min(1, "Please select a category."),
  description: z.string().trim().optional().default(""),
  date: z
    .string()
    .date("Please enter a valid date.")
    .refine((value) => value <= new Date().toISOString().slice(0, 10), {
      message: "Date cannot be in the future.",
    }),
  idempotencyKey: z.string().trim().min(1, "Request key is required."),
});
const listExpensesQuerySchema = z.object({
  category: z
    .string()
    .trim()
    .min(1)
    .optional(),
  sort: z
    .enum(["date_desc", "date_asc", "amount_desc", "amount_asc"])
    .optional(),
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
        error: "Please choose a valid filter or sort option.",
        details: parsedQuery.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  const supabase = createSupabaseServerClient();
  let expensesQuery = supabase.from("expenses").select("*");

  if (parsedQuery.data.category) {
    expensesQuery = expensesQuery.eq("category", parsedQuery.data.category);
  }

  switch (parsedQuery.data.sort) {
    case "date_asc":
      expensesQuery = expensesQuery
        .order("expense_date", { ascending: true })
        .order("created_at", { ascending: true });
      break;
    case "amount_desc":
      expensesQuery = expensesQuery
        .order("amount_cents", { ascending: false })
        .order("expense_date", { ascending: false })
        .order("created_at", { ascending: false });
      break;
    case "amount_asc":
      expensesQuery = expensesQuery
        .order("amount_cents", { ascending: true })
        .order("expense_date", { ascending: false })
        .order("created_at", { ascending: false });
      break;
    case "date_desc":
    default:
      expensesQuery = expensesQuery
        .order("expense_date", { ascending: false })
        .order("created_at", { ascending: false });
      break;
  }

  const { data: expenses, error } = await expensesQuery;

  if (error) {
    return json(
      { error: "Could not load expenses right now. Please try again." },
      { status: 500 },
    );
  }

  return json({ expenses: expenses ?? [] });
}

export async function POST(request) {
  let payload;

  try {
    payload = await request.json();
  } catch {
    return json({ error: "Request body is invalid." }, { status: 400 });
  }

  const parsedPayload = createExpenseSchema.safeParse(payload);

  if (!parsedPayload.success) {
    return json(
      {
        error: "Please review the form fields and try again.",
        details: parsedPayload.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  const amountCents = amountToCents(parsedPayload.data.amount);

  if (!amountCents || amountCents <= 0) {
    return json(
      {
        error: "Amount must be greater than zero.",
      },
      { status: 400 },
    );
  }

  const supabase = createSupabaseServerClient();
  const expenseToInsert = {
    amount_cents: amountCents,
    category: parsedPayload.data.category,
    description: parsedPayload.data.description || "",
    expense_date: parsedPayload.data.date,
    idempotency_key: parsedPayload.data.idempotencyKey,
  };

  const { data: createdExpense, error: insertError } = await supabase
    .from("expenses")
    .insert(expenseToInsert)
    .select("*")
    .single();

  if (!insertError) {
    return json({ expense: createdExpense }, { status: 201 });
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
          error:
            "This expense was already submitted, but we could not fetch the saved record.",
        },
        { status: 500 },
      );
    }

    return json({ expense: existingExpense }, { status: 200 });
  }

  return json(
    { error: "Could not save the expense right now. Please try again." },
    { status: 500 },
  );
}
