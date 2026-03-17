alter table public.fleet_vehicles
  add column if not exists agregado_colaborador_nome text,
  add column if not exists agregado_funcao text,
  add column if not exists agregado_contrato text,
  add column if not exists agregado_centro_custo text,
  add column if not exists agregado_ano_modelo text,
  add column if not exists agregado_data_inicial date,
  add column if not exists agregado_dias integer;