create table if not exists public.drive_tokens (
  id text primary key,
  refresh_token text not null,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

alter table public.drive_tokens enable row level security;
