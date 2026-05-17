
create table if not exists public.portfolios (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  portfolio_name text not null,
  age int,
  capital numeric default 0,
  monthly numeric default 0,
  goal text,
  risk_level text,
  horizon text,
  liquidity text,
  market_bias text,
  sharia text,
  allocation jsonb not null default '{}'::jsonb,
  expected_return numeric,
  volatility numeric,
  projected_value numeric,
  years int,
  notes jsonb default '[]'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.portfolios enable row level security;

drop policy if exists "Users can view their own portfolios" on public.portfolios;
create policy "Users can view their own portfolios"
on public.portfolios for select to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert their own portfolios" on public.portfolios;
create policy "Users can insert their own portfolios"
on public.portfolios for insert to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update their own portfolios" on public.portfolios;
create policy "Users can update their own portfolios"
on public.portfolios for update to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own portfolios" on public.portfolios;
create policy "Users can delete their own portfolios"
on public.portfolios for delete to authenticated
using (auth.uid() = user_id);
