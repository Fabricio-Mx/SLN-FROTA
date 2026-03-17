create extension if not exists "pgcrypto";

create table if not exists public.fleet_colaboradores (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  cpf text not null,
  telefone text not null,
  email text,
  departamento text not null,
  cep text,
  endereco text,
  data_vencimento_cnh date not null,
  documentos jsonb,
  imagens_veiculo jsonb,
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
  renavan text,
  modelo text not null,
  km integer not null default 0,
  km_ultima_revisao integer,
  mensalidade numeric not null default 0,
  data_vencimento_contrato date,
  tipo_propriedade text not null,
  empresa_locacao text,
  fornecedor_proprio text,
  cartao_combustivel text not null,
  numero_cartao_combustivel text,
  placa_cartao_combustivel text,
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
create index if not exists fleet_vehicles_placa_idx on public.fleet_vehicles (placa);
create index if not exists fleet_vehicles_colaborador_idx on public.fleet_vehicles (colaborador_id);

alter table public.fleet_colaboradores enable row level security;
alter table public.fleet_vehicles enable row level security;

create index if not exists fleet_multas_placa_idx on public.fleet_multas (placa);
create index if not exists fleet_multas_status_idx on public.fleet_multas (status);
create index if not exists fleet_multas_rh_status_idx on public.fleet_multas (rh_status);
create index if not exists fleet_multas_data_limite_idx on public.fleet_multas (data_limite_indicar);
drop policy if exists "fleet_colaboradores_all" on public.fleet_colaboradores;
create policy "fleet_colaboradores_all" on public.fleet_colaboradores
  for all
alter table public.fleet_multas enable row level security;
  using (true)
  with check (true);

drop policy if exists "fleet_vehicles_all" on public.fleet_vehicles;
create policy "fleet_vehicles_all" on public.fleet_vehicles
  for all
  using (true)
  with check (true);

drop policy if exists "fleet_multas_all" on public.fleet_multas;
create policy "fleet_multas_all" on public.fleet_multas
  for all
  using (true)
  with check (true);
