-- ============================================================
-- PRONORT · Migración v4 — restricciones de integridad (CHECK)
--
-- HAY QUE EJECUTAR ESTE ARCHIVO UNA VEZ. Es el único pendiente.
-- Supabase → SQL Editor → New query → pegar todo → Run.
--
-- POR QUÉ
-- Hasta ahora el único filtro de qué se puede guardar era el formulario
-- del navegador. Pero la app habla con Supabase con la clave pública, y
-- cualquier usuario autenticado tiene escritura completa: una llamada
-- directa a la API (o un error futuro en el código) puede meter un
-- estado que no existe, un tipo inventado o un monto negativo, y nada
-- lo impediría. Estas restricciones ponen esa validación en la base,
-- que es el único sitio donde no se puede saltar.
--
-- CÓMO ESTÁ ESCRITO
-- Cada restricción se añade como NOT VALID: se aplica a todo lo que se
-- escriba de ahora en adelante, pero NO revisa las filas que ya
-- existen. Así la migración no puede fallar a medias por un dato viejo
-- raro. Al final hay un bloque opcional para validar el histórico
-- cuando quieras, y antes las consultas para ver si algo lo incumple.
-- ============================================================


-- ------------------------------------------------------------
-- PASO 1 (opcional pero recomendado) — ¿hay datos que incumplan?
-- Ejecuta solo estas consultas primero. Si todas devuelven 0, el
-- histórico está limpio y puedes validar las restricciones al final.
-- ------------------------------------------------------------
-- select count(*) as tipos_invalidos      from despachos where tipo not in ('VENTA','COMPRA','MOV_MERCADERIA');
-- select count(*) as estados_invalidos    from despachos where estado not in ('pendiente','entregado','no_entregado');
-- select count(*) as montos_negativos     from despachos where monto < 0;
-- select count(*) as horas_mal_formadas   from bloques   where inicio !~ '^[0-2][0-9]:[0-5][0-9]$' or fin !~ '^[0-2][0-9]:[0-5][0-9]$';
-- select count(*) as campos_invalidos     from catalogos where campo not in ('cliente','proveedor','responsable','celular','direccion');
-- select count(*) as lineas_invalidas     from sedes     where linea not in ('DRYWALL','ADITIVOS','ALMACEN','OTRO');
-- select count(*) as operaciones_invalidas from metricas where operacion not in ('contar','sumar','promediar','porcentaje');


-- ------------------------------------------------------------
-- PASO 2 — Añadir las restricciones
-- ------------------------------------------------------------

-- ---- despachos ----
alter table despachos drop constraint if exists despachos_tipo_valido;
alter table despachos add constraint despachos_tipo_valido
  check (tipo in ('VENTA', 'COMPRA', 'MOV_MERCADERIA')) not valid;

alter table despachos drop constraint if exists despachos_estado_valido;
alter table despachos add constraint despachos_estado_valido
  check (estado in ('pendiente', 'entregado', 'no_entregado')) not valid;

-- El monto puede ser NULL (no todos los despachos cobran), pero nunca
-- negativo. El formulario ya lo exige; esto lo hace cumplir siempre.
alter table despachos drop constraint if exists despachos_monto_no_negativo;
alter table despachos add constraint despachos_monto_no_negativo
  check (monto is null or monto >= 0) not valid;

-- Un movimiento entre sedes no puede salir y llegar a la misma.
alter table despachos drop constraint if exists despachos_origen_distinto_destino;
alter table despachos add constraint despachos_origen_distinto_destino
  check (sede_destino is null or tienda is null or sede_destino <> tienda) not valid;

-- El orden dentro de un horario es una posición, nunca negativa.
alter table despachos drop constraint if exists despachos_orden_no_negativo;
alter table despachos add constraint despachos_orden_no_negativo
  check (orden is null or orden >= 0) not valid;

-- ---- bloques (horarios) ----
-- La app guarda las horas como texto "HH:MM". Sin esto, un valor como
-- "9" o "25:99" entraría y rompería el selector y el mapa de calor.
alter table bloques drop constraint if exists bloques_horas_formato;
alter table bloques add constraint bloques_horas_formato
  check (
    inicio ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' and
    fin    ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
  ) not valid;

-- El fin siempre después del inicio: el formulario ya lo valida, pero
-- un horario invertido dejaría el mapa de calor sin franjas.
alter table bloques drop constraint if exists bloques_fin_despues_de_inicio;
alter table bloques add constraint bloques_fin_despues_de_inicio
  check (fin > inicio) not valid;

-- ---- catalogos ----
alter table catalogos drop constraint if exists catalogos_campo_valido;
alter table catalogos add constraint catalogos_campo_valido
  check (campo in ('cliente', 'proveedor', 'responsable', 'celular', 'direccion')) not valid;

-- Un valor de sugerencia vacío no sirve de nada y ensucia las listas.
alter table catalogos drop constraint if exists catalogos_valor_no_vacio;
alter table catalogos add constraint catalogos_valor_no_vacio
  check (length(trim(valor)) > 0) not valid;

-- ---- sedes ----
-- La línea define el color en los reportes; un valor fuera de la lista
-- se pinta como "OTRO" sin que nadie sepa por qué.
alter table sedes drop constraint if exists sedes_linea_valida;
alter table sedes add constraint sedes_linea_valida
  check (linea in ('DRYWALL', 'ADITIVOS', 'ALMACEN', 'OTRO')) not valid;

alter table sedes drop constraint if exists sedes_codigo_no_vacio;
alter table sedes add constraint sedes_codigo_no_vacio
  check (length(trim(codigo)) > 0) not valid;

-- ---- metricas ----
alter table metricas drop constraint if exists metricas_operacion_valida;
alter table metricas add constraint metricas_operacion_valida
  check (operacion in ('contar', 'sumar', 'promediar', 'porcentaje')) not valid;


-- ------------------------------------------------------------
-- PASO 3 (opcional) — Validar también el histórico
--
-- Ejecuta esto solo si las consultas del PASO 1 dieron todas 0. Si
-- alguna falla, te dirá qué restricción incumple algún dato viejo:
-- corrígelo y vuelve a intentarlo. No pasa nada por dejarlo sin
-- validar — las restricciones ya protegen todo lo que se escriba de
-- ahora en adelante.
-- ------------------------------------------------------------
-- alter table despachos validate constraint despachos_tipo_valido;
-- alter table despachos validate constraint despachos_estado_valido;
-- alter table despachos validate constraint despachos_monto_no_negativo;
-- alter table despachos validate constraint despachos_origen_distinto_destino;
-- alter table despachos validate constraint despachos_orden_no_negativo;
-- alter table bloques   validate constraint bloques_horas_formato;
-- alter table bloques   validate constraint bloques_fin_despues_de_inicio;
-- alter table catalogos validate constraint catalogos_campo_valido;
-- alter table catalogos validate constraint catalogos_valor_no_vacio;
-- alter table sedes     validate constraint sedes_linea_valida;
-- alter table sedes     validate constraint sedes_codigo_no_vacio;
-- alter table metricas  validate constraint metricas_operacion_valida;
