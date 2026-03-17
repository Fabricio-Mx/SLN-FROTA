alter table public.fleet_multas
  add column if not exists status_enviado_em timestamptz,
  add column if not exists rh_pago_em timestamptz;

update public.fleet_multas
set status_enviado_em = coalesce(status_enviado_em, updated_at)
where status = 'enviado' and status_enviado_em is null;

update public.fleet_multas
set rh_pago_em = coalesce(rh_pago_em, updated_at)
where rh_status = 'pago' and rh_pago_em is null;