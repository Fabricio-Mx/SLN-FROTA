create table if not exists public.fleet_multas (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid references public.fleet_vehicles(id) on delete set null,
  colaborador_id uuid references public.fleet_colaboradores(id) on delete set null,
  data_hora_infracao timestamptz not null,
  placa text not null,
  condutor text,
  tipo text not null,
  gravidade text not null,
  pontos integer not null default 0,
  auto_infracao text,
  valor numeric not null default 0,
  data_limite_indicar date not null,
  status text not null default 'pendente',
  indicacao_status text not null default 'sim',
  colaborador_status text not null default 'ativo',
  status_enviado_em timestamptz,
  rh_status text not null default 'pendente',
  rh_pago_em timestamptz,
  valor_nic numeric,
  valor_total_desconto numeric,
  locadora text,
  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists fleet_multas_placa_idx on public.fleet_multas (placa);
create index if not exists fleet_multas_status_idx on public.fleet_multas (status);
create index if not exists fleet_multas_data_limite_idx on public.fleet_multas (data_limite_indicar);

alter table public.fleet_multas enable row level security;

drop policy if exists "fleet_multas_all" on public.fleet_multas;
create policy "fleet_multas_all" on public.fleet_multas
  for all
  using (true)
  with check (true);