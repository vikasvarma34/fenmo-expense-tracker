alter table public.expenses
add column if not exists currency_code text not null default 'USD';

create index if not exists expenses_currency_code_idx
  on public.expenses (currency_code);
