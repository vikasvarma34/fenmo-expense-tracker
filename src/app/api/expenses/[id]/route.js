import { z } from "zod";

import {
  amountToCents,
  buildExpenseMutation,
  expensePayloadSchema,
  json,
} from "@/lib/expense-api";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const expenseIdSchema = z.string().uuid("Expense id is invalid.");

async function resolveExpenseId(params) {
  const resolvedParams = await params;
  const parsedExpenseId = expenseIdSchema.safeParse(resolvedParams.id);

  if (!parsedExpenseId.success) {
    return {
      error: json({ error: "Expense not found." }, { status: 404 }),
    };
  }

  return {
    expenseId: parsedExpenseId.data,
  };
}

export async function PATCH(request, { params }) {
  const { expenseId, error: idError } = await resolveExpenseId(params);

  if (idError) {
    return idError;
  }

  let payload;

  try {
    payload = await request.json();
  } catch {
    return json({ error: "Request body is invalid." }, { status: 400 });
  }

  const parsedPayload = expensePayloadSchema.safeParse(payload);

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
        error: "Please enter a valid amount greater than zero.",
      },
      { status: 400 },
    );
  }

  const supabase = createSupabaseServerClient();
  const { data: updatedExpense, error: updateError } = await supabase
    .from("expenses")
    .update(buildExpenseMutation(parsedPayload.data))
    .eq("id", expenseId)
    .select("*")
    .maybeSingle();

  if (updateError) {
    return json(
      { error: "Could not update the expense right now. Please try again." },
      { status: 500 },
    );
  }

  if (!updatedExpense) {
    return json({ error: "Expense not found." }, { status: 404 });
  }

  return json({ expense: updatedExpense });
}

export async function DELETE(_request, { params }) {
  const { expenseId, error: idError } = await resolveExpenseId(params);

  if (idError) {
    return idError;
  }

  const supabase = createSupabaseServerClient();
  const { data: existingExpense, error: fetchError } = await supabase
    .from("expenses")
    .select("id")
    .eq("id", expenseId)
    .maybeSingle();

  if (fetchError) {
    return json(
      { error: "Could not delete the expense right now. Please try again." },
      { status: 500 },
    );
  }

  if (!existingExpense) {
    return json({ error: "Expense not found." }, { status: 404 });
  }

  const { error: deleteError } = await supabase
    .from("expenses")
    .delete()
    .eq("id", expenseId);

  if (deleteError) {
    return json(
      { error: "Could not delete the expense right now. Please try again." },
      { status: 500 },
    );
  }

  return json({ success: true });
}
