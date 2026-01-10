create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;

create policy profiles_select_authenticated
on public.profiles
for select
using (auth.uid() is not null);

create policy profiles_insert_self
on public.profiles
for insert
with check (user_id = auth.uid());

create policy profiles_update_self
on public.profiles
for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

create or replace function public.set_display_name(p_display_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  insert into public.profiles (user_id, display_name)
  values (auth.uid(), p_display_name)
  on conflict (user_id)
  do update set display_name = excluded.display_name, updated_at = now();
end;
$$;

grant execute on function public.set_display_name(text) to authenticated;
