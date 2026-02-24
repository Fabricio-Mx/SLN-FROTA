create extension if not exists "pgcrypto";

create table if not exists public.fleet_colaboradores (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  cpf text not null,
  telefone text not null,
  departamento text not null,
  data_vencimento_cnh date not null,
  documentos jsonb,
  checklist jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists fleet_colaboradores_cpf_idx on public.fleet_colaboradores (cpf);
create index if not exists fleet_colaboradores_nome_idx on public.fleet_colaboradores (nome);

create table if not exists public.fleet_vehicles (
  id uuid primary key default gen_random_uuid(),
  placa text not null,
  chassi text not null,
  modelo text not null,
  km integer not null default 0,
  mensalidade numeric not null default 0,
  data_vencimento_contrato date,
  tipo_propriedade text not null,
  empresa_locacao text,
  cartao_combustivel text not null,
  frota boolean not null default true,
  na_oficina boolean not null default false,
  para_revisao boolean not null default false,
  sem_parar boolean not null default false,
  tipo_contratacao text,
  cpf_agregado text,
  data_vencimento_cnh_agregado date,
  colaborador_id uuid references public.fleet_colaboradores(id) on delete set null,
  imagens jsonb,
  checklists jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists fleet_vehicles_placa_idx on public.fleet_vehicles (placa);
create index if not exists fleet_vehicles_colaborador_idx on public.fleet_vehicles (colaborador_id);

alter table public.fleet_colaboradores enable row level security;
alter table public.fleet_vehicles enable row level security;

drop policy if exists "fleet_colaboradores_all" on public.fleet_colaboradores;
create policy "fleet_colaboradores_all" on public.fleet_colaboradores
  for all
  using (true)
  with check (true);

drop policy if exists "fleet_vehicles_all" on public.fleet_vehicles;
create policy "fleet_vehicles_all" on public.fleet_vehicles
  for all
  using (true)
  with check (true);
