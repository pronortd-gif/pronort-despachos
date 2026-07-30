import React, { useState, useMemo } from "react";
import { TIPOS, sedeLabel, tituloConCelular, personasConCelular, mostrarComprobante } from "./constants";
import { Icon, Badge, Modal, ConfirmarEliminar, ToastDeshacer, SelectorEstado } from "./ui";
import { useDeshacer } from "./campos";

export function VistaHistorial({ despachos, onEditar, onEliminar, onCambiarEstado, sedes, oscuro }) {
  const [filtroTexto, setFiltroTexto] = useState("");
  const [filtroFecha, setFiltroFecha] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("");
  const [filtroSede, setFiltroSede] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("");
  const [confirmarBorrado, setConfirmarBorrado] = useState(null);
  const { pendiente, disparar, limpiar } = useDeshacer();

  const filtrados = useMemo(() => despachos
    .filter((d) => !filtroFecha || d.fecha === filtroFecha)
    .filter((d) => !filtroTipo || d.tipo === filtroTipo)
    .filter((d) => !filtroSede || d.tienda === filtroSede || d.sedeDestino === filtroSede)
    .filter((d) => !filtroEstado || (d.estado || "pendiente") === filtroEstado)
    .filter((d) => {
      if (!filtroTexto) return true;
      const q = filtroTexto.toLowerCase();
      return [d.cliente, d.proveedor, d.tienda, d.sedeDestino, d.persona1, d.persona2, d.comprobante, d.numGuia, d.direccion, d.celular, d.celular1, d.celular2]
        .some((campo) => (campo || "").toLowerCase().indexOf(q) !== -1);
    })
    .sort((a, b) => (a.fecha < b.fecha ? 1 : -1)),
  [despachos, filtroTexto, filtroFecha, filtroTipo, filtroSede, filtroEstado]);

  // Estrictamente "pendiente" (no "distinto de entregado"), para que
  // este botón masivo nunca toque los que ya están en "no entregado".
  const pendientesFiltrados = filtrados.filter((d) => (d.estado || "pendiente") === "pendiente");

  const ejecutarBorrado = () => {
    if (!confirmarBorrado) return;
    onEliminar(confirmarBorrado.id);
    disparar("Despacho eliminado.", () => {});
    setConfirmarBorrado(null);
  };

  const limpiarFiltros = () => { setFiltroTexto(""); setFiltroFecha(""); setFiltroTipo(""); setFiltroSede(""); setFiltroEstado(""); };
  const hayFiltros = filtroTexto || filtroFecha || filtroTipo || filtroSede || filtroEstado;

  return (
    <div className="view-in">
      <div style={{ display: "flex", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
        <input placeholder="Buscar cliente, proveedor, persona, comprobante, dirección..." value={filtroTexto} onChange={(e) => setFiltroTexto(e.target.value)} style={{ flex: 1, minWidth: 200 }} />
        <input type="date" value={filtroFecha} onChange={(e) => setFiltroFecha(e.target.value)} style={{ width: 165 }} aria-label="Filtrar por fecha" />
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
        <select value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)} aria-label="Filtrar por tipo" style={{ minWidth: 150 }}>
          <option value="">Todos los tipos</option>
          {Object.keys(TIPOS).map((k) => <option key={k} value={k}>{TIPOS[k].label}</option>)}
        </select>
        <select value={filtroSede} onChange={(e) => setFiltroSede(e.target.value)} aria-label="Filtrar por sede" style={{ minWidth: 160 }}>
          <option value="">Todas las sedes</option>
          {sedes.map((s) => <option key={s.codigo} value={s.codigo}>{s.codigo} · {s.nombre}</option>)}
        </select>
        <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)} aria-label="Filtrar por estado" style={{ minWidth: 145 }}>
          <option value="">Todo estado</option>
          <option value="pendiente">Pendientes</option>
          <option value="entregado">Entregados</option>
          <option value="no_entregado">No entregados</option>
        </select>
        {hayFiltros && <button onClick={limpiarFiltros} style={{ fontSize: 13 }}><Icon name="x" size={13} /> Limpiar</button>}
        <div style={{ flex: 1 }} />
        {pendientesFiltrados.length > 0 && (
          <button onClick={() => pendientesFiltrados.forEach((d) => onCambiarEstado(d.id, "entregado"))} style={{ fontSize: 13 }}>
            <Icon name="checks" size={14} /> Marcar {pendientesFiltrados.length} como entregados
          </button>
        )}
      </div>

      <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 8 }}>{filtrados.length} resultados</p>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "0.5px solid var(--border)" }}>
              <th style={{ textAlign: "left", padding: "6px 8px" }}>Fecha</th>
              <th style={{ textAlign: "left", padding: "6px 8px" }}>Tipo</th>
              <th style={{ textAlign: "left", padding: "6px 8px" }}>Detalle</th>
              <th style={{ textAlign: "left", padding: "6px 8px" }}>Sede</th>
              <th style={{ textAlign: "left", padding: "6px 8px" }}>Personas</th>
              <th style={{ textAlign: "left", padding: "6px 8px" }}>Documento</th>
              <th style={{ textAlign: "left", padding: "6px 8px" }}>Estado</th>
              <th style={{ padding: "6px 8px" }}></th>
            </tr>
          </thead>
          <tbody>
            {filtrados.map((d) => {
              const t = TIPOS[d.tipo] || TIPOS.VENTA;
              const titulo = tituloConCelular(d, sedes);
              const personas = personasConCelular(d);
              const comprobante = mostrarComprobante(d.comprobante);
              return (
                <tr key={d.id} style={{ borderBottom: "0.5px solid var(--border)" }}>
                  <td style={{ padding: "6px 8px", whiteSpace: "nowrap" }}>{d.fecha}</td>
                  <td style={{ padding: "6px 8px" }}>
                    <Badge color={oscuro ? t.dark : t.color} bg={oscuro ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)"}>{t.label}</Badge>
                  </td>
                  <td style={{ padding: "6px 8px", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={titulo}>{titulo}</td>
                  <td style={{ padding: "6px 8px", whiteSpace: "nowrap" }}>
                    {d.tipo === "MOV_MERCADERIA"
                      ? (d.tienda || "—") + " → " + (d.sedeDestino || "—")
                      : (d.tienda ? sedeLabel(d.tienda, sedes) : "—")}
                  </td>
                  <td style={{ padding: "6px 8px", fontSize: 12, maxWidth: 200 }}>
                    {personas.length === 0 ? "—" : personas.map((p) => (
                      <span key={p.label} style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={p.texto}>
                        <span style={{ color: "var(--text-secondary)" }}>{p.label}:</span> {p.texto}
                      </span>
                    ))}
                  </td>
                  <td style={{ padding: "6px 8px" }}>{comprobante || "—"}</td>
                  <td style={{ padding: "6px 8px" }}>
                    <SelectorEstado estado={d.estado} onCambiar={(e) => onCambiarEstado(d.id, e)} compacto />
                  </td>
                  <td style={{ padding: "6px 8px", whiteSpace: "nowrap" }}>
                    <button onClick={() => onEditar(d)} aria-label="Editar" style={{ width: 30, height: 30, padding: 0, marginRight: 4 }}><Icon name="edit" size={13} /></button>
                    <button onClick={() => setConfirmarBorrado(d)} aria-label="Eliminar" style={{ width: 30, height: 30, padding: 0 }}><Icon name="trash" size={13} /></button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {pendiente && <ToastDeshacer mensaje={pendiente.mensaje} onDeshacer={() => { pendiente.deshacerFn(); limpiar(); }} onExpirar={limpiar} />}

      {confirmarBorrado && (
        <Modal title="Eliminar despacho" onClose={() => setConfirmarBorrado(null)}>
          <ConfirmarEliminar
            titulo={tituloConCelular(confirmarBorrado, sedes)}
            detalle={confirmarBorrado.fecha}
            onConfirm={ejecutarBorrado} onCancel={() => setConfirmarBorrado(null)}
          />
        </Modal>
      )}
    </div>
  );
}
