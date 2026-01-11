create or replace function public.end_game(p_game_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_game_host(p_game_id) then
    raise exception 'Not authorized';
  end if;

  update public.games
  set status = 'ENDED', ended_at = now()
  where id = p_game_id
    and status = 'ACTIVE';

  update public.rounds
  set status = 'CLOSED', closed_at = now()
  where game_id = p_game_id
    and status = 'OPEN';
end;
$$;

grant execute on function public.end_game(uuid) to authenticated;

create or replace function public.open_round(p_round_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_game_id uuid;
  v_status public.game_status;
begin
  select game_id into v_game_id
  from public.rounds
  where id = p_round_id;

  if v_game_id is null then
    raise exception 'Round not found';
  end if;

  select status into v_status from public.games where id = v_game_id;
  if v_status <> 'ACTIVE' then
    raise exception 'Game is ended';
  end if;

  if not public.is_game_host(v_game_id) then
    raise exception 'Not authorized';
  end if;

  update public.rounds
  set status = 'OPEN', opened_at = now()
  where id = p_round_id
    and status = 'DRAFT';
end;
$$;

grant execute on function public.open_round(uuid) to authenticated;

create or replace function public.create_round_with_options(
  p_game_id uuid,
  p_title text,
  p_hint_text text,
  p_options text[]
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_round_id uuid;
  v_count int;
  v_status public.game_status;
begin
  if not public.is_game_host(p_game_id) then
    raise exception 'Not authorized';
  end if;

  select status into v_status from public.games where id = p_game_id;
  if v_status <> 'ACTIVE' then
    raise exception 'Game is ended';
  end if;

  v_count := coalesce(array_length(p_options, 1), 0);
  if v_count < 2 then
    raise exception 'At least two options are required';
  end if;

  insert into public.rounds (game_id, title, hint_text, status)
  values (p_game_id, p_title, p_hint_text, 'DRAFT')
  returning id into v_round_id;

  insert into public.options (round_id, label)
  select v_round_id, unnest(p_options);

  return v_round_id;
end;
$$;

grant execute on function public.create_round_with_options(uuid, text, text, text[]) to authenticated;

create or replace function public.active_round_for_game(p_game_id uuid)
returns table (
  round_id uuid,
  game_id uuid,
  title text,
  hint_text text,
  status public.round_status,
  opened_at timestamptz,
  options jsonb
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_game_member(p_game_id) then
    return;
  end if;

  if exists (
    select 1 from public.games g
    where g.id = p_game_id
      and g.status <> 'ACTIVE'
  ) then
    return;
  end if;

  return query
  select r.id,
         r.game_id,
         r.title,
         r.hint_text,
         r.status,
         r.opened_at,
         (
           select coalesce(jsonb_agg(jsonb_build_object('id', o.id, 'label', o.label) order by o.label), '[]'::jsonb)
           from public.options o
           where o.round_id = r.id
         ) as options
  from public.rounds r
  where r.game_id = p_game_id
    and r.status = 'OPEN'
  limit 1;
end;
$$;

grant execute on function public.active_round_for_game(uuid) to authenticated;

drop policy if exists votes_insert_owner on public.votes;
create policy votes_insert_owner
on public.votes
for insert
with check (
  user_id = auth.uid()
  and public.is_alias_owner(alias_id)
  and exists (
    select 1
    from public.aliases a
    join public.rounds r on r.id = round_id
    join public.games g on g.id = r.game_id
    where a.id = alias_id
      and a.game_id = r.game_id
      and r.status = 'OPEN'
      and g.status = 'ACTIVE'
      and public.is_game_member(r.game_id)
  )
  and exists (
    select 1
    from public.options o
    where o.id = option_id
      and o.round_id = round_id
  )
);

drop policy if exists votes_update_owner on public.votes;
create policy votes_update_owner
on public.votes
for update
using (
  user_id = auth.uid()
  and exists (
    select 1
    from public.rounds r
    join public.games g on g.id = r.game_id
    where r.id = round_id
      and r.status = 'OPEN'
      and g.status = 'ACTIVE'
  )
)
with check (
  user_id = auth.uid()
  and public.is_alias_owner(alias_id)
  and exists (
    select 1
    from public.aliases a
    join public.rounds r on r.id = round_id
    join public.games g on g.id = r.game_id
    where a.id = alias_id
      and a.game_id = r.game_id
      and g.status = 'ACTIVE'
  )
  and exists (
    select 1
    from public.options o
    where o.id = option_id
      and o.round_id = round_id
  )
);
