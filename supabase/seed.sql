-- Seed users for local development
with new_user as (
  insert into auth.users (
    id,
    instance_id,
    email,
    encrypted_password,
    email_confirmed_at,
    confirmation_token,
    recovery_token,
    email_change_token_new,
    email_change,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    role,
    aud
  ) values (
    gen_random_uuid(),
    '00000000-0000-0000-0000-000000000000',
    'host@camp.test',
    crypt('password123', gen_salt('bf')),
    now(),
    '',
    '',
    '',
    '',
    '{"provider":"email","providers":["email"]}',
    '{}'::jsonb,
    now(),
    now(),
    'authenticated',
    'authenticated'
  )
  returning id, email
)
insert into auth.identities (
  id,
  user_id,
  provider_id,
  identity_data,
  provider,
  last_sign_in_at,
  created_at,
  updated_at
)
select gen_random_uuid(), id, id::text, jsonb_build_object('sub', id::text, 'email', email), 'email', now(), now(), now()
from new_user;

with new_user as (
  insert into auth.users (
    id,
    instance_id,
    email,
    encrypted_password,
    email_confirmed_at,
    confirmation_token,
    recovery_token,
    email_change_token_new,
    email_change,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    role,
    aud
  ) values (
    gen_random_uuid(),
    '00000000-0000-0000-0000-000000000000',
    'player1@camp.test',
    crypt('password123', gen_salt('bf')),
    now(),
    '',
    '',
    '',
    '',
    '{"provider":"email","providers":["email"]}',
    '{}'::jsonb,
    now(),
    now(),
    'authenticated',
    'authenticated'
  )
  returning id, email
)
insert into auth.identities (
  id,
  user_id,
  provider_id,
  identity_data,
  provider,
  last_sign_in_at,
  created_at,
  updated_at
)
select gen_random_uuid(), id, id::text, jsonb_build_object('sub', id::text, 'email', email), 'email', now(), now(), now()
from new_user;

with new_user as (
  insert into auth.users (
    id,
    instance_id,
    email,
    encrypted_password,
    email_confirmed_at,
    confirmation_token,
    recovery_token,
    email_change_token_new,
    email_change,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    role,
    aud
  ) values (
    gen_random_uuid(),
    '00000000-0000-0000-0000-000000000000',
    'player2@camp.test',
    crypt('password123', gen_salt('bf')),
    now(),
    '',
    '',
    '',
    '',
    '{"provider":"email","providers":["email"]}',
    '{}'::jsonb,
    now(),
    now(),
    'authenticated',
    'authenticated'
  )
  returning id, email
)
insert into auth.identities (
  id,
  user_id,
  provider_id,
  identity_data,
  provider,
  last_sign_in_at,
  created_at,
  updated_at
)
select gen_random_uuid(), id, id::text, jsonb_build_object('sub', id::text, 'email', email), 'email', now(), now(), now()
from new_user;

-- Seed game data
DO $$
declare
  host_id uuid;
  player1_id uuid;
  player2_id uuid;
  v_game_id uuid := gen_random_uuid();
  round1_id uuid := gen_random_uuid();
  round2_id uuid := gen_random_uuid();
  opt1_id uuid := gen_random_uuid();
  opt2_id uuid := gen_random_uuid();
  opt3_id uuid := gen_random_uuid();
  opt4_id uuid := gen_random_uuid();
  opt5_id uuid := gen_random_uuid();
  opt6_id uuid := gen_random_uuid();
  alias_host uuid;
  alias_p1 uuid;
  alias_p2 uuid;
begin
  select id into host_id from auth.users where email = 'host@camp.test';
  select id into player1_id from auth.users where email = 'player1@camp.test';
  select id into player2_id from auth.users where email = 'player2@camp.test';

  insert into public.profiles (user_id, display_name)
  values
    (host_id, 'Bjorn'),
    (player1_id, 'Campersson'),
    (player2_id, 'Lina');

  insert into public.games (id, name, join_code, display_token, created_by, status)
  values (v_game_id, 'Campfire Predictions', 'CAMP24', encode(extensions.gen_random_bytes(16), 'hex'), host_id, 'ACTIVE');

  insert into public.game_memberships (game_id, user_id, role)
  values
    (v_game_id, host_id, 'HOST'),
    (v_game_id, player1_id, 'PLAYER'),
    (v_game_id, player2_id, 'PLAYER');

  insert into public.aliases (game_id, user_id, name)
  values (v_game_id, host_id, 'Alex');
  insert into public.aliases (game_id, user_id, name)
  values (v_game_id, player1_id, 'Mia');
  insert into public.aliases (game_id, user_id, name)
  values (v_game_id, player2_id, 'Noah');

  select a.id into alias_host from public.aliases a where a.user_id = host_id and a.game_id = v_game_id;
  select a.id into alias_p1 from public.aliases a where a.user_id = player1_id and a.game_id = v_game_id;
  select a.id into alias_p2 from public.aliases a where a.user_id = player2_id and a.game_id = v_game_id;

  -- Round 1 (scored)
  insert into public.rounds (id, game_id, title, hint_text, status, opened_at, closed_at, scored_at)
  values (round1_id, v_game_id, 'First Night', 'Which trail will we hike tomorrow?', 'OPEN', now() - interval '2 days', now() - interval '2 days', now() - interval '2 days');

  insert into public.options (id, round_id, label)
  values
    (opt1_id, round1_id, 'River Loop'),
    (opt2_id, round1_id, 'Summit Ridge'),
    (opt3_id, round1_id, 'Forest Hollow');

  update public.rounds
  set status = 'SCORED', correct_option_id = opt2_id
  where id = round1_id;

  insert into public.votes (round_id, alias_id, option_id, user_id)
  values
    (round1_id, alias_host, opt2_id, host_id),
    (round1_id, alias_p1, opt2_id, player1_id),
    (round1_id, alias_p2, opt1_id, player2_id);

  update public.alias_scores
  set points = points + 1, correct_count = correct_count + 1
  where alias_id in (alias_host, alias_p1);

  -- Round 2 (open)
  insert into public.rounds (id, game_id, title, hint_text, status, opened_at)
  values (round2_id, v_game_id, 'Camp Games', 'What will win the evening vote?', 'OPEN', now() - interval '1 hour');

  insert into public.options (id, round_id, label)
  values
    (opt4_id, round2_id, 'Capture the Flag'),
    (opt5_id, round2_id, 'Stargazing'),
    (opt6_id, round2_id, 'Story Circle');

  insert into public.votes (round_id, alias_id, option_id, user_id)
  values
    (round2_id, alias_host, opt4_id, host_id),
    (round2_id, alias_p1, opt6_id, player1_id);
end $$;
