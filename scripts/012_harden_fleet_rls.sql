create or replace function public.current_profile_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select p.role
      from public.profiles as p
      where p.id = auth.uid()
      limit 1
    ),
    'consulta'
  )
$$;

grant execute on function public.current_profile_role() to authenticated;

drop policy if exists "fleet_colaboradores_all" on public.fleet_colaboradores;
drop policy if exists "fleet_vehicles_all" on public.fleet_vehicles;
drop policy if exists "fleet_multas_all" on public.fleet_multas;

drop policy if exists "fleet_colaboradores_read_authenticated" on public.fleet_colaboradores;
drop policy if exists "fleet_colaboradores_insert_privileged" on public.fleet_colaboradores;
drop policy if exists "fleet_colaboradores_update_privileged" on public.fleet_colaboradores;
drop policy if exists "fleet_colaboradores_delete_privileged" on public.fleet_colaboradores;

create policy "fleet_colaboradores_read_authenticated" on public.fleet_colaboradores
  for select to authenticated
  using (true);

create policy "fleet_colaboradores_insert_privileged" on public.fleet_colaboradores
  for insert to authenticated
  with check (public.current_profile_role() in ('mestre', 'administrativo', 'logistico'));

create policy "fleet_colaboradores_update_privileged" on public.fleet_colaboradores
  for update to authenticated
  using (public.current_profile_role() in ('mestre', 'administrativo', 'logistico'))
  with check (public.current_profile_role() in ('mestre', 'administrativo', 'logistico'));

create policy "fleet_colaboradores_delete_privileged" on public.fleet_colaboradores
  for delete to authenticated
  using (public.current_profile_role() in ('mestre', 'administrativo', 'logistico'));

drop policy if exists "fleet_vehicles_read_authenticated" on public.fleet_vehicles;
drop policy if exists "fleet_vehicles_insert_privileged" on public.fleet_vehicles;
drop policy if exists "fleet_vehicles_update_privileged" on public.fleet_vehicles;
drop policy if exists "fleet_vehicles_delete_privileged" on public.fleet_vehicles;

create policy "fleet_vehicles_read_authenticated" on public.fleet_vehicles
  for select to authenticated
  using (true);

create policy "fleet_vehicles_insert_privileged" on public.fleet_vehicles
  for insert to authenticated
  with check (public.current_profile_role() in ('mestre', 'administrativo', 'logistico'));

create policy "fleet_vehicles_update_privileged" on public.fleet_vehicles
  for update to authenticated
  using (public.current_profile_role() in ('mestre', 'administrativo', 'logistico'))
  with check (public.current_profile_role() in ('mestre', 'administrativo', 'logistico'));

create policy "fleet_vehicles_delete_privileged" on public.fleet_vehicles
  for delete to authenticated
  using (public.current_profile_role() in ('mestre', 'administrativo', 'logistico'));

drop policy if exists "fleet_multas_read_authenticated" on public.fleet_multas;
drop policy if exists "fleet_multas_insert_privileged" on public.fleet_multas;
drop policy if exists "fleet_multas_update_privileged" on public.fleet_multas;
drop policy if exists "fleet_multas_update_rh_only" on public.fleet_multas;
drop policy if exists "fleet_multas_delete_privileged" on public.fleet_multas;

create policy "fleet_multas_read_authenticated" on public.fleet_multas
  for select to authenticated
  using (true);

create policy "fleet_multas_insert_privileged" on public.fleet_multas
  for insert to authenticated
  with check (public.current_profile_role() in ('mestre', 'administrativo', 'logistico'));

create policy "fleet_multas_update_privileged" on public.fleet_multas
  for update to authenticated
  using (public.current_profile_role() in ('mestre', 'administrativo', 'logistico'))
  with check (public.current_profile_role() in ('mestre', 'administrativo', 'logistico'));

create policy "fleet_multas_update_rh_only" on public.fleet_multas
  for update to authenticated
  using (public.current_profile_role() = 'administrativo_rh')
  with check (public.current_profile_role() = 'administrativo_rh');

create policy "fleet_multas_delete_privileged" on public.fleet_multas
  for delete to authenticated
  using (public.current_profile_role() in ('mestre', 'administrativo', 'logistico'));

create or replace function public.enforce_fleet_multas_role_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_role text;
begin
  current_user_role := public.current_profile_role();

  if current_user_role = 'administrativo_rh' then
    if new.id is distinct from old.id
      or new.vehicle_id is distinct from old.vehicle_id
      or new.colaborador_id is distinct from old.colaborador_id
      or new.data_hora_infracao is distinct from old.data_hora_infracao
      or new.placa is distinct from old.placa
      or new.condutor is distinct from old.condutor
      or new.tipo is distinct from old.tipo
      or new.gravidade is distinct from old.gravidade
      or new.pontos is distinct from old.pontos
      or new.auto_infracao is distinct from old.auto_infracao
      or new.valor is distinct from old.valor
      or new.data_limite_indicar is distinct from old.data_limite_indicar
      or new.status is distinct from old.status
      or new.indicacao_status is distinct from old.indicacao_status
      or new.colaborador_status is distinct from old.colaborador_status
      or new.status_enviado_em is distinct from old.status_enviado_em
      or new.valor_nic is distinct from old.valor_nic
      or new.valor_total_desconto is distinct from old.valor_total_desconto
      or new.locadora is distinct from old.locadora
      or new.observacoes is distinct from old.observacoes
      or new.created_at is distinct from old.created_at
    then
      raise exception 'Administrativo RH só pode alterar o Status RH das multas.';
    end if;

    if old.rh_status is distinct from 'pendente' or new.rh_status is distinct from 'pago' then
      raise exception 'Administrativo RH só pode mover multas pendentes para Pago.';
    end if;

    new.rh_pago_em := coalesce(old.rh_pago_em, new.rh_pago_em, now());
    new.updated_at := now();
  end if;

  return new;
end;
$$;

drop trigger if exists fleet_multas_role_update_guard on public.fleet_multas;

create trigger fleet_multas_role_update_guard
before update on public.fleet_multas
for each row
execute function public.enforce_fleet_multas_role_update();