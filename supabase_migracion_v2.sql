-- Migración v2: agrega un celular por persona (usado en Movimiento de
-- mercadería: uno para "Trasladado por" y otro para "Recibe en destino").
-- Es aditiva y segura de correr más de una vez (IF NOT EXISTS).

ALTER TABLE despachos ADD COLUMN IF NOT EXISTS celular_persona1 text;
ALTER TABLE despachos ADD COLUMN IF NOT EXISTS celular_persona2 text;
