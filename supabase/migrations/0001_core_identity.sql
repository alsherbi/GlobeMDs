-- ============================================================================
-- GlobeMDs — 0001 Core identity, verification, credentials
--
-- ⚠️ PROVISIONAL SCHEMA. This project could not introspect the live Supabase
-- project (ophgnlxuusrupquxinpd) from the build environment. Before applying
-- ANY file in this directory, run `supabase db pull` against the live project
-- and reconcile per docs/SCHEMA_RECONCILIATION.md. If the web app already has
-- an equivalent table, DO NOT create a duplicate — map the mobile code to the
-- existing table instead (see src/types/database.ts for the single mapping
-- point).
-- ============================================================================

create extension if not exists pg_trgm;

-- ---------- Enums ----------
create type public.verification_status as enum ('unverified', 'pending_review', 'verified', 'rejected');
create type public.open_to_kind as enum ('consulting', 'locum', 'telemedicine', 'mentorship');
create type public.verification_doc_kind as enum ('medical_license', 'board_certification', 'ecfmg_certificate', 'other');
create type public.verification_doc_status as enum ('submitted', 'approved', 'rejected');

-- ---------- Profiles ----------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  headline text not null default '',
  bio text not null default '',
  avatar_url text,
  specialty text,
  subspecialty text,
  npi_number text unique,
  npi_verified_at timestamptz,
  verification_status public.verification_status not null default 'unverified',
  open_to public.open_to_kind[] not null default '{}',
  open_to_opportunities boolean not null default false,
  languages text[] not null default '{}',
  accepting_referrals boolean not null default false,
  referral_specialty text,
  referral_regions text[] not null default '{}',
  is_admin boolean not null default false,
  is_recruiter boolean not null default false,
  notification_prefs jsonb not null default '{"push": true, "connections": true, "messages": true, "reactions": true, "comments": true, "jobs": true, "groups": true}'::jsonb,
  search_tsv tsvector generated always as (
    to_tsvector('simple', coalesce(full_name, '') || ' ' || coalesce(headline, '') || ' ' || coalesce(specialty, '') || ' ' || coalesce(subspecialty, ''))
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index profiles_search_idx on public.profiles using gin (search_tsv);
create index profiles_specialty_idx on public.profiles (specialty);
create index profiles_name_trgm_idx on public.profiles using gin (full_name gin_trgm_ops);

-- Auto-create a profile row for each new auth user.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- Helper used across RLS policies: only verified physicians may write publicly.
create or replace function public.is_verified(uid uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.profiles where id = uid and verification_status = 'verified');
$$;

create or replace function public.is_admin(uid uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.profiles where id = uid and is_admin);
$$;

-- ---------- Credential sub-resources ----------
create table public.licenses (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  state text not null,
  license_number text not null,
  expires_on date,
  created_at timestamptz not null default now()
);

create table public.board_certifications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  board_name text not null,
  certification text not null,
  year_certified int,
  created_at timestamptz not null default now()
);

create table public.education_entries (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  institution text not null,
  degree text,
  kind text, -- medical_school | residency | fellowship | other
  start_year int,
  end_year int,
  created_at timestamptz not null default now()
);

create table public.publications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  journal text,
  year int,
  pmid text,
  doi text,
  url text,
  created_at timestamptz not null default now()
);

create table public.cme_entries (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  provider text,
  hours numeric(5,2) not null check (hours > 0),
  completed_on date not null,
  certificate_path text, -- storage path in verification-docs bucket
  created_at timestamptz not null default now()
);

-- ---------- Verification workflow ----------
create table public.verification_documents (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  kind public.verification_doc_kind not null,
  storage_path text not null, -- private bucket 'verification-docs'
  status public.verification_doc_status not null default 'submitted',
  reviewer_id uuid references public.profiles (id),
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz not null default now()
);

create index verification_documents_status_idx on public.verification_documents (status);

