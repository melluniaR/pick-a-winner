-- Extensions
create extension if not exists pgcrypto;

-- Enums
create type public.game_status as enum ('ACTIVE', 'ENDED');
create type public.membership_role as enum ('HOST', 'PLAYER');
create type public.round_status as enum ('DRAFT', 'OPEN', 'CLOSED', 'SCORED');

-- Tables
create table public.games (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  join_code text not null unique,
  display_token text not null unique,
  created_by uuid not null references auth.users(id) on delete cascade,
  status public.game_status not null default 'ACTIVE',
  created_at timestamptz not null default now(),
  ended_at timestamptz
);

create table public.game_memberships (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.membership_role not null default 'PLAYER',
  created_at timestamptz not null default now(),
  unique (game_id, user_id)
);

create table public.aliases (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (game_id, user_id, name)
);

create table public.rounds (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  round_number int not null,
  title text,
  hint_text text,
  status public.round_status not null default 'DRAFT',
  opened_at timestamptz,
  closed_at timestamptz,
  scored_at timestamptz,
  correct_option_id uuid,
  created_at timestamptz not null default now()
);

create table public.options (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.rounds(id) on delete cascade,
  label text not null
);

alter table public.rounds
  add constraint rounds_correct_option_fk
  foreign key (correct_option_id) references public.options(id);

