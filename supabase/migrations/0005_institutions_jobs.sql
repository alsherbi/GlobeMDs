-- ============================================================================
-- GlobeMDs — 0005 Institutions/company pages + jobs board
-- ⚠️ PROVISIONAL — see 0001 header and docs/SCHEMA_RECONCILIATION.md.
-- ============================================================================

create type public.job_kind as enum ('locum', 'telemedicine', 'full_time', 'consulting');
create type public.application_status as enum ('submitted', 'reviewed', 'contacted', 'closed');

create table public.institutions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind text, -- hospital | health_system | clinic | company | university
  description text not null default '',
  logo_url text,
  website text,
  city text,
  state text,
  country text not null default 'US',
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  search_tsv tsvector generated always as (
    to_tsvector('simple', coalesce(name, '') || ' ' || coalesce(description, ''))
  ) stored
);

create index institutions_search_idx on public.institutions using gin (search_tsv);

create table public.institution_admins (
  institution_id uuid not null references public.institutions (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  primary key (institution_id, profile_id)
);

create table public.institution_followers (
  institution_id uuid not null references public.institutions (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (institution_id, profile_id)
);

-- Profile ↔ institution affiliations shown on the profile.
create table public.profile_institutions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  institution_id uuid not null references public.institutions (id) on delete cascade,
  role_title text,
  is_current boolean not null default true,
  start_year int,
  end_year int,
  created_at timestamptz not null default now()
);

create index profile_institutions_profile_idx on public.profile_institutions (profile_id);

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid references public.institutions (id) on delete cascade,
  posted_by uuid not null references public.profiles (id),
  title text not null,
  kind public.job_kind not null,
  specialty text,
  description text not null default '',
  city text,
  state text,
  country text not null default 'US',
  is_remote boolean not null default false,
  compensation text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  search_tsv tsvector generated always as (
    to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(description, '') || ' ' || coalesce(specialty, ''))
  ) stored
);

create index jobs_search_idx on public.jobs using gin (search_tsv);
create index jobs_active_idx on public.jobs (is_active, created_at desc);
create index jobs_kind_idx on public.jobs (kind);

create table public.job_applications (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs (id) on delete cascade,
  applicant_id uuid not null references public.profiles (id) on delete cascade,
  cover_note text not null default '',
  status public.application_status not null default 'submitted',
  created_at timestamptz not null default now(),
  unique (job_id, applicant_id)
);

-- ---------- RLS ----------
alter table public.institutions enable row level security;
alter table public.institution_admins enable row level security;
alter table public.institution_followers enable row level security;
alter table public.profile_institutions enable row level security;
alter table public.jobs enable row level security;
alter table public.job_applications enable row level security;

create policy "institutions readable" on public.institutions
  for select to authenticated using (true);
create policy "institutions create verified" on public.institutions
  for insert to authenticated
  with check (created_by = auth.uid() and public.is_verified(auth.uid()));
create policy "institutions admin update" on public.institutions
  for update to authenticated
  using (exists (select 1 from public.institution_admins a
                 where a.institution_id = id and a.profile_id = auth.uid()));

create policy "institution admins readable" on public.institution_admins
  for select to authenticated using (true);

create policy "institution followers readable" on public.institution_followers
  for select to authenticated using (true);
create policy "follow institution as self" on public.institution_followers
  for insert to authenticated with check (profile_id = auth.uid());
create policy "unfollow institution as self" on public.institution_followers
  for delete to authenticated using (profile_id = auth.uid());

create policy "affiliations readable" on public.profile_institutions
  for select to authenticated using (true);
create policy "affiliations own write" on public.profile_institutions
  for all to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());

create policy "jobs readable" on public.jobs
  for select to authenticated using (is_active or posted_by = auth.uid());
create policy "jobs post as recruiter or institution admin" on public.jobs
  for insert to authenticated
  with check (
    posted_by = auth.uid()
    and (
      (select is_recruiter from public.profiles p where p.id = auth.uid())
      or (institution_id is not null and exists (
        select 1 from public.institution_admins a
        where a.institution_id = jobs.institution_id and a.profile_id = auth.uid()
      ))
    )
  );
create policy "jobs poster update" on public.jobs
  for update to authenticated using (posted_by = auth.uid());

create policy "applications own or poster read" on public.job_applications
  for select to authenticated
  using (
    applicant_id = auth.uid()
    or exists (select 1 from public.jobs j where j.id = job_id and j.posted_by = auth.uid())
  );
create policy "apply as verified self" on public.job_applications
  for insert to authenticated
  with check (applicant_id = auth.uid() and public.is_verified(auth.uid()));
create policy "poster updates application status" on public.job_applications
  for update to authenticated
  using (exists (select 1 from public.jobs j where j.id = job_id and j.posted_by = auth.uid()));
