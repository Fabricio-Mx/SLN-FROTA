-- Condição de pagamento negociada com o fornecedor (ex.: 3x em 15/30/60 dias).
alter table public.fleet_ordens_servico
  add column if not exists parcelas_quantidade integer,
  add column if not exists prazos_dias jsonb not null default '[]'::jsonb;

update public.fleet_ordens_servico
set parcelas_quantidade = jsonb_array_length(boleto_parcelas)
where parcelas_quantidade is null
  and jsonb_array_length(boleto_parcelas) > 0;
