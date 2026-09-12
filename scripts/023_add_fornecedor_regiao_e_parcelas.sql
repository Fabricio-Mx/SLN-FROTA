alter table public.fleet_fornecedores
  add column if not exists regiao text,
  add column if not exists uf text;

create index if not exists fleet_fornecedores_regiao_idx on public.fleet_fornecedores (regiao);

-- Um boleto pode ser dividido em várias parcelas, cada uma com vencimento e anexos próprios.
alter table public.fleet_ordens_servico
  add column if not exists boleto_parcelas jsonb not null default '[]'::jsonb;

-- Migra o boleto único já cadastrado para o formato de parcelas.
update public.fleet_ordens_servico
set boleto_parcelas = jsonb_build_array(
  jsonb_build_object(
    'id', gen_random_uuid()::text,
    'numero', 1,
    'vencimento', coalesce(to_char(boleto_vencimento, 'YYYY-MM-DD'), ''),
    'valor', boleto_valor,
    'pago', false,
    'pagoEm', null,
    'arquivos', coalesce(boleto_arquivos, '[]'::jsonb)
  )
)
where boleto_parcelas = '[]'::jsonb
  and (boleto_vencimento is not null or jsonb_array_length(coalesce(boleto_arquivos, '[]'::jsonb)) > 0);
