-- ============================================
-- PRONORT - Programación de Despachos
-- Script de creación de base de datos
-- Pega esto completo en Supabase > SQL Editor > Run
-- ============================================

-- Sedes (P01, P03, etc.)
create table sedes (
  codigo text primary key,
  nombre text not null,
  linea text not null default 'OTRO'
);

-- Bloques de horario (creados manualmente por el usuario)
create table bloques (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  inicio text not null,
  fin text not null
);

-- Despachos (el registro principal)
create table despachos (
  id uuid primary key default gen_random_uuid(),
  fecha date not null,
  bloque_nombre text,
  tipo text not null default 'VENTA',
  tienda text references sedes(codigo) on delete set null,
  cliente text,
  responsable text,
  celular text,
  comprobante text,
  guia boolean default false,
  num_guia text,
  cobra boolean default false,
  monto numeric,
  direccion text,
  maps_url text,
  estado text default 'pendiente',
  created_at timestamptz default now()
);

-- Catálogos de sugerencias (clientes, responsables, celulares, direcciones)
create table catalogos (
  id uuid primary key default gen_random_uuid(),
  campo text not null, -- 'cliente' | 'responsable' | 'celular' | 'direccion'
  valor text not null,
  unique (campo, valor)
);

-- Métricas personalizadas creadas en Reportes
create table metricas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  operacion text not null,
  filtro_campo text,
  filtro_valor text
);

-- Índices para que las consultas por fecha y sede sean rápidas
create index idx_despachos_fecha on despachos(fecha);
create index idx_despachos_tienda on despachos(tienda);

-- Sedes iniciales de Trujillo (puedes editarlas o agregar más desde la app)
insert into sedes (codigo, nombre, linea) values
  ('P01', 'DRYWALL PRINCIPAL', 'DRYWALL'),
  ('P03', 'DRYWALL UNION', 'DRYWALL'),
  ('P05', 'ADITIVOS PRINCIPAL', 'ADITIVOS'),
  ('P08', 'ADITIVOS 2 TRUJILLO', 'ADITIVOS'),
  ('P09', 'ALMACEN CJ', 'ALMACEN');

-- ============================================
-- Seguridad: permite que la app (con la clave "anon")
-- lea y escriba libremente. Como solo ustedes 2 van a
-- tener el link, esto es suficiente por ahora.
-- ============================================
alter table sedes enable row level security;
alter table bloques enable row level security;
alter table despachos enable row level security;
alter table catalogos enable row level security;
alter table metricas enable row level security;

create policy "acceso total sedes" on sedes for all using (true) with check (true);
create policy "acceso total bloques" on bloques for all using (true) with check (true);
create policy "acceso total despachos" on despachos for all using (true) with check (true);
create policy "acceso total catalogos" on catalogos for all using (true) with check (true);
create policy "acceso total metricas" on metricas for all using (true) with check (true);