-- Admin approval flips the profile flag read by both web and mobile.
create or replace function public.review_verification_document(doc_id uuid, approve boolean, note text default null)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  target uuid;
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'not authorized';
  end if;

  update public.verification_documents
  set status = case when approve then 'approved'::public.verification_doc_status else 'rejected'::public.verification_doc_status end,
      reviewer_id = auth.uid(),
      reviewed_at = now(),
      review_note = note
  where id = doc_id
  returning profile_id into target;

  if approve then
    update public.profiles set verification_status = 'verified' where id = target;
  else
    update public.profiles set verification_status = 'rejected' where id = target;
  end if;
end;
$$;

-- Called by the mobile/web client after a successful NPI Registry match.
-- Note: final 'verified' status still requires the admin document review.
create or replace function public.record_npi_validation(npi text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  update public.profiles
  set npi_number = npi,
      npi_verified_at = now(),
      verification_status = case
        when verification_status = 'unverified' then 'pending_review'::public.verification_status
        else verification_status
      end
  where id = auth.uid();
end;
$$;

-- ---------- RLS ----------
alter table public.profiles enable row level security;
alter table public.licenses enable row level security;
alter table public.board_certifications enable row level security;
alter table public.education_entries enable row level security;
alter table public.publications enable row level security;
alter table public.cme_entries enable row level security;
alter table public.verification_documents enable row level security;

-- Profiles are a professional directory: readable by any signed-in user.
create policy "profiles readable by authenticated" on public.profiles
  for select to authenticated using (true);
create policy "profiles self update" on public.profiles
  for update to authenticated using (id = auth.uid())
  with check (
    id = auth.uid()
    -- users cannot self-grant privileged flags
    and is_admin = (select p.is_admin from public.profiles p where p.id = auth.uid())
    and verification_status = (select p.verification_status from public.profiles p where p.id = auth.uid())
  );

-- Credential sub-resources: readable by all authenticated, writable by owner.
create policy "licenses read" on public.licenses for select to authenticated using (true);
create policy "licenses write" on public.licenses for all to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());

create policy "board_certs read" on public.board_certifications for select to authenticated using (true);
create policy "board_certs write" on public.board_certifications for all to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());

create policy "education read" on public.education_entries for select to authenticated using (true);
create policy "education write" on public.education_entries for all to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());

create policy "publications read" on public.publications for select to authenticated using (true);
create policy "publications write" on public.publications for all to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());

-- CME is private to the owner.
create policy "cme own" on public.cme_entries for all to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());

-- Verification docs: owner can insert/read own; admins can read all.
create policy "verification docs own read" on public.verification_documents
  for select to authenticated using (profile_id = auth.uid() or public.is_admin(auth.uid()));
create policy "verification docs own insert" on public.verification_documents
  for insert to authenticated with check (profile_id = auth.uid());

-- ---------- Storage buckets ----------
insert into storage.buckets (id, name, public) values
  ('avatars', 'avatars', true),
  ('post-media', 'post-media', true),
  ('verification-docs', 'verification-docs', false),
  ('message-attachments', 'message-attachments', false)
on conflict (id) do nothing;

create policy "avatar upload own folder" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatar update own folder" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatar public read" on storage.objects
  for select using (bucket_id = 'avatars');

create policy "post media upload own folder" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'post-media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "post media public read" on storage.objects
  for select using (bucket_id = 'post-media');

create policy "verification docs upload own folder" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'verification-docs' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "verification docs read own or admin" on storage.objects
  for select to authenticated
  using (bucket_id = 'verification-docs'
         and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin(auth.uid())));

create policy "message attachment upload own folder" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'message-attachments' and (storage.foldername(name))[1] = auth.uid()::text);
-- Reads of message attachments are granted via signed URLs generated by
-- participants; direct object reads restricted to uploader.
create policy "message attachment read own" on storage.objects
  for select to authenticated
  using (bucket_id = 'message-attachments' and (storage.foldername(name))[1] = auth.uid()::text);
