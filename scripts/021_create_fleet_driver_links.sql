-- Vinculo entre o nome do motorista importado (VELOE/Ticket) e o colaborador cadastrado.
create table if not exists public.fleet_driver_links (
  id uuid primary key default gen_random_uuid(),
  origem text not null default 'veloe',
  nome_origem text not null,
  nome_normalizado text not null,
  cpf_origem text,
  colaborador_id uuid references public.fleet_colaboradores (id) on delete cascade,
  ignorado boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists fleet_driver_links_origem_nome_idx
  on public.fleet_driver_links (origem, nome_normalizado);

create index if not exists fleet_driver_links_colaborador_idx
  on public.fleet_driver_links (colaborador_id);

alter table public.fleet_driver_links enable row level security;

drop policy if exists "fleet_driver_links_read_authenticated" on public.fleet_driver_links;
drop policy if exists "fleet_driver_links_insert_privileged" on public.fleet_driver_links;
drop policy if exists "fleet_driver_links_update_privileged" on public.fleet_driver_links;
drop policy if exists "fleet_driver_links_delete_privileged" on public.fleet_driver_links;

create policy "fleet_driver_links_read_authenticated" on public.fleet_driver_links
  for select to authenticated
  using (true);

create policy "fleet_driver_links_insert_privileged" on public.fleet_driver_links
  for insert to authenticated
  with check (public.current_profile_role() in ('mestre', 'administrativo', 'logistico'));

create policy "fleet_driver_links_update_privileged" on public.fleet_driver_links
  for update to authenticated
  using (public.current_profile_role() in ('mestre', 'administrativo', 'logistico'))
  with check (public.current_profile_role() in ('mestre', 'administrativo', 'logistico'));

create policy "fleet_driver_links_delete_privileged" on public.fleet_driver_links
  for delete to authenticated
  using (public.current_profile_role() in ('mestre', 'administrativo', 'logistico'));
