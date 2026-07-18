-- ============================================================================
-- GlobeMDs — 0006 Notifications, push tokens, profile views, search RPC
-- ⚠️ PROVISIONAL — see 0001 header and docs/SCHEMA_RECONCILIATION.md.
-- ============================================================================

create type public.notification_kind as enum (
  'connection_request', 'connection_accepted', 'new_follower',
  'post_reaction', 'post_comment', 'comment_reply', 'post_reshare',
  'message', 'group_invite', 'group_join_approved', 'job_match', 'system'
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  kind public.notification_kind not null,
  actor_id uuid references public.profiles (id) on delete cascade,
  entity jsonb not null default '{}'::jsonb, -- {post_id | conversation_id | connection_id | job_id | group_id}
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_recipient_idx on public.notifications (recipient_id, created_at desc);

create table public.push_tokens (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  expo_token text not null,
  platform text not null default 'unknown', -- ios | android
  updated_at timestamptz not null default now(),
  primary key (profile_id, expo_token)
);

-- Premium feature: who viewed my profile.
create table public.profile_views (
  id uuid primary key default gen_random_uuid(),
  viewer_id uuid not null references public.profiles (id) on delete cascade,
  viewed_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  check (viewer_id <> viewed_id)
);

create index profile_views_viewed_idx on public.profile_views (viewed_id, created_at desc);

-- ---------- Notification fan-out triggers ----------
create or replace function public.notify_on_connection()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' and new.status = 'pending' then
    insert into public.notifications (recipient_id, kind, actor_id, entity)
    values (new.addressee_id, 'connection_request', new.requester_id,
            jsonb_build_object('connection_id', new.id));
  elsif tg_op = 'UPDATE' and old.status = 'pending' and new.status = 'accepted' then
    insert into public.notifications (recipient_id, kind, actor_id, entity)
    values (new.requester_id, 'connection_accepted', new.addressee_id,
            jsonb_build_object('connection_id', new.id));
  end if;
  return new;
end;
$$;

create trigger connections_notify after insert or update on public.connections
  for each row execute function public.notify_on_connection();

create or replace function public.notify_on_reaction()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  post_author uuid;
begin
  select author_id into post_author from public.posts where id = new.post_id;
  if post_author is not null and post_author <> new.profile_id then
    insert into public.notifications (recipient_id, kind, actor_id, entity)
    values (post_author, 'post_reaction', new.profile_id,
            jsonb_build_object('post_id', new.post_id, 'reaction', new.kind));
  end if;
  return new;
end;
$$;

create trigger reactions_notify after insert on public.reactions
  for each row execute function public.notify_on_reaction();

create or replace function public.notify_on_comment()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  post_author uuid;
  parent_author uuid;
begin
  select author_id into post_author from public.posts where id = new.post_id;
  if post_author is not null and post_author <> new.author_id then
    insert into public.notifications (recipient_id, kind, actor_id, entity)
    values (post_author, 'post_comment', new.author_id,
            jsonb_build_object('post_id', new.post_id, 'comment_id', new.id));
  end if;
  if new.parent_id is not null then
    select author_id into parent_author from public.comments where id = new.parent_id;
    if parent_author is not null and parent_author <> new.author_id and parent_author is distinct from post_author then
      insert into public.notifications (recipient_id, kind, actor_id, entity)
      values (parent_author, 'comment_reply', new.author_id,
              jsonb_build_object('post_id', new.post_id, 'comment_id', new.id));
    end if;
  end if;
  return new;
end;
$$;

create trigger comments_notify after insert on public.comments
  for each row execute function public.notify_on_comment();

create or replace function public.notify_on_message()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.notifications (recipient_id, kind, actor_id, entity)
  select cp.profile_id, 'message', new.sender_id,
         jsonb_build_object('conversation_id', new.conversation_id, 'message_id', new.id)
  from public.conversation_participants cp
  where cp.conversation_id = new.conversation_id and cp.profile_id <> new.sender_id;
  return new;
end;
$$;

create trigger messages_notify after insert on public.messages
  for each row execute function public.notify_on_message();

-- ---------- Profile view recording (premium read-side) ----------
create or replace function public.record_profile_view(target uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null or auth.uid() = target then
    return;
  end if;
  -- de-dupe: one view per viewer per day
  if not exists (
    select 1 from public.profile_views
    where viewer_id = auth.uid() and viewed_id = target
      and created_at > now() - interval '1 day'
  ) then
    insert into public.profile_views (viewer_id, viewed_id) values (auth.uid(), target);
  end if;
end;
$$;

-- Only premium subscribers can see who viewed them.
create or replace function public.get_profile_viewers(page_size int default 30)
returns table (viewer_id uuid, full_name text, headline text, avatar_url text, viewed_at timestamptz)
language sql stable security definer set search_path = public
as $$
  select pv.viewer_id, p.full_name, p.headline, p.avatar_url, pv.created_at
  from public.profile_views pv
  join public.profiles p on p.id = pv.viewer_id
  where pv.viewed_id = auth.uid() and public.has_premium(auth.uid())
  order by pv.created_at desc
  limit page_size;
$$;

-- ---------- Global search ----------
create or replace function public.global_search(q text, max_per_kind int default 10)
returns jsonb
language sql stable security definer set search_path = public
as $$
  select jsonb_build_object(
    'people', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id, 'full_name', p.full_name, 'headline', p.headline,
        'avatar_url', p.avatar_url, 'specialty', p.specialty,
        'verification_status', p.verification_status))
      from (
        select * from public.profiles
        where search_tsv @@ plainto_tsquery('simple', q) or full_name ilike '%' || q || '%'
        limit max_per_kind
      ) p), '[]'::jsonb),
    'posts', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', po.id, 'body', left(po.body, 240), 'title', po.title,
        'author_id', po.author_id, 'created_at', po.created_at))
      from (
        select * from public.posts
        where search_tsv @@ plainto_tsquery('simple', q)
          and visibility = 'public' and group_id is null
        order by created_at desc
        limit max_per_kind
      ) po), '[]'::jsonb),
    'groups', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', g.id, 'name', g.name, 'description', left(g.description, 160),
        'privacy', g.privacy, 'specialty', g.specialty))
      from (
        select * from public.groups
        where privacy <> 'invite_only' and (name ilike '%' || q || '%' or description ilike '%' || q || '%')
        limit max_per_kind
      ) g), '[]'::jsonb),
    'institutions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', i.id, 'name', i.name, 'kind', i.kind, 'logo_url', i.logo_url,
        'city', i.city, 'state', i.state))
      from (
        select * from public.institutions
        where search_tsv @@ plainto_tsquery('simple', q) or name ilike '%' || q || '%'
        limit max_per_kind
      ) i), '[]'::jsonb),
    'jobs', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', j.id, 'title', j.title, 'kind', j.kind, 'specialty', j.specialty,
        'city', j.city, 'state', j.state, 'is_remote', j.is_remote))
      from (
        select * from public.jobs
        where is_active and (search_tsv @@ plainto_tsquery('simple', q) or title ilike '%' || q || '%')
        order by created_at desc
        limit max_per_kind
      ) j), '[]'::jsonb)
  );
$$;

-- Referral directory search.
create or replace function public.search_referral_directory(spec text default null, region text default null, max_results int default 30)
returns table (profile_id uuid, full_name text, headline text, avatar_url text, referral_specialty text, referral_regions text[])
language sql stable security definer set search_path = public
as $$
  select id, full_name, headline, avatar_url, referral_specialty, referral_regions
  from public.profiles
  where accepting_referrals
    and verification_status = 'verified'
    and (spec is null or referral_specialty ilike '%' || spec || '%')
    and (region is null or referral_regions && array[region])
  limit max_results;
$$;

-- ---------- RLS ----------
alter table public.notifications enable row level security;
alter table public.push_tokens enable row level security;
alter table public.profile_views enable row level security;

create policy "notifications own" on public.notifications
  for select to authenticated using (recipient_id = auth.uid());
create policy "notifications mark read" on public.notifications
  for update to authenticated
  using (recipient_id = auth.uid()) with check (recipient_id = auth.uid());

create policy "push tokens own" on public.push_tokens
  for all to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());

-- profile_views: writes via RPC only; reads via get_profile_viewers (premium).
-- No direct select policy on purpose.

alter publication supabase_realtime add table public.notifications;