create table public.votes (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.rounds(id) on delete cascade,
  alias_id uuid not null references public.aliases(id) on delete cascade,
  option_id uuid not null references public.options(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (round_id, alias_id)
);

create table public.alias_scores (
  alias_id uuid primary key references public.aliases(id) on delete cascade,
  game_id uuid not null references public.games(id) on delete cascade,
  points int not null default 0,
  correct_count int not null default 0,
  updated_at timestamptz not null default now()
);

-- Indexes
create index rounds_game_status_idx on public.rounds (game_id, status);
create index options_round_idx on public.options (round_id);
create index votes_round_idx on public.votes (round_id);
create index votes_option_idx on public.votes (option_id);
create index votes_alias_idx on public.votes (alias_id);
create index alias_scores_game_points_idx on public.alias_scores (game_id, points desc);

create unique index rounds_single_open_idx on public.rounds (game_id)
  where status = 'OPEN';

-- Update triggers
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger votes_set_updated_at
before update on public.votes
for each row execute function public.set_updated_at();

create trigger alias_scores_set_updated_at
before update on public.alias_scores
for each row execute function public.set_updated_at();

-- Round numbering per game
create or replace function public.assign_round_number()
returns trigger
language plpgsql
as $$
begin
  if new.round_number is null then
    select coalesce(max(round_number), 0) + 1
      into new.round_number
      from public.rounds
      where game_id = new.game_id;
  end if;
  return new;
end;
$$;

create trigger rounds_assign_number
before insert on public.rounds
for each row execute function public.assign_round_number();

-- Alias score seed row
create or replace function public.create_alias_score()
returns trigger
language plpgsql
as $$
begin
  insert into public.alias_scores (alias_id, game_id)
  values (new.id, new.game_id)
  on conflict (alias_id) do nothing;
  return new;
end;
$$;

create trigger aliases_create_score
after insert on public.aliases
for each row execute function public.create_alias_score();

-- Helpers
create or replace function public.is_game_member(p_game_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.game_memberships gm
    where gm.game_id = p_game_id
      and gm.user_id = auth.uid()
  );
$$;

create or replace function public.is_game_host(p_game_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.game_memberships gm
    where gm.game_id = p_game_id
      and gm.user_id = auth.uid()
      and gm.role = 'HOST'
  );
$$;

create or replace function public.is_alias_owner(p_alias_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.aliases a
    where a.id = p_alias_id
      and a.user_id = auth.uid()
  );
$$;

create or replace function public.generate_join_code()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  code text;
begin
  loop
    code := upper(substr(md5(random()::text), 1, 6));
    exit when not exists (select 1 from public.games where join_code = code);
  end loop;
  return code;
end;
$$;

create or replace function public.generate_display_token()
returns text
language sql
security definer
set search_path = public, extensions
as $$
  select encode(extensions.gen_random_bytes(16), 'hex');
$$;

alter table public.games
  alter column join_code set default public.generate_join_code(),
  alter column display_token set default public.generate_display_token();

-- RPC: create game
create or replace function public.create_game(p_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_game_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  insert into public.games (name, join_code, display_token, created_by)
  values (p_name, public.generate_join_code(), public.generate_display_token(), auth.uid())
  returning id into v_game_id;

  insert into public.game_memberships (game_id, user_id, role)
  values (v_game_id, auth.uid(), 'HOST');

  return v_game_id;
end;
$$;

-- RPC: join game by code
create or replace function public.join_game_by_code(p_join_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_game_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select id into v_game_id
  from public.games
  where join_code = upper(p_join_code)
    and status = 'ACTIVE';

  if v_game_id is null then
    raise exception 'Game not found';
  end if;

  insert into public.game_memberships (game_id, user_id, role)
  values (v_game_id, auth.uid(), 'PLAYER')
  on conflict (game_id, user_id) do nothing;

  return v_game_id;
end;
$$;

-- RPC: create round with options
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
begin
  if not public.is_game_host(p_game_id) then
    raise exception 'Not authorized';
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

-- RPC: open round
create or replace function public.open_round(p_round_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_game_id uuid;
begin
  select game_id into v_game_id
  from public.rounds
  where id = p_round_id;

  if v_game_id is null then
    raise exception 'Round not found';
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

-- RPC: score round
create or replace function public.score_round(
  p_round_id uuid,
  p_correct_option_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_game_id uuid;
  v_valid boolean;
begin
  select game_id into v_game_id
  from public.rounds
  where id = p_round_id
    and status = 'OPEN';

  if v_game_id is null then
    raise exception 'Round not found or not open';
  end if;

  if not public.is_game_host(v_game_id) then
    raise exception 'Not authorized';
  end if;

  select exists (
    select 1 from public.options
    where id = p_correct_option_id
      and round_id = p_round_id
  ) into v_valid;

  if not v_valid then
    raise exception 'Option is not part of round';
  end if;

  update public.rounds
  set status = 'SCORED',
      correct_option_id = p_correct_option_id,
      closed_at = now(),
      scored_at = now()
  where id = p_round_id;

  insert into public.alias_scores (alias_id, game_id, points, correct_count, updated_at)
  select v.alias_id, v_game_id, 1, 1, now()
  from public.votes v
  where v.round_id = p_round_id
    and v.option_id = p_correct_option_id
  on conflict (alias_id)
  do update set
    points = public.alias_scores.points + 1,
    correct_count = public.alias_scores.correct_count + 1,
    updated_at = now();
end;
$$;

-- RPC: active round with options
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

-- RPC: option vote counts (host only)
create or replace function public.option_vote_counts(p_round_id uuid)
returns table (
  option_id uuid,
  label text,
  votes_count bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_game_id uuid;
begin
  select r.game_id into v_game_id
  from public.rounds r
  where r.id = p_round_id;

  if v_game_id is null then
    raise exception 'Round not found';
  end if;

  if not public.is_game_host(v_game_id) then
    raise exception 'Not authorized';
  end if;

  return query
  select o.id,
         o.label,
         count(v.id) as votes_count
  from public.options o
  left join public.votes v
    on v.option_id = o.id
   and v.round_id = p_round_id
  where o.round_id = p_round_id
  group by o.id, o.label
  order by votes_count desc, o.label asc;
end;
$$;

-- Realtime identity
alter table public.votes replica identity full;
alter table public.rounds replica identity full;
alter table public.alias_scores replica identity full;

-- RLS
alter table public.games enable row level security;
alter table public.game_memberships enable row level security;
alter table public.aliases enable row level security;
alter table public.rounds enable row level security;
alter table public.options enable row level security;
alter table public.votes enable row level security;
alter table public.alias_scores enable row level security;

-- RLS policies: games
create policy games_select_member
on public.games
for select
using (public.is_game_member(id));

create policy games_insert_owner
on public.games
for insert
with check (created_by = auth.uid());

create policy games_update_host
on public.games
for update
using (public.is_game_host(id));

-- RLS policies: memberships
create policy memberships_select_self
on public.game_memberships
for select
using (user_id = auth.uid());

create policy memberships_insert_self
on public.game_memberships
for insert
with check (
  user_id = auth.uid()
  and role = 'PLAYER'
  and exists (
    select 1 from public.games g
    where g.id = game_id
      and g.status = 'ACTIVE'
  )
);

-- RLS policies: aliases
create policy aliases_select_member
on public.aliases
for select
using (public.is_game_member(game_id));

create policy aliases_insert_owner
on public.aliases
for insert
with check (
  user_id = auth.uid()
  and public.is_game_member(game_id)
);

create policy aliases_update_owner
on public.aliases
for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy aliases_delete_owner
on public.aliases
for delete
using (user_id = auth.uid());

-- RLS policies: rounds
create policy rounds_select_open_or_host
on public.rounds
for select
using (
  public.is_game_host(game_id)
  or (status = 'OPEN' and public.is_game_member(game_id))
);

create policy rounds_modify_host
on public.rounds
for insert
with check (public.is_game_host(game_id));

create policy rounds_update_host
on public.rounds
for update
using (public.is_game_host(game_id));

create policy rounds_delete_host
on public.rounds
for delete
using (public.is_game_host(game_id));

-- RLS policies: options
create policy options_select_open_or_host
on public.options
for select
using (
  exists (
    select 1
    from public.rounds r
    where r.id = round_id
      and (public.is_game_host(r.game_id) or (r.status = 'OPEN' and public.is_game_member(r.game_id)))
  )
);

create policy options_modify_host
on public.options
for insert
with check (
  exists (
    select 1
    from public.rounds r
    where r.id = round_id
      and public.is_game_host(r.game_id)
  )
);

create policy options_update_host
on public.options
for update
using (
  exists (
    select 1
    from public.rounds r
    where r.id = round_id
      and public.is_game_host(r.game_id)
  )
);

create policy options_delete_host
on public.options
for delete
using (
  exists (
    select 1
    from public.rounds r
    where r.id = round_id
      and public.is_game_host(r.game_id)
  )
);

-- RLS policies: votes
create policy votes_select_owner_or_host
on public.votes
for select
using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.rounds r
    where r.id = round_id
      and public.is_game_host(r.game_id)
  )
);

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
    where a.id = alias_id
      and a.game_id = r.game_id
  )
  and exists (
    select 1
    from public.rounds r
    where r.id = round_id
      and r.status = 'OPEN'
      and public.is_game_member(r.game_id)
  )
  and exists (
    select 1
    from public.options o
    where o.id = option_id
      and o.round_id = round_id
  )
);

create policy votes_update_owner
on public.votes
for update
using (
  user_id = auth.uid()
  and exists (
    select 1
    from public.rounds r
    where r.id = round_id
      and r.status = 'OPEN'
  )
)
with check (
  user_id = auth.uid()
  and public.is_alias_owner(alias_id)
  and exists (
    select 1
    from public.aliases a
    join public.rounds r on r.id = round_id
    where a.id = alias_id
      and a.game_id = r.game_id
  )
  and exists (
    select 1
    from public.options o
    where o.id = option_id
      and o.round_id = round_id
  )
);

-- RLS policies: alias_scores
create policy alias_scores_select_member
on public.alias_scores
for select
using (public.is_game_member(game_id));

create policy alias_scores_update_host
on public.alias_scores
for update
using (public.is_game_host(game_id));

create policy alias_scores_insert_host
on public.alias_scores
for insert
with check (public.is_game_host(game_id));

-- Grants
grant execute on function public.create_game(text) to authenticated;
grant execute on function public.join_game_by_code(text) to authenticated;
grant execute on function public.create_round_with_options(uuid, text, text, text[]) to authenticated;
grant execute on function public.open_round(uuid) to authenticated;
grant execute on function public.score_round(uuid, uuid) to authenticated;
grant execute on function public.active_round_for_game(uuid) to authenticated;
grant execute on function public.option_vote_counts(uuid) to authenticated;
