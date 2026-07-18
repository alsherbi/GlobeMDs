-- ============================================================================
-- GlobeMDs — 0003 Content: groups, posts, reactions, comments, bookmarks
-- ⚠️ PROVISIONAL — see 0001 header and docs/SCHEMA_RECONCILIATION.md.
-- ============================================================================

create type public.group_privacy as enum ('public', 'private', 'invite_only');
create type public.group_role as enum ('member', 'admin');
create type public.group_member_status as enum ('pending', 'approved');
create type public.post_type as enum ('text', 'image', 'article', 'poll', 'link', 'case');
create type public.post_visibility as enum ('public', 'connections', 'group');
create type public.reaction_kind as enum ('like', 'insightful', 'celebrate', 'support', 'curious');

-- ---------- Groups ----------
create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  privacy public.group_privacy not null default 'public',
  specialty text,
  avatar_url text,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);

create table public.group_members (
  group_id uuid not null references public.groups (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  role public.group_role not null default 'member',
  status public.group_member_status not null default 'approved',
  joined_at timestamptz not null default now(),
  primary key (group_id, profile_id)
);

create index group_members_profile_idx on public.group_members (profile_id, status);

create or replace function public.is_group_member(gid uuid, uid uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.group_members
    where group_id = gid and profile_id = uid and status = 'approved'
  );
$$;

create or replace function public.is_group_admin(gid uuid, uid uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.group_members
    where group_id = gid and profile_id = uid and role = 'admin' and status = 'approved'
  );
$$;

create table public.group_events (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  title text not null,
  description text not null default '',
  starts_at timestamptz not null,
  ends_at timestamptz,
  location text, -- physical or URL
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);

-- ---------- Posts ----------
create table public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles (id) on delete cascade,
  group_id uuid references public.groups (id) on delete cascade,
  type public.post_type not null default 'text',
  visibility public.post_visibility not null default 'public',
  body text not null default '',
  title text, -- for 'article'
  images text[] not null default '{}', -- storage paths in post-media
  link_url text,
  link_meta jsonb, -- {title, description, image, siteName} or PubMed citation {pmid, title, authors, journal, year}
  poll_options jsonb, -- [{id, text}] for 'poll'
  case_consent_at timestamptz, -- REQUIRED for 'case' posts: no-PHI attestation timestamp
  hashtags text[] not null default '{}',
  reshare_of uuid references public.posts (id) on delete set null,
  pinned_at timestamptz, -- set by group admins
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  search_tsv tsvector generated always as (
    to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(body, ''))
  ) stored,
  -- No-PHI gate is structural, not just UI: a case post without the consent
  -- attestation cannot exist.
  constraint case_posts_require_consent check (type <> 'case' or case_consent_at is not null),
  constraint group_visibility_needs_group check (visibility <> 'group' or group_id is not null)
);

create index posts_author_idx on public.posts (author_id, created_at desc);
create index posts_group_idx on public.posts (group_id, created_at desc);
create index posts_created_idx on public.posts (created_at desc);
create index posts_hashtags_idx on public.posts using gin (hashtags);
create index posts_search_idx on public.posts using gin (search_tsv);

create trigger posts_updated_at before update on public.posts
  for each row execute function public.set_updated_at();

create table public.poll_votes (
  post_id uuid not null references public.posts (id) on delete cascade,
  voter_id uuid not null references public.profiles (id) on delete cascade,
  option_id text not null,
  created_at timestamptz not null default now(),
  primary key (post_id, voter_id)
);

