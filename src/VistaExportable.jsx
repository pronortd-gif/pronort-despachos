import React from "react";
import { TIPOS, BRAND, sedeLabel, formatFechaLarga, horaLegible, tituloConCelular, personasConCelular, mostrarComprobante, ordenarDespachos as ordenar } from "./constants";

export function VistaExportable({ fecha, bloques, despachos, sedes }) {
  const porBloque = bloques
    .map((b) => ({ bloque: b, items: ordenar(despachos.filter((d) => d.bloqueId === b.id)) }))
    .filter((g) => g.items.length > 0);

  const sinHorario = ordenar(despachos.filter((d) => !d.bloqueId || !bloques.some((b) => b.id === d.bloqueId)));
  const total = despachos.length;

  const renderItem = (d, i, ultimo) => {
    const t = TIPOS[d.tipo] || TIPOS.VENTA;
    const personas = personasConCelular(d);
    const comprobante = mostrarComprobante(d.comprobante);
    return (
      <div key={d.id} style={{ display: "flex", gap: 10, padding: "7px 12px 7px 16px", borderBottom: ultimo ? "none" : "1px solid #E8E9ED" }}>
        {/* Ancho fijo y sin nowrap: etiquetas largas como "Mov. mercadería"
            caen en 2 líneas en vez de ensanchar la fila entera. */}
        <span style={{ fontSize: 11, fontWeight: 700, color: "#fff", background: t.color, borderRadius: 4, padding: "2px 6px", height: "fit-content", width: 56, textAlign: "center", lineHeight: 1.2 }}>
          {t.label}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tituloConCelular(d, sedes)}</p>
          <p style={{ margin: "2px 0 0", fontSize: 12, color: "#5B6272", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {[
              d.tipo === "MOV_MERCADERIA"
                ? sedeLabel(d.tienda, sedes) + " → " + sedeLabel(d.sedeDestino, sedes)
                : (d.tienda ? sedeLabel(d.tienda, sedes) : null),
              personas.map((p) => p.label + ": " + p.texto).join(" | ") || null,
              comprobante || null,
            ].filter(Boolean).join("  |  ")}
          </p>
          {d.direccion && <p style={{ margin: "2px 0 0", fontSize: 12, color: "#5B6272", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.direccion}</p>}
        </div>
        {d.cobra && d.monto ? <span style={{ fontSize: 13, fontWeight: 700, whiteSpace: "nowrap" }}>S/ {Number(d.monto).toFixed(2)}</span> : null}
      </div>
    );
  };

  return (
    <div className="export-view">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "2px solid " + BRAND.rojo, paddingBottom: 12, marginBottom: 16 }}>
        <img src="/logo-pronort.png" alt="Pronort" style={{ height: 34, width: "auto", objectFit: "contain" }} />
        <div style={{ textAlign: "right" }}>
          <p style={{ margin: 0, fontSize: 17, fontWeight: 600, textTransform: "capitalize" }}>{formatFechaLarga(fecha)}</p>
          <p style={{ margin: "2px 0 0", fontSize: 13, color: "#5B6272" }}>{total} despacho{total === 1 ? "" : "s"} programado{total === 1 ? "" : "s"}</p>
        </div>
      </div>

      {porBloque.length === 0 && sinHorario.length === 0 && (
        <p style={{ fontSize: 14, color: "#5B6272" }}>Sin despachos programados para este día.</p>
      )}

      {porBloque.map((g) => (
        <div key={g.bloque.id} style={{ marginBottom: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, background: "#F2F3F7", borderLeft: "4px solid " + BRAND.azul, borderRadius: 6, padding: "7px 12px", marginBottom: 8 }}>
            <span style={{ fontSize: 15, fontWeight: 700, fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>{horaLegible(g.bloque.inicio)} – {horaLegible(g.bloque.fin)}</span>
            {/* La imagen tiene un ancho fijo de 740px: un nombre largo
                empujaba el contador fuera del recuadro. Se recorta. */}
            {g.bloque.nombre && (
              <span style={{ fontSize: 13, color: "#5B6272", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.bloque.nombre}</span>
            )}
            <span style={{ marginLeft: "auto", flexShrink: 0, fontSize: 12, fontWeight: 600, color: "#fff", background: BRAND.rojo, borderRadius: 20, padding: "2px 9px" }}>{g.items.length}</span>
          </div>
          {g.items.map((d, i) => renderItem(d, i, i === g.items.length - 1))}
        </div>
      ))}

      {sinHorario.length > 0 && (
        <div style={{ marginBottom: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, background: "#FAEEDA", borderLeft: "4px solid #854F0B", borderRadius: 6, padding: "7px 12px", marginBottom: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 700 }}>Sin horario asignado</span>
            <span style={{ marginLeft: "auto", fontSize: 12, fontWeight: 600, color: "#fff", background: "#854F0B", borderRadius: 20, padding: "2px 9px" }}>{sinHorario.length}</span>
          </div>
          {sinHorario.map((d, i) => renderItem(d, i, i === sinHorario.length - 1))}
        </div>
      )}
    </div>
  );
}
