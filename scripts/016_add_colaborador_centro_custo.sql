alter table if exists public.fleet_colaboradores
  add column if not exists centro_custo text;

update public.fleet_colaboradores
set centro_custo = coalesce(nullif(trim(centro_custo), ''), '')
where centro_custo is null;