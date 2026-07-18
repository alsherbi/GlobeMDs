-- ============================================================================
-- GlobeMDs — 0002 Network: connections (mutual) + follows (one-way)
-- ⚠️ PROVISIONAL — see 0001 header and docs/SCHEMA_RECONCILIATION.md.
-- ============================================================================

create type public.connection_status as enum ('pending', 'accepted', 'declined');

create table public.connections (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles (id) on delete cascade,
  addressee_id uuid not null references public.profiles (id) on delete cascade,
  status public.connection_status not null default 'pending',
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  check (requester_id <> addressee_id)
);

-- One edge per unordered pair.
create unique index connections_pair_uniq on public.connections
  (least(requester_id, addressee_id), greatest(requester_id, addressee_id));
create index connections_addressee_idx on public.connections (addressee_id, status);
create index connections_requester_idx on public.connections (requester_id, status);

create table public.follows (
  follower_id uuid not null references public.profiles (id) on delete cascade,
  followee_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followee_id),
  check (follower_id <> followee_id)
);

create index follows_followee_idx on public.follows (followee_id);

-- ---------- Connection state machine (single source of business logic) ----------
create or replace function public.send_connection_request(target uuid)
returns public.connections
language plpgsql security definer set search_path = public
as $$
declare
  existing public.connections;
  result public.connections;
begin
  if auth.uid() is null or auth.uid() = target then
    raise exception 'invalid request';
  end if;
  if not public.is_verified(auth.uid()) then
    raise exception 'verification required';
  end if;

  select * into existing from public.connections
  where least(requester_id, addressee_id) = least(auth.uid(), target)
    and greatest(requester_id, addressee_id) = greatest(auth.uid(), target);

  if existing.id is not null then
    if existing.status = 'accepted' then
      raise exception 'already connected';
    elsif existing.status = 'pending' then
      -- If the other party already asked us, sending a request accepts it.
      if existing.requester_id = target then
        update public.connections set status = 'accepted', responded_at = now()
        where id = existing.id returning * into result;
        return result;
      end if;
      raise exception 'request already pending';
    else
      -- previously declined: allow a fresh request from either side
      update public.connections
      set requester_id = auth.uid(), addressee_id = target,
          status = 'pending', created_at = now(), responded_at = null
      where id = existing.id returning * into result;
      return result;
    end if;
  end if;

  insert into public.connections (requester_id, addressee_id)
  values (auth.uid(), target) returning * into result;
  return result;
end;
$$;

create or replace function public.respond_connection_request(request_id uuid, accept boolean)
returns public.connections
language plpgsql security definer set search_path = public
as $$
declare
  result public.connections;
begin
  update public.connections
  set status = case when accept then 'accepted'::public.connection_status else 'declined'::public.connection_status end,
      responded_at = now()
  where id = request_id and addressee_id = auth.uid() and status = 'pending'
  returning * into result;

  if result.id is null then
    raise exception 'request not found or not yours to answer';
  end if;
  return result;
end;
$$;

create or replace function public.are_connected(a uuid, b uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.connections
    where status = 'accepted'
      and least(requester_id, addressee_id) = least(a, b)
      and greatest(requester_id, addressee_id) = greatest(a, b)
  );
$$;

-- People you may know: mutual connections + same specialty, excluding existing edges.
create or replace function public.suggest_connections(max_results int default 20)
returns table (
  profile_id uuid,
  full_name text,
  headline text,
  avatar_url text,
  specialty text,
  mutual_count bigint
)
language sql stable security definer set search_path = public
as $$
  with my_connections as (
    select case when requester_id = auth.uid() then addressee_id else requester_id end as peer
    from public.connections
    where status = 'accepted' and (requester_id = auth.uid() or addressee_id = auth.uid())
  ),
  existing_edges as (
    select case when requester_id = auth.uid() then addressee_id else requester_id end as peer
    from public.connections
    where requester_id = auth.uid() or addressee_id = auth.uid()
  ),
  candidates as (
    select p.id, p.full_name, p.headline, p.avatar_url, p.specialty,
      (
        select count(*) from public.connections c2
        where c2.status = 'accepted'
          and (
            (c2.requester_id = p.id and c2.addressee_id in (select peer from my_connections)) or
            (c2.addressee_id = p.id and c2.requester_id in (select peer from my_connections))
          )
      ) as mutual_count
    from public.profiles p
    where p.id <> auth.uid()
      and p.verification_status = 'verified'
      and p.id not in (select peer from existing_edges)
  )
  select id, full_name, headline, avatar_url, specialty, mutual_count
  from candidates
  order by mutual_count desc,
           (specialty is not distinct from (select specialty from public.profiles where id = auth.uid())) desc,
           full_name
  limit max_results;
$$;

create or replace function public.mutual_connection_count(other uuid)
returns bigint
language sql stable security definer set search_path = public
as $$
  with mine as (
    select case when requester_id = auth.uid() then addressee_id else requester_id end as peer
    from public.connections
    where status = 'accepted' and (requester_id = auth.uid() or addressee_id = auth.uid())
  ),
  theirs as (
    select case when requester_id = other then addressee_id else requester_id end as peer
    from public.connections
    where status = 'accepted' and (requester_id = other or addressee_id = other)
  )
  select count(*) from mine where peer in (select peer from theirs);
$$;

-- ---------- RLS ----------
alter table public.connections enable row level security;
alter table public.follows enable row level security;

-- Connection edges visible to the two parties; counts exposed via RPCs.
create policy "connections visible to parties" on public.connections
  for select to authenticated
  using (requester_id = auth.uid() or addressee_id = auth.uid());
-- All writes go through the RPCs above (security definer); no direct DML.

create policy "follows readable" on public.follows
  for select to authenticated using (true);
create policy "follow as self" on public.follows
  for insert to authenticated
  with check (follower_id = auth.uid() and public.is_verified(auth.uid()));
create policy "unfollow as self" on public.follows
  for delete to authenticated using (follower_id = auth.uid());
