-- Run once in Supabase SQL Editor (Project → SQL Editor → New Query).
-- This assumes Supabase Auth is enabled (it is, by default, on every project).

-- Shared pool of scanned job postings — one scan serves every user, since
-- the same posting is the same posting regardless of who's looking at it.
create table if not exists jobs (
  id uuid primary key default gen_random_uuid(),
  date_found timestamptz default now(),
  job_title text not null,
  company text not null,
  location text,
  jd_link text not null unique,
  source text default 'web_search',
  created_at timestamptz default now()
);
create index if not exists idx_jobs_jd_link on jobs(jd_link);

-- Each person's private fact bank — this is what makes it safe to share
-- the tool. Nobody's facts are used to tailor anybody else's CV.
create table if not exists user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  fact_bank text,
  updated_at timestamptz default now()
);

-- Per-user fit assessment of a shared job posting. The same job can be
-- "Strong" for one person and "Weak" for another — that's the point.
create table if not exists job_assessments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  job_id uuid references jobs(id) on delete cascade not null,
  fit_score text,          -- 'Strong' | 'Moderate' | 'Weak'
  match_notes text,
  status text default 'New',
  created_at timestamptz default now(),
  unique(user_id, job_id)
);

-- Hidden job market: target companies, private per user.
create table if not exists target_companies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  company_name text not null,
  why_targeted text,
  likely_signal text,
  status text default 'Not Started',
  created_at timestamptz default now()
);

-- Drafted outreach — never sent automatically, always reviewed by the user.
create table if not exists outreach_drafts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  target_company_id uuid references target_companies(id) on delete cascade,
  recipient_role text,
  subject text,
  message_body text,
  created_at timestamptz default now()
);

-- Shared pool of role-title search terms the scanner actually searches for.
-- Grows organically as people accept suggestions from the Role Suggestion
-- agent (see below) instead of being a fixed list buried in code.
create table if not exists search_terms (
  id uuid primary key default gen_random_uuid(),
  term text not null unique,
  added_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz default now()
);

-- The Role Suggestion agent's output for a person — proactive "you should
-- be looking at this" recommendations, separate from jobs it's already
-- found. Each suggestion can be accepted (which adds it to search_terms
-- or target_companies) or dismissed.
create table if not exists role_suggestions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  suggestion_type text not null,  -- 'role' | 'company'
  title text not null,            -- the role title, or company name
  rationale text,
  status text default 'Suggested', -- 'Suggested' | 'Accepted' | 'Dismissed'
  created_at timestamptz default now()
);

-- ===================== ROW LEVEL SECURITY =====================
-- Defense in depth: even if a bug in application code forgot to filter by
-- user, the database itself refuses to return another person's rows.

alter table jobs enable row level security;
alter table user_profiles enable row level security;
alter table job_assessments enable row level security;
alter table target_companies enable row level security;
alter table outreach_drafts enable row level security;
alter table search_terms enable row level security;
alter table role_suggestions enable row level security;

-- Jobs: every signed-in user can read the shared pool. Only the server
-- (using the service role key, which bypasses RLS) inserts new postings.
create policy "jobs are readable by any signed-in user" on jobs
  for select using (auth.role() = 'authenticated');

-- Everything else: strictly scoped to the row's own user_id.
create policy "users manage their own profile" on user_profiles
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "users manage their own assessments" on job_assessments
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "users manage their own target companies" on target_companies
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "users manage their own outreach drafts" on outreach_drafts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Search terms are shared/global (they're just role titles, not private
-- data) — any signed-in user can read them, and can add new ones.
create policy "search terms are readable by any signed-in user" on search_terms
  for select using (auth.role() = 'authenticated');
create policy "signed-in users can add search terms" on search_terms
  for insert with check (auth.role() = 'authenticated');

create policy "users manage their own role suggestions" on role_suggestions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
