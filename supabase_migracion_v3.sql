-- Migración v3: agrega el orden manual de despachos dentro de un mismo
-- horario/bloque (para cuando varios salen juntos en el mismo carro).
-- Aditiva y segura de correr más de una vez.

ALTER TABLE despachos ADD COLUMN IF NOT EXISTS orden integer DEFAULT 0;
