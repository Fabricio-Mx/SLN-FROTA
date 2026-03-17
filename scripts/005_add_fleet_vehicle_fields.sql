alter table public.fleet_vehicles
  add column if not exists renavan text,
  add column if not exists fornecedor_proprio text;