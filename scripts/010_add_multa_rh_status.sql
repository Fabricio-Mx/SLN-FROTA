alter table public.fleet_multas
  add column if not exists rh_status text not null default 'pendente';

create index if not exists fleet_multas_rh_status_idx on public.fleet_multas (rh_status);

update public.fleet_multas
set rh_status = case
  when status = 'pago' then 'pago'
  else 'pendente'
end
where rh_status is null or rh_status = '';

update public.fleet_multas
set status = case
  when status = 'enviado' then 'enviado'
  else 'pendente'
end
where status not in ('pendente', 'enviado');