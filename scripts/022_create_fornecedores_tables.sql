create extension if not exists "pgcrypto";

create table if not exists public.fleet_fornecedores (
  id uuid primary key default gen_random_uuid(),
  razao_social text not null,
  cnpj text,
  telefone text,
  email text,
  responsavel text,
  chave_pix text,
  banco text,
  agencia text,
  conta text,
  observacoes text,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists fleet_fornecedores_razao_social_idx on public.fleet_fornecedores (razao_social);
create index if not exists fleet_fornecedores_cnpj_idx on public.fleet_fornecedores (cnpj);

create table if not exists public.fleet_ordens_servico (
  id uuid primary key default gen_random_uuid(),
  fornecedor_id uuid references public.fleet_fornecedores(id) on delete set null,
  vehicle_id uuid references public.fleet_vehicles(id) on delete set null,
  placa text not null,
  descricao text not null,
  valor_pecas numeric not null default 0,
  valor_mao_obra numeric not null default 0,
  valor_total numeric not null default 0,
  km_veiculo integer,
  data_abertura date,
  previsao_entrega date,
  status text not null default 'aguardando',
  aprovado_por text,
  aprovado_em timestamptz,
  motivo_rejeicao text,
  boleto_vencimento date,
  boleto_valor numeric,
  boleto_arquivos jsonb not null default '[]'::jsonb,
  nota_fiscal_numero text,
  nota_fiscal_emissao date,
  nota_fiscal_valor numeric,
  nota_fiscal_arquivos jsonb not null default '[]'::jsonb,
  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists fleet_ordens_servico_fornecedor_idx on public.fleet_ordens_servico (fornecedor_id);
create index if not exists fleet_ordens_servico_vehicle_idx on public.fleet_ordens_servico (vehicle_id);
create index if not exists fleet_ordens_servico_placa_idx on public.fleet_ordens_servico (placa);
create index if not exists fleet_ordens_servico_status_idx on public.fleet_ordens_servico (status);

alter table public.fleet_fornecedores enable row level security;
alter table public.fleet_ordens_servico enable row level security;

drop policy if exists "fleet_fornecedores_read_authenticated" on public.fleet_fornecedores;
drop policy if exists "fleet_fornecedores_insert_privileged" on public.fleet_fornecedores;
drop policy if exists "fleet_fornecedores_update_privileged" on public.fleet_fornecedores;
drop policy if exists "fleet_fornecedores_delete_privileged" on public.fleet_fornecedores;

create policy "fleet_fornecedores_read_authenticated" on public.fleet_fornecedores
  for select to authenticated
  using (true);

create policy "fleet_fornecedores_insert_privileged" on public.fleet_fornecedores
  for insert to authenticated
  with check (public.current_profile_role() in ('mestre', 'administrativo', 'logistico'));

create policy "fleet_fornecedores_update_privileged" on public.fleet_fornecedores
  for update to authenticated
  using (public.current_profile_role() in ('mestre', 'administrativo', 'logistico'))
  with check (public.current_profile_role() in ('mestre', 'administrativo', 'logistico'));

create policy "fleet_fornecedores_delete_privileged" on public.fleet_fornecedores
  for delete to authenticated
  using (public.current_profile_role() in ('mestre', 'administrativo', 'logistico'));

drop policy if exists "fleet_ordens_servico_read_authenticated" on public.fleet_ordens_servico;
drop policy if exists "fleet_ordens_servico_insert_privileged" on public.fleet_ordens_servico;
drop policy if exists "fleet_ordens_servico_update_privileged" on public.fleet_ordens_servico;
drop policy if exists "fleet_ordens_servico_delete_privileged" on public.fleet_ordens_servico;

create policy "fleet_ordens_servico_read_authenticated" on public.fleet_ordens_servico
  for select to authenticated
  using (true);

create policy "fleet_ordens_servico_insert_privileged" on public.fleet_ordens_servico
  for insert to authenticated
  with check (public.current_profile_role() in ('mestre', 'administrativo', 'logistico'));

create policy "fleet_ordens_servico_update_privileged" on public.fleet_ordens_servico
  for update to authenticated
  using (public.current_profile_role() in ('mestre', 'administrativo', 'logistico'))
  with check (public.current_profile_role() in ('mestre', 'administrativo', 'logistico'));

create policy "fleet_ordens_servico_delete_privileged" on public.fleet_ordens_servico
  for delete to authenticated
  using (public.current_profile_role() in ('mestre', 'administrativo', 'logistico'));

-- Somente mestre/administrativo decidem a aprovação; os demais perfis não mexem no status.
create or replace function public.enforce_fleet_ordens_servico_approval()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_role text;
begin
  current_user_role := public.current_profile_role();

  if new.status is distinct from old.status
    and current_user_role not in ('mestre', 'administrativo')
  then
    raise exception 'Apenas o gestor pode aprovar ou rejeitar ordens de serviço.';
  end if;

  return new;
end;
$$;

drop trigger if exists fleet_ordens_servico_approval_guard on public.fleet_ordens_servico;

create trigger fleet_ordens_servico_approval_guard
before update on public.fleet_ordens_servico
for each row
execute function public.enforce_fleet_ordens_servico_approval();
