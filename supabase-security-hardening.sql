-- تحسينات أمنية مقترحة داخل Supabase
-- نفذها داخل SQL Editor إذا لم تكن موجودة مسبقاً.

-- تأكد من تفعيل RLS على جدول المحافظ
alter table if exists public.portfolios enable row level security;

-- السياسات الأساسية للمحافظ
drop policy if exists "Users can view their own portfolios" on public.portfolios;
create policy "Users can view their own portfolios"
on public.portfolios for select to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert their own portfolios" on public.portfolios;
create policy "Users can insert their own portfolios"
on public.portfolios for insert to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own portfolios" on public.portfolios;
create policy "Users can delete their own portfolios"
on public.portfolios for delete to authenticated
using (auth.uid() = user_id);

notify pgrst, 'reload schema';
