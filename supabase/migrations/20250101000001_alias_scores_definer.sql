create or replace function public.create_alias_score()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.alias_scores (alias_id, game_id)
  values (new.id, new.game_id)
  on conflict (alias_id) do nothing;
  return new;
end;
$$;
