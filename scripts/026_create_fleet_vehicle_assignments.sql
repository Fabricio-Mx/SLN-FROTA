-- Historico de condutores de cada veiculo (entrega e recolhimento).
-- Um gatilho em fleet_vehicles registra automaticamente toda troca de colaborador,
-- seja pela atribuicao, remocao, edicao do veiculo ou importacao.

create table if not exists public.fleet_vehicle_assignments (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.fleet_vehicles (id) on delete cascade,
  colaborador_id uuid references public.fleet_colaboradores (id) on delete set null,
  -- Copia do nome/centro de custo no momento da entrega: o historico continua legivel mesmo se o cadastro mudar.
  colaborador_nome text not null,
  colaborador_centro_custo text,
  data_entrega timestamptz not null default now(),
  data_recolhimento timestamptz,
  km_entrega integer,
  km_recolhimento integer,
  -- sistema = gravado pelo gatilho; carga_inicial = vinculo que ja existia (data aproximada); manual = lancado pela frota.
  origem text not null default 'sistema',
  observacao text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fleet_vehicle_assignments_periodo_chk
    check (data_recolhimento is null or data_recolhimento >= data_entrega)
);

create index if not exists fleet_vehicle_assignments_vehicle_idx
  on public.fleet_vehicle_assignments (vehicle_id, data_entrega desc);

create index if not exists fleet_vehicle_assignments_colaborador_idx
  on public.fleet_vehicle_assignments (colaborador_id);

-- No maximo um condutor "em aberto" (sem recolhimento) por veiculo.
create unique index if not exists fleet_vehicle_assignments_open_idx
  on public.fleet_vehicle_assignments (vehicle_id)
  where data_recolhimento is null;

create or replace function public.fleet_track_vehicle_assignment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nome text;
  v_centro_custo text;
begin
  if tg_op = 'UPDATE' and new.colaborador_id is not distinct from old.colaborador_id then
    return new;
  end if;

  update public.fleet_vehicle_assignments
     set data_recolhimento = greatest(now(), data_entrega),
         km_recolhimento = new.km,
         updated_at = now()
   where vehicle_id = new.id
     and data_recolhimento is null;

  if new.colaborador_id is not null then
    select c.nome, nullif(trim(c.centro_custo), '')
      into v_nome, v_centro_custo
      from public.fleet_colaboradores as c
     where c.id = new.colaborador_id;

    insert into public.fleet_vehicle_assignments (
      vehicle_id, colaborador_id, colaborador_nome, colaborador_centro_custo, data_entrega, km_entrega, origem
    ) values (
      new.id, new.colaborador_id, coalesce(v_nome, 'Colaborador'), v_centro_custo, now(), new.km, 'sistema'
    );
  end if;

  return new;
end;
$$;

drop trigger if exists fleet_vehicles_track_assignment on public.fleet_vehicles;

create trigger fleet_vehicles_track_assignment
  after insert or update of colaborador_id on public.fleet_vehicles
  for each row
  execute function public.fleet_track_vehicle_assignment();

-- Carga inicial: veiculos que ja estao com alguem entram como condutor atual (data de entrega aproximada).
insert into public.fleet_vehicle_assignments (
  vehicle_id, colaborador_id, colaborador_nome, colaborador_centro_custo, data_entrega, km_entrega, origem
)
select v.id, v.colaborador_id, c.nome, nullif(trim(c.centro_custo), ''), coalesce(v.updated_at, now()), v.km, 'carga_inicial'
  from public.fleet_vehicles as v
  join public.fleet_colaboradores as c on c.id = v.colaborador_id
 where not exists (
   select 1 from public.fleet_vehicle_assignments as a
    where a.vehicle_id = v.id and a.data_recolhimento is null
 );

alter table public.fleet_vehicle_assignments enable row level security;

drop policy if exists "fleet_vehicle_assignments_read_authenticated" on public.fleet_vehicle_assignments;
drop policy if exists "fleet_vehicle_assignments_insert_privileged" on public.fleet_vehicle_assignments;
drop policy if exists "fleet_vehicle_assignments_update_privileged" on public.fleet_vehicle_assignments;
drop policy if exists "fleet_vehicle_assignments_delete_privileged" on public.fleet_vehicle_assignments;

create policy "fleet_vehicle_assignments_read_authenticated" on public.fleet_vehicle_assignments
  for select to authenticated
  using (true);

create policy "fleet_vehicle_assignments_insert_privileged" on public.fleet_vehicle_assignments
  for insert to authenticated
  with check (public.current_profile_role() in ('mestre', 'administrativo', 'logistico'));

create policy "fleet_vehicle_assignments_update_privileged" on public.fleet_vehicle_assignments
  for update to authenticated
  using (public.current_profile_role() in ('mestre', 'administrativo', 'logistico'))
  with check (public.current_profile_role() in ('mestre', 'administrativo', 'logistico'));

create policy "fleet_vehicle_assignments_delete_privileged" on public.fleet_vehicle_assignments
  for delete to authenticated
  using (public.current_profile_role() in ('mestre', 'administrativo', 'logistico'));
