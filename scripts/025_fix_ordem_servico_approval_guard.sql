-- A aprovação/rejeição de ordens de serviço é exclusiva do cargo mestre.
-- O guard também libera o service_role, usado pela rota /api/ordens-servico/[id]/aprovacao,
-- que já valida a sessão antes de gravar (nela auth.uid() é nulo).
create or replace function public.enforce_fleet_ordens_servico_approval()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_role text;
begin
  if new.status is distinct from old.status then
    if auth.uid() is null or coalesce(auth.role(), '') = 'service_role' then
      return new;
    end if;

    current_user_role := public.current_profile_role();

    if current_user_role <> 'mestre' then
      raise exception 'Apenas o cargo mestre pode aprovar ou rejeitar ordens de serviço.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists fleet_ordens_servico_approval_guard on public.fleet_ordens_servico;

create trigger fleet_ordens_servico_approval_guard
before update on public.fleet_ordens_servico
for each row
execute function public.enforce_fleet_ordens_servico_approval();
