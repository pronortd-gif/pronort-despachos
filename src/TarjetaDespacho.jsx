import React from "react";
import { TIPOS, CONFIG_TIPO, sedeLabel, tituloConCelular, personasConCelular, mostrarComprobante } from "./constants";
import { Icon, Badge, SelectorEstado, useCambioReciente } from "./ui";

export function TarjetaDespacho({ despacho, onEditar, onEliminar, onCambiarEstado, onSubir, onBajar, esPrimero, esUltimo, indice, oscuro, sedes }) {
  const t = TIPOS[despacho.tipo] || TIPOS.VENTA;
  const cfg = CONFIG_TIPO[despacho.tipo] || CONFIG_TIPO.VENTA;
  const color = oscuro ? t.dark : t.color;
  const entregado = despacho.estado === "entregado";
  const noEntregado = despacho.estado === "no_entregado";

  // Un halo breve alrededor de la tarjeta al cambiar de estado, en el
  // color de ese estado. Se hace con "outline" y no con una animación
  // para que no pelee con la animación de entrada (card-in): si ambas
  // ocuparan la propiedad "animation", al terminar el halo la tarjeta
  // volvería a entrar deslizándose.
  const recienCambiado = useCambioReciente(despacho.estado);
  const colorHalo = entregado ? "var(--ok)" : noEntregado ? "var(--brand-accent)" : "var(--text-secondary)";
  const bordeFino = "0.5px solid " + ((entregado || noEntregado) ? "var(--border)" : color);

  // Escalonado de entrada, topado a 8: con un horario de 15 despachos,
  // esperar 15 escalones para verlos todos sería una molestia diaria.
  const retardo = Math.min(indice || 0, 8) * 28;
  const titulo = tituloConCelular(despacho, sedes);
  const personas = personasConCelular(despacho);
  const comprobante = mostrarComprobante(despacho.comprobante);
  const guia = mostrarComprobante(despacho.numGuia);

  return (
    <div
      className="card-in"
      style={{
        background: "var(--surface-2)",
        // Los tres lados van por separado en vez de usar el atajo
        // "border": mezclarlo con "borderLeft" hace que, al re-renderizar,
        // el atajo pueda pisar el borde izquierdo — que es justo el que
        // lleva el color del tipo de despacho.
        borderTop: bordeFino, borderRight: bordeFino, borderBottom: bordeFino,
        borderLeft: "3px solid " + (noEntregado ? "var(--brand-accent)" : color),
        borderRadius: 10, padding: "0.65rem 0.9rem", marginBottom: 8,
        opacity: entregado ? 0.72 : 1,
        animationDelay: retardo + "ms",
        outline: "2px solid " + (recienCambiado ? colorHalo : "transparent"),
        outlineOffset: 2,
        transition: "opacity 0.2s ease, border-color 0.2s ease, outline-color 0.35s ease",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "center" }}>
          <button onClick={onSubir} disabled={esPrimero} aria-label="Subir en el orden" style={{ width: 26, height: 22, padding: 0 }}><Icon name="chevron-up" size={13} /></button>
          <SelectorEstado estado={despacho.estado} onCambiar={(e) => onCambiarEstado(despacho.id, e)} />
          <button onClick={onBajar} disabled={esUltimo} aria-label="Bajar en el orden" style={{ width: 26, height: 22, padding: 0 }}><Icon name="chevron-down" size={13} /></button>
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4, flexWrap: "wrap" }}>
            <Badge color={color} bg={oscuro ? "rgba(255,255,255,0.08)" : "rgba(189,11,59,0.08)"}>
              <Icon name={t.icono} size={12} /> {t.label}
            </Badge>
            {despacho.cobra && despacho.monto && <Badge color="var(--warn)" bg="var(--warn-bg)">S/ {Number(despacho.monto).toFixed(2)}</Badge>}
            {entregado && <Badge color="var(--ok)" bg="var(--ok-bg)"><Icon name="check" size={12} /> Entregado</Badge>}
            {noEntregado && <Badge color="var(--brand-accent)" bg="var(--warn-bg)"><Icon name="x" size={12} /> No entregado</Badge>}
          </div>

          <p style={{ margin: 0, fontWeight: 500, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={titulo}>{titulo}</p>

          {/* Recorrido: para movimientos se muestra origen y destino */}
          {despacho.tipo === "MOV_MERCADERIA" ? (
            <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--text-secondary)" }}>
              {sedeLabel(despacho.tienda, sedes)} <Icon name="arrow-right" size={12} /> {sedeLabel(despacho.sedeDestino, sedes)}
            </p>
          ) : (
            despacho.tienda && <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--text-secondary)" }}>{sedeLabel(despacho.tienda, sedes)}</p>
          )}

          {personas.map((p) => (
            <p key={p.label} style={{ margin: "4px 0 0", fontSize: 12, color: "var(--text-secondary)", display: "flex", gap: 4, minWidth: 0 }}>
              <span style={{ opacity: 0.75, flexShrink: 0 }}>{p.label}:</span>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }} title={p.texto}>{p.texto}</span>
            </p>
          ))}

          {despacho.direccion && (
            <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--text-secondary)" }}>
              <Icon name="map-pin" size={13} /> {despacho.direccion}
              {despacho.mapsUrl && <a href={despacho.mapsUrl} target="_blank" rel="noopener noreferrer" aria-label="Abrir ubicación en Google Maps" style={{ marginLeft: 6 }}><Icon name="external-link" size={12} /></a>}
            </p>
          )}
          {!despacho.direccion && despacho.mapsUrl && (
            <p style={{ margin: "4px 0 0", fontSize: 12 }}>
              <a href={despacho.mapsUrl} target="_blank" rel="noopener noreferrer"><Icon name="map-pin" size={13} /> Ver ubicación</a>
            </p>
          )}

          {(comprobante || guia) && (
            <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--text-secondary)" }}>
              <Icon name="file" size={13} />
              {comprobante ? " " + comprobante : ""}
              {guia ? (comprobante ? " · Guía " : " Guía ") + guia : ""}
            </p>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <button onClick={() => onEditar(despacho)} aria-label="Editar" style={{ width: 30, height: 30, padding: 0 }}><Icon name="edit" size={15} /></button>
          <button onClick={() => onEliminar(despacho)} aria-label="Eliminar" style={{ width: 30, height: 30, padding: 0 }}><Icon name="trash" size={15} /></button>
        </div>
      </div>
    </div>
  );
}
