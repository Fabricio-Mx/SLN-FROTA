alter table public.fleet_multas
  add column if not exists indicacao_status text;

update public.fleet_multas
set indicacao_status = case
  when status = 'enviado' then 'sim'
  when data_limite_indicar < current_date then 'expirado'
  else 'sim'
end
where indicacao_status is null or indicacao_status = '';

alter table public.fleet_multas
  alter column indicacao_status set default 'sim';

update public.fleet_multas
set indicacao_status = 'sim'
where indicacao_status is null;

alter table public.fleet_multas
  alter column indicacao_status set not null;