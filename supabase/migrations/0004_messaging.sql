-- ============================================================================
-- GlobeMDs — 0004 Messaging: conversations, messages, read receipts, requests
-- ⚠️ PROVISIONAL — see 0001 header and docs/SCHEMA_RECONCILIATION.md.
-- Typing indicators use Supabase Realtime broadcast channels (no table).
-- ============================================================================

-- Premium entitlements live here (before first use in start_direct_conversation).
-- Rows are written ONLY by the revenuecat-webhook edge function (service role).
create type public.entitlement_status as enum ('active', 'expired', 'cancelled');

create table public.entitlements (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  product_id text not null, -- e.g. 'globemds_premium_monthly'
  status public.entitlement_status not null default 'active',
  source text not null default 'revenuecat',
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (profile_id, product_id)
);

create trigger entitlements_updated_at before update on public.entitlements
  for each row execute function public.set_updated_at();

create or replace function public.has_premium(uid uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.entitlements
    where profile_id = uid and status = 'active'
      and (expires_at is null or expires_at > now())
  );
$$;

alter table public.entitlements enable row level security;
create policy "entitlements own read" on public.entitlements
  for select to authenticated using (profile_id = auth.uid());
-- No insert/update policies: service-role webhook only.

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  is_group boolean not null default false,
  title text, -- for group chats
  created_by uuid not null references public.profiles (id),
  -- true until the recipient accepts a conversation initiated by a
  -- non-connection ("message requests" inbox)
  is_request boolean not null default false,
  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now()
);

create table public.conversation_participants (
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  last_read_at timestamptz not null default now(),
  joined_at timestamptz not null default now(),
  primary key (conversation_id, profile_id)
);

create index conversation_participants_profile_idx on public.conversation_participants (profile_id);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  body text not null default '',
  attachment_path text, -- storage path in message-attachments
  attachment_type text, -- 'image' | 'pdf'
  created_at timestamptz not null default now()
);

create index messages_conversation_idx on public.messages (conversation_id, created_at desc);

create or replace function public.is_conversation_participant(cid uuid, uid uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.conversation_participants
    where conversation_id = cid and profile_id = uid
  );
$$;

-- Start (or reuse) a direct conversation. Marks it a "message request" when
-- the parties are not connected — unless the sender has an active premium
-- entitlement (InMail-style messaging).
create or replace function public.start_direct_conversation(target uuid)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  cid uuid;
  connected boolean;
begin
  if auth.uid() is null or auth.uid() = target then
    raise exception 'invalid target';
  end if;
  if not public.is_verified(auth.uid()) then
    raise exception 'verification required';
  end if;

  select c.id into cid
  from public.conversations c
  join public.conversation_participants a on a.conversation_id = c.id and a.profile_id = auth.uid()
  join public.conversation_participants b on b.conversation_id = c.id and b.profile_id = target
  where c.is_group = false
  limit 1;
  if cid is not null then
    return cid;
  end if;

  connected := public.are_connected(auth.uid(), target);

  insert into public.conversations (is_group, created_by, is_request)
  values (false, auth.uid(), not (connected or public.has_premium(auth.uid())))
  returning id into cid;

  insert into public.conversation_participants (conversation_id, profile_id)
  values (cid, auth.uid()), (cid, target);

  return cid;
end;
$$;

create or replace function public.start_group_conversation(title text, member_ids uuid[])
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  cid uuid;
  m uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if not public.is_verified(auth.uid()) then
    raise exception 'verification required';
  end if;

  insert into public.conversations (is_group, title, created_by)
  values (true, title, auth.uid()) returning id into cid;

  insert into public.conversation_participants (conversation_id, profile_id)
  values (cid, auth.uid());

  foreach m in array member_ids loop
    if m <> auth.uid() then
      insert into public.conversation_participants (conversation_id, profile_id)
      values (cid, m) on conflict do nothing;
    end if;
  end loop;

  return cid;
end;
$$;

create or replace function public.accept_message_request(cid uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  update public.conversations c
  set is_request = false
  where c.id = cid
    and c.is_request
    and c.created_by <> auth.uid()
    and public.is_conversation_participant(cid, auth.uid());
end;
$$;

-- Keep conversations sorted by activity.
create or replace function public.touch_conversation()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.conversations set last_message_at = new.created_at where id = new.conversation_id;
  return new;
end;
$$;

create trigger messages_touch_conversation after insert on public.messages
  for each row execute function public.touch_conversation();

-- ---------- RLS ----------
alter table public.conversations enable row level security;
alter table public.conversation_participants enable row level security;
alter table public.messages enable row level security;

create policy "conversations for participants" on public.conversations
  for select to authenticated
  using (public.is_conversation_participant(id, auth.uid()));

create policy "participants visible to participants" on public.conversation_participants
  for select to authenticated
  using (public.is_conversation_participant(conversation_id, auth.uid()));
create policy "update own read cursor" on public.conversation_participants
  for update to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());

create policy "messages for participants" on public.messages
  for select to authenticated
  using (public.is_conversation_participant(conversation_id, auth.uid()));
create policy "send message as participant" on public.messages
  for insert to authenticated
  with check (
    sender_id = auth.uid()
    and public.is_conversation_participant(conversation_id, auth.uid())
    and public.is_verified(auth.uid())
    -- request conversations: only the initiator may keep writing until accepted
    and (
      not (select is_request from public.conversations c where c.id = conversation_id)
      or (select created_by from public.conversations c where c.id = conversation_id) = auth.uid()
    )
  );

-- Realtime: web and mobile both subscribe to these tables.
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.conversations;
