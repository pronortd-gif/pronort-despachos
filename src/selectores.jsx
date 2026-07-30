import React from "react";
import { TIPOS, CAPACIDAD_BLOQUE, horaLegible } from "./constants";
import { Icon } from "./ui";

export function SelectorTipo({ tipoSeleccionado, onSeleccionarTipo, oscuro }) {
  return (
    <div className="tipo-picker" role="radiogroup" aria-label="Tipo de despacho">
      {Object.keys(TIPOS).map((clave) => {
        const activo = tipoSeleccionado === clave;
        const color = oscuro ? TIPOS[clave].dark : TIPOS[clave].color;
        return (
          <button
            key={clave}
            type="button"
            role="radio"
            aria-checked={activo}
            className="tipo-chip"
            data-active={activo}
            style={activo ? { background: color, borderColor: color } : { color: color, borderColor: color + "55" }}
            onClick={() => onSeleccionarTipo(clave)}
          >
            <Icon name={TIPOS[clave].icono} size={15} />
            {TIPOS[clave].label}
          </button>
        );
      })}
    </div>
  );
}

// Tarjetas de horario: muestran hora (en formato 12h), nombre (si
// tiene) y ocupación. Se selecciona por ID, no por nombre, para que
// dos horarios sin nombre nunca se confundan entre sí.
//
// Antes el nombre y el contador de despachos se mostraban pegados en
// el mismo texto ("nombre · cantidad"). Si el horario no tenía nombre,
// solo quedaba el número suelto y parecía que el nombre era "0". Ahora
// van en líneas separadas y el contador siempre lleva la palabra
// "despacho(s)" al lado, para que nunca se confunda con el nombre.
export function SelectorHorario({ bloques, bloqueIdSeleccionado, onSeleccionarBloque, conteoPorBloqueId }) {
  if (!bloques || bloques.length === 0) {
    return <p style={{ fontSize: 13, color: "var(--text-muted)" }}>No hay horarios creados para este día.</p>;
  }
  return (
    <div className="horario-picker">
      {bloques.map((b) => {
        const activo = bloqueIdSeleccionado === b.id;
        const cantidad = (conteoPorBloqueId && conteoPorBloqueId[b.id]) || 0;
        const lleno = cantidad >= CAPACIDAD_BLOQUE;
        return (
          <button
            key={b.id}
            type="button"
            className="horario-chip"
            data-active={activo}
            onClick={() => onSeleccionarBloque(b.id)}
          >
            <span className="hora">{horaLegible(b.inicio)} – {horaLegible(b.fin)}</span>
            {b.nombre ? <span className="nombre">{b.nombre}</span> : null}
            <span className="nombre" style={lleno ? { color: "var(--brand-accent)" } : null}>
              {cantidad} despacho{cantidad === 1 ? "" : "s"}{lleno ? " · lleno" : ""}
            </span>
          </button>
        );
      })}
    </div>
  );
}
