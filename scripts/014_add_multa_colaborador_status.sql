alter table public.fleet_multas
  add column if not exists colaborador_status text;

update public.fleet_multas
set colaborador_status = 'ativo'
where colaborador_status is null or colaborador_status = '';

alter table public.fleet_multas
  alter column colaborador_status set default 'ativo';

alter table public.fleet_multas
  alter column colaborador_status set not null;