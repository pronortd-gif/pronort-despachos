-- ============================================================
-- PRONORT · Programación de Despachos
-- ESQUEMA DE REFERENCIA de la base de datos
--
-- Este archivo NO hay que ejecutarlo: la base ya está creada. Está
-- versionado porque toda la seguridad de la app depende de lo que hay
-- aquí (RLS, políticas, claves foráneas, restricciones), y sin tenerlo
-- en el repositorio no se puede revisar ni saber si algo cambió.
--
-- Sí se ejecuta en un solo caso: levantar una base NUEVA y VACÍA (un
-- ambiente de pruebas, otro cliente). Nunca sobre la base en uso,
-- porque recrearía las tablas desde cero.
--
-- IMPORTANTE: refleja el esquema tal como se creó. Si alguna vez se
-- cambia algo directamente en el panel de Supabase, hay que reflejarlo
-- aquí en el mismo commit, o este archivo empieza a mentir.
-- ============================================================

-- ---------- Sedes (P01, P03, etc.) ----------
create table sedes (
  codigo text primary key,
  nombre text not null,
  linea text not null default 'OTRO',
  constraint sedes_linea_valida check (linea in ('DRYWALL', 'ADITIVOS', 'ALMACEN', 'OTRO')),
  constraint sedes_codigo_no_vacio check (length(trim(codigo)) > 0)
);

-- ---------- Bloques de horario ----------
-- Cada horario pertenece a una fecha concreta (cada día tiene los suyos).
-- El nombre es opcional: si no se pone, el horario se identifica por su hora.
-- Las horas se guardan como texto "HH:MM".
create table bloques (
  id uuid primary key default gen_random_uuid(),
  fecha date not null,
  nombre text,
  inicio text not null,
  fin text not null,
  constraint bloques_horas_formato check (
    inicio ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' and
    fin    ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
  ),
  constraint bloques_fin_despues_de_inicio check (fin > inicio)
);

-- ---------- Despachos (el registro principal) ----------
-- Cubre los 3 tipos de operación: Venta, Compra y Movimiento de mercadería.
-- Cada tipo usa un subconjunto distinto de estas columnas (ver constants.js
-- del código: CONFIG_TIPO define qué campo aplica a cada tipo).
create table despachos (
  id uuid primary key default gen_random_uuid(),
  fecha date not null,
  bloque_id uuid references bloques(id) on delete set null,
  tipo text not null default 'VENTA', -- 'VENTA' | 'COMPRA' | 'MOV_MERCADERIA'
  tienda text references sedes(codigo) on delete set null,       -- sede origen / que despacha / que recibe
  sede_destino text references sedes(codigo) on delete set null, -- solo Movimiento: sede destino

  -- Venta
  cliente text,
  responsable text,

  -- Compra
  proveedor text,
  gestionado_por text,
  entregado_por text,

  -- Movimiento de mercadería
  trasladado_por text,
  recibe_destino text,
  celular_persona1 text, -- celular de "trasladado_por"
  celular_persona2 text, -- celular de "recibe_destino"

  -- Comunes
  celular text, -- celular de contacto en Venta y Compra
  comprobante text,
  num_guia text,
  cobra boolean default false,
  monto numeric,
  direccion text,
  maps_url text,
  estado text default 'pendiente', -- 'pendiente' | 'entregado' | 'no_entregado'
  orden integer default 0, -- orden manual dentro de un mismo horario (varios despachos en el mismo carro)
  created_at timestamptz default now(),

  -- La app escribe desde el navegador con la clave pública, así que el
  -- formulario no es una barrera: cualquier llamada directa a la API
  -- podría guardar valores inventados. Estas restricciones son el único
  -- filtro que no se puede saltar.
  constraint despachos_tipo_valido check (tipo in ('VENTA', 'COMPRA', 'MOV_MERCADERIA')),
  constraint despachos_estado_valido check (estado in ('pendiente', 'entregado', 'no_entregado')),
  constraint despachos_monto_no_negativo check (monto is null or monto >= 0),
  constraint despachos_orden_no_negativo check (orden is null or orden >= 0),
  constraint despachos_origen_distinto_destino check (sede_destino is null or tienda is null or sede_destino <> tienda)
);

-- ---------- Catálogos de sugerencias ----------
create table catalogos (
  id uuid primary key default gen_random_uuid(),
  campo text not null, -- 'cliente' | 'proveedor' | 'responsable' | 'celular' | 'direccion'
  valor text not null,
  unique (campo, valor),
  constraint catalogos_campo_valido check (campo in ('cliente', 'proveedor', 'responsable', 'celular', 'direccion')),
  constraint catalogos_valor_no_vacio check (length(trim(valor)) > 0)
);

-- ---------- Métricas personalizadas (Reportes) ----------
create table metricas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  operacion text not null,
  filtro_campo text,
  filtro_valor text,
  constraint metricas_operacion_valida check (operacion in ('contar', 'sumar', 'promediar', 'porcentaje'))
);

-- ---------- Índices ----------
create index idx_despachos_fecha on despachos(fecha);
create index idx_despachos_tienda on despachos(tienda);
create index idx_bloques_fecha on bloques(fecha);
create index idx_despachos_bloque on despachos(bloque_id);

-- ---------- Sedes iniciales de Trujillo ----------
-- (puedes editarlas o agregar más después, desde la pestaña Catálogos)
insert into sedes (codigo, nombre, linea) values
  ('P01', 'DRYWALL PRINCIPAL', 'DRYWALL'),
  ('P03', 'DRYWALL UNION', 'DRYWALL'),
  ('P05', 'ADITIVOS PRINCIPAL', 'ADITIVOS'),
  ('P08', 'ADITIVOS 2 TRUJILLO', 'ADITIVOS'),
  ('P09', 'ALMACEN CJ', 'ALMACEN');

-- ============================================================
-- Seguridad: solo usuarios con cuenta (correo/clave creados en
-- Supabase > Authentication > Users) pueden leer y escribir.
-- No hay registro abierto: nadie más puede crearse una cuenta.
-- ============================================================
alter table sedes enable row level security;
alter table bloques enable row level security;
alter table despachos enable row level security;
alter table catalogos enable row level security;
alter table metricas enable row level security;

create policy "solo autenticados sedes" on sedes
  for all to authenticated using (true) with check (true);
create policy "solo autenticados bloques" on bloques
  for all to authenticated using (true) with check (true);
create policy "solo autenticados despachos" on despachos
  for all to authenticated using (true) with check (true);
create policy "solo autenticados catalogos" on catalogos
  for all to authenticated using (true) with check (true);
create policy "solo autenticados metricas" on metricas
  for all to authenticated using (true) with check (true);