create table public.reactions (
  post_id uuid not null references public.posts (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  kind public.reaction_kind not null default 'like',
  created_at timestamptz not null default now(),
  primary key (post_id, profile_id)
);

create index reactions_post_idx on public.reactions (post_id);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  parent_id uuid references public.comments (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create index comments_post_idx on public.comments (post_id, created_at);

create table public.bookmarks (
  post_id uuid not null references public.posts (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, profile_id)
);

-- ---------- Feed RPC ----------
-- mode 'chrono': connections + follows + my groups, newest first.
-- mode 'top': same sources, ranked by recent engagement.
create or replace function public.get_feed(mode text default 'chrono', before timestamptz default now(), page_size int default 20)
returns setof public.posts
language sql stable security definer set search_path = public
as $$
  with my_peers as (
    select case when requester_id = auth.uid() then addressee_id else requester_id end as peer
    from public.connections
    where status = 'accepted' and (requester_id = auth.uid() or addressee_id = auth.uid())
    union
    select followee_id from public.follows where follower_id = auth.uid()
    union
    select auth.uid()
  ),
  my_groups as (
    select group_id from public.group_members
    where profile_id = auth.uid() and status = 'approved'
  ),
  candidates as (
    select p.* from public.posts p
    where p.created_at < before
      and (
        (p.group_id is null and p.author_id in (select peer from my_peers)
          and (p.visibility = 'public'
               or (p.visibility = 'connections' and public.are_connected(auth.uid(), p.author_id))))
        or (p.group_id in (select group_id from my_groups))
      )
  )
  select c.* from candidates c
  order by
    case when mode = 'top' then (
      select count(*) from public.reactions r
      where r.post_id = c.id and r.created_at > now() - interval '7 days'
    ) + 2 * (
      select count(*) from public.comments cm
      where cm.post_id = c.id and cm.created_at > now() - interval '7 days'
    ) else 0 end desc,
    c.created_at desc
  limit page_size;
$$;

-- ---------- RLS ----------
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.group_events enable row level security;
alter table public.posts enable row level security;
alter table public.poll_votes enable row level security;
alter table public.reactions enable row level security;
alter table public.comments enable row level security;
alter table public.bookmarks enable row level security;

create policy "groups discoverable" on public.groups
  for select to authenticated
  using (privacy <> 'invite_only' or public.is_group_member(id, auth.uid()));
create policy "groups create verified" on public.groups
  for insert to authenticated
  with check (created_by = auth.uid() and public.is_verified(auth.uid()));
create policy "groups admin update" on public.groups
  for update to authenticated using (public.is_group_admin(id, auth.uid()));

create policy "group members visible" on public.group_members
  for select to authenticated
  using (profile_id = auth.uid() or public.is_group_member(group_id, auth.uid()));
create policy "join public group" on public.group_members
  for insert to authenticated
  with check (
    profile_id = auth.uid()
    and public.is_verified(auth.uid())
    and (
      (select privacy from public.groups g where g.id = group_id) = 'public'
      and status = 'approved' and role = 'member'
      or
      (select privacy from public.groups g where g.id = group_id) = 'private'
      and status = 'pending' and role = 'member'
    )
  );
create policy "group admin manages members" on public.group_members
  for update to authenticated using (public.is_group_admin(group_id, auth.uid()));
create policy "leave group or admin remove" on public.group_members
  for delete to authenticated
  using (profile_id = auth.uid() or public.is_group_admin(group_id, auth.uid()));

create policy "group events visible to members" on public.group_events
  for select to authenticated
  using (
    public.is_group_member(group_id, auth.uid())
    or (select privacy from public.groups g where g.id = group_id) = 'public'
  );
create policy "group admin writes events" on public.group_events
  for all to authenticated
  using (public.is_group_admin(group_id, auth.uid()))
  with check (public.is_group_admin(group_id, auth.uid()) and created_by = auth.uid());

create policy "posts visible" on public.posts
  for select to authenticated
  using (
    (group_id is null and (
      visibility = 'public'
      or author_id = auth.uid()
      or (visibility = 'connections' and public.are_connected(auth.uid(), author_id))
    ))
    or (group_id is not null and (
      public.is_group_member(group_id, auth.uid())
      or (select privacy from public.groups g where g.id = group_id) = 'public'
    ))
  );
create policy "posts create verified" on public.posts
  for insert to authenticated
  with check (
    author_id = auth.uid()
    and public.is_verified(auth.uid())
    and (group_id is null or public.is_group_member(group_id, auth.uid()))
  );
create policy "posts own update" on public.posts
  for update to authenticated using (author_id = auth.uid());
create policy "posts own or group-admin delete" on public.posts
  for delete to authenticated
  using (author_id = auth.uid() or (group_id is not null and public.is_group_admin(group_id, auth.uid())));

create policy "poll votes visible" on public.poll_votes for select to authenticated using (true);
create policy "poll vote as self" on public.poll_votes
  for insert to authenticated with check (voter_id = auth.uid() and public.is_verified(auth.uid()));

create policy "reactions visible" on public.reactions for select to authenticated using (true);
create policy "react as self" on public.reactions
  for insert to authenticated with check (profile_id = auth.uid() and public.is_verified(auth.uid()));
create policy "update own reaction" on public.reactions
  for update to authenticated using (profile_id = auth.uid());
create policy "remove own reaction" on public.reactions
  for delete to authenticated using (profile_id = auth.uid());

create policy "comments visible" on public.comments for select to authenticated using (true);
create policy "comment as self verified" on public.comments
  for insert to authenticated with check (author_id = auth.uid() and public.is_verified(auth.uid()));
create policy "delete own comment" on public.comments
  for delete to authenticated using (author_id = auth.uid());

create policy "bookmarks own" on public.bookmarks for all to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());
