create extension if not exists pgcrypto;

create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text not null,
  status text not null default 'ready',
  criteria_version integer not null default 1,
  analysis_error text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.job_criteria (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  title text not null,
  description text not null,
  weight integer not null default 3,
  kind text not null default 'quality',
  evidence_rules jsonb not null default '[]'::jsonb,
  position integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.candidates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  name text not null,
  github_url text not null,
  portfolio_url text,
  cover_letter_text text,
  cover_letter_file_path text,
  status text not null default 'pending',
  overall_score numeric(5,2),
  analysis_error text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.candidate_sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  candidate_id uuid not null unique references public.candidates(id) on delete cascade,
  source_type text not null default 'repo',
  source_url text not null,
  repo_snapshot_json jsonb not null default '{}'::jsonb,
  detected_stack text[] not null default '{}',
  activity_summary text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.candidate_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  candidate_id uuid not null unique references public.candidates(id) on delete cascade,
  criteria_version integer not null default 1,
  overall_score numeric(5,2) not null default 0,
  summary text not null default '',
  strengths jsonb not null default '[]'::jsonb,
  gaps jsonb not null default '[]'::jsonb,
  recommendations jsonb not null default '[]'::jsonb,
  criteria_breakdown jsonb not null default '[]'::jsonb,
  analyzed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.decision_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  winner_candidate_id uuid references public.candidates(id) on delete set null,
  status text not null default 'ready',
  summary text not null default '',
  ranked_candidates jsonb not null default '[]'::jsonb,
  error text,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_jobs_user_created_at on public.jobs(user_id, created_at desc);
create index if not exists idx_job_criteria_job_position on public.job_criteria(job_id, position);
create index if not exists idx_candidates_job_created_at on public.candidates(job_id, created_at desc);
create index if not exists idx_candidate_reports_job_candidate on public.candidate_reports(job_id, candidate_id);
create index if not exists idx_decision_runs_job_created_at on public.decision_runs(job_id, created_at desc);

alter table public.jobs enable row level security;
alter table public.job_criteria enable row level security;
alter table public.candidates enable row level security;
alter table public.candidate_sources enable row level security;
alter table public.candidate_reports enable row level security;
alter table public.decision_runs enable row level security;

create policy "jobs_owner_rw" on public.jobs
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "job_criteria_owner_rw" on public.job_criteria
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "candidates_owner_rw" on public.candidates
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "candidate_sources_owner_rw" on public.candidate_sources
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "candidate_reports_owner_rw" on public.candidate_reports
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "decision_runs_owner_rw" on public.decision_runs
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

insert into storage.buckets (id, name, public)
values ('candidate-files', 'candidate-files', false)
on conflict (id) do nothing;
