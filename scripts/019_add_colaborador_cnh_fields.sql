alter table if exists public.fleet_colaboradores
  add column if not exists cnh_numero text,
  add column if not exists cnh_categoria text,
  add column if not exists cnh_arquivos jsonb;

update public.fleet_colaboradores
set
  cnh_numero = coalesce(cnh_numero, ''),
  cnh_categoria = coalesce(cnh_categoria, ''),
  cnh_arquivos = coalesce(cnh_arquivos, '[]'::jsonb)
where cnh_numero is null or cnh_categoria is null or cnh_arquivos is null;

create index if not exists fleet_colaboradores_cnh_vencimento_idx
  on public.fleet_colaboradores (data_vencimento_cnh);
