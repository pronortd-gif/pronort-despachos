import React, { useState, useRef } from "react";
import { TIPOS, BRAND, CAPACIDAD_BLOQUE, sedeLabel, formatFechaLarga, etiquetaBloque, tituloDespacho, fechaMasDias } from "./constants";
import { Icon, Badge, Modal, ConfirmarEliminar, ToastDeshacer } from "./ui";
import { useDeshacer } from "./campos";
import { FormDespacho } from "./FormDespacho";
import { FormBloque } from "./FormBloque";
import { TarjetaDespacho } from "./TarjetaDespacho";
import { VistaExportable } from "./VistaExportable";

function BarraCapacidad({ cantidad }) {
  const ratio = Math.min(1, cantidad / CAPACIDAD_BLOQUE);
  const color = cantidad >= CAPACIDAD_BLOQUE ? "var(--brand-accent)" : cantidad >= CAPACIDAD_BLOQUE - 1 ? "var(--warn)" : "var(--ok)";
  return (
    <div style={{ width: 54, height: 5, borderRadius: 3, background: "var(--surface-1)", overflow: "hidden" }}>
      <div style={{ width: (ratio * 100) + "%", height: "100%", background: color, borderRadius: 3, transition: "width 0.25s ease, background 0.25s ease" }} />
    </div>
  );
}

export function VistaDia({
  fecha, onVolver, bloques, cargandoBloques,
  onGuardarBloque, onEliminarBloque, onCopiarHorarios, onCrearHorarioRapido,
  despachos, onGuardarDespacho, onEliminarDespacho, onCambiarEstado, onActualizarOrden,
  oscuro, catalogos, sedes,
}) {
  const [modal, setModal] = useState(null); // { tipo, data }
  const cerrarModal = () => setModal(null);
  const { pendiente, disparar, limpiar } = useDeshacer();
  const exportRef = useRef(null);
  const [exportando, setExportando] = useState(false);
  const [aviso, setAviso] = useState("");

  const despachosDia = despachos.filter((d) => d.fecha === fecha);

  const conteoPorBloqueId = {};
  despachosDia.forEach((d) => { if (d.bloqueId) conteoPorBloqueId[d.bloqueId] = (conteoPorBloqueId[d.bloqueId] || 0) + 1; });

  const sinHorario = despachosDia.filter((d) => !d.bloqueId || !bloques.some((b) => b.id === d.bloqueId));

  const guardarDespacho = (d) => { onGuardarDespacho(d); cerrarModal(); };
  const guardarBloque = (b) => { onGuardarBloque(b); cerrarModal(); };

  const pedirEliminarDespacho = (d) => setModal({ tipo: "confirmar-despacho", data: d });
  const pedirEliminarBloque = (b) => setModal({ tipo: "confirmar-bloque", data: b, enUso: conteoPorBloqueId[b.id] || 0 });

  const ejecutarBorrado = () => {
    if (!modal) return;
    if (modal.tipo === "confirmar-despacho") {
      const d = modal.data;
      onEliminarDespacho(d.id);
      disparar("Despacho \"" + tituloDespacho(d, sedes) + "\" eliminado.", () => onGuardarDespacho(d));
    } else {
      const b = modal.data;
      onEliminarBloque(b.id);
      disparar("Horario " + etiquetaBloque(b) + " eliminado.", () => onGuardarBloque(b));
    }
    cerrarModal();
  };

  // Orden estable dentro de un grupo: primero por "orden" manual, y
  // si empatan (o nunca se reordenaron), por fecha de creación, para
  // que el orden no salte solo entre recargas.
  const ordenarGrupo = (items) => items.slice().sort((a, b) => {
    if ((a.orden || 0) !== (b.orden || 0)) return (a.orden || 0) - (b.orden || 0);
    return (a.creadoEn || "").localeCompare(b.creadoEn || "");
  });

  const moverDespacho = (items, id, direccion) => {
    const ordenados = ordenarGrupo(items);
    const i = ordenados.findIndex((d) => d.id === id);
    const j = i + direccion;
    if (i === -1 || j < 0 || j >= ordenados.length) return;
    // Se reasigna el "orden" de TODO el grupo como una secuencia limpia
    // 0..n-1 (no solo el de los dos elementos movidos). Si varios
    // despachos todavía comparten el valor por defecto (0), intercambiar
    // solo el par movido podía hacer que uno "saltara" al final de la
    // lista en vez de moverse una sola posición, porque el resto del
    // grupo quedaba con una secuencia inconsistente.
    const reordenados = ordenados.slice();
    const tmp = reordenados[i];
    reordenados[i] = reordenados[j];
    reordenados[j] = tmp;
    reordenados.forEach((d, idx) => {
      if ((d.orden || 0) !== idx) onActualizarOrden(d.id, idx);
    });
  };

  const marcarBloqueCompleto = (bloqueId, entregado) => {
    // "no_entregado" nunca se toca aquí: es una decisión explícita
    // aparte, no algo que un check masivo deba poder revertir por error.
    despachosDia.filter((d) => d.bloqueId === bloqueId && d.estado !== "no_entregado").forEach((d) => {
      const nuevoEstado = entregado ? "entregado" : "pendiente";
      if (d.estado !== nuevoEstado) onCambiarEstado(d.id, nuevoEstado);
    });
  };

  const copiarDelDiaAnterior = async () => {
    const resultado = await onCopiarHorarios(fechaMasDias(fecha, -1), fecha);
    if (resultado && resultado.copiados > 0) setAviso(resultado.copiados + " horario(s) copiados del día anterior.");
    else setAviso("El día anterior no tiene horarios para copiar.");
  };

  const totalDia = despachosDia.length;
  const entregados = despachosDia.filter((d) => d.estado === "entregado").length;
  const noEntregados = despachosDia.filter((d) => d.estado === "no_entregado").length;
  const totalPorTipo = {};
  Object.keys(TIPOS).forEach((k) => { totalPorTipo[k] = despachosDia.filter((d) => d.tipo === k).length; });

  async function cargarLibreria() {
    if (window.htmlToImage) return;
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/html-to-image/1.11.11/html-to-image.min.js";
    await new Promise((resolve, reject) => { s.onload = resolve; s.onerror = reject; document.body.appendChild(s); });
  }
  const generarPng = async () => {
    await cargarLibreria();
    await new Promise((r) => setTimeout(r, 150));
    return window.htmlToImage.toBlob(exportRef.current, { backgroundColor: "#ffffff", pixelRatio: 2 });
  };
  const descargarImagen = async () => {
    setExportando(true); setAviso("");
    try {
      const blob = await generarPng();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.download = "programacion-" + fecha + ".png";
      link.href = url; link.click();
      URL.revokeObjectURL(url);
    } catch (e) { setAviso("No se pudo generar la imagen."); }
    finally { setExportando(false); }
  };
  const copiarImagen = async () => {
    setExportando(true); setAviso("");
    try {
      const blob = await generarPng();
      if (navigator.clipboard && window.ClipboardItem) {
        await navigator.clipboard.write([new window.ClipboardItem({ "image/png": blob })]);
        setAviso("Imagen copiada. Pégala en WhatsApp.");
      } else {
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.download = "programacion-" + fecha + ".png";
        link.href = url; link.click();
        URL.revokeObjectURL(url);
        setAviso("Tu navegador no permite copiar imágenes: se descargó.");
      }
    } catch (e) { setAviso("No se pudo copiar. Usa el botón de descargar."); }
    finally { setExportando(false); }
  };

  const renderGrupo = (titulo, subtitulo, itemsSinOrdenar, bloque) => {
    const items = ordenarGrupo(itemsSinOrdenar);
    const elegibles = items.filter((d) => d.estado !== "no_entregado");
    return (
    <div key={bloque ? bloque.id : "sin-horario"} style={{ marginBottom: 20 }}>
      <div className="bloque-head">
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", minWidth: 0 }}>
          <span className="bloque-rango"><Icon name="clock" size={14} /> {titulo}</span>
          {subtitulo && <span style={{ fontWeight: 500, fontSize: 14 }}>{subtitulo}</span>}
          <Badge color="var(--text-secondary)" bg="var(--surface-1)">{items.length}</Badge>
          {bloque && <BarraCapacidad cantidad={items.length} />}
          {bloque && items.length >= CAPACIDAD_BLOQUE && (
            <span style={{ fontSize: 11, color: "var(--brand-accent)", display: "inline-flex", alignItems: "center", gap: 3 }}>
              <Icon name="alert-triangle" size={12} /> lleno
            </span>
          )}
        </div>
        {bloque && (
          <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
            {elegibles.length > 0 && (
              <label style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, color: "var(--text-secondary)", cursor: "pointer", marginRight: 4 }} title="No afecta a los que ya están en 'No entregado'">
                <input
                  type="checkbox"
                  checked={elegibles.every((d) => d.estado === "entregado")}
                  onChange={(e) => marcarBloqueCompleto(bloque.id, e.target.checked)}
                />
                todo
              </label>
            )}
            <button
              onClick={() => setModal({ tipo: "despacho", data: {}, bloqueId: bloque.id })}
              style={{ height: 32, padding: "0 10px", fontSize: 13, borderColor: "var(--brand-accent)", color: "var(--brand-accent)" }}
            >
              <Icon name="plus" size={14} /> Agregar despacho
            </button>
            <button onClick={() => setModal({ tipo: "bloque", data: bloque })} aria-label="Editar horario" style={{ width: 32, height: 32, padding: 0 }}><Icon name="edit" size={14} /></button>
            <button onClick={() => pedirEliminarBloque(bloque)} aria-label="Eliminar horario" style={{ width: 32, height: 32, padding: 0 }}><Icon name="trash" size={14} /></button>
          </div>
        )}
      </div>
      {items.length === 0 ? (
        <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "0 0 0 24px" }}>Sin despachos en este horario.</p>
      ) : (
        items.map((d, i) => (
          <TarjetaDespacho
            key={d.id} despacho={d}
            onEditar={(desp) => setModal({ tipo: "despacho", data: desp })}
            onEliminar={pedirEliminarDespacho}
            onCambiarEstado={onCambiarEstado}
            onSubir={() => moverDespacho(items, d.id, -1)}
            onBajar={() => moverDespacho(items, d.id, 1)}
            esPrimero={i === 0}
            esUltimo={i === items.length - 1}
            oscuro={oscuro} sedes={sedes}
          />
        ))
      )}
    </div>
    );
  };

  return (
    <div className="view-in">
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10, flexWrap: "wrap" }}>
        <button onClick={onVolver} aria-label="Volver al calendario" style={{ padding: "0 12px" }}><Icon name="arrow-left" size={15} /> Calendario</button>
        <div style={{ flex: 1 }} />
        <button onClick={copiarImagen} disabled={exportando}><Icon name="copy" /> {exportando ? "Generando..." : "Copiar imagen"}</button>
        <button onClick={descargarImagen} disabled={exportando} aria-label="Descargar imagen" style={{ width: 40, padding: 0 }}><Icon name="download" /></button>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        <button onClick={() => setModal({ tipo: "bloque", data: {} })} style={{ borderColor: "var(--brand-accent-2)", color: "var(--brand-accent-2)" }}>
          <Icon name="clock-plus" size={15} /> Nuevo horario de salida
        </button>
        {bloques.length === 0 && (
          <button onClick={copiarDelDiaAnterior}>
            <Icon name="copy" size={15} /> Copiar horarios del día anterior
          </button>
        )}
      </div>

      {aviso && <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: "0 0 12px" }}>{aviso}</p>}

      <div style={{ background: "var(--surface-2)", padding: "1rem", borderRadius: 12, border: "0.5px solid var(--border)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <div style={{ width: 4, height: 22, background: BRAND.rojo, borderRadius: 2 }} />
          <p style={{ margin: 0, fontSize: 18, fontWeight: 500, textTransform: "capitalize" }}>{formatFechaLarga(fecha)}</p>
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 10, marginBottom: 16, flexWrap: "wrap" }}>
          <Badge color="var(--text-primary)" bg="var(--surface-1)">{totalDia} despachos</Badge>
          {totalDia > 0 && (
            <Badge color={entregados === totalDia ? "var(--ok)" : "var(--text-secondary)"} bg={entregados === totalDia ? "var(--ok-bg)" : "var(--surface-1)"}>
              <Icon name="check" size={12} /> {entregados}/{totalDia} entregados
            </Badge>
          )}
          {noEntregados > 0 && (
            <Badge color="var(--brand-accent)" bg="var(--warn-bg)">
              <Icon name="x" size={12} /> {noEntregados} no entregado{noEntregados === 1 ? "" : "s"}
            </Badge>
          )}
          {Object.keys(totalPorTipo).filter((k) => totalPorTipo[k] > 0).map((k) => (
            <Badge key={k} color={oscuro ? TIPOS[k].dark : TIPOS[k].color} bg={oscuro ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)"}>{TIPOS[k].label}: {totalPorTipo[k]}</Badge>
          ))}
        </div>

        {cargandoBloques && <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Cargando horarios...</p>}

        {!cargandoBloques && bloques.length === 0 && (
          <div style={{ textAlign: "center", padding: "2rem 1rem", color: "var(--text-secondary)" }}>
            <Icon name="clock" size={28} />
            <p style={{ fontSize: 14, margin: "8px 0 0" }}>Aún no hay horarios de salida para este día.</p>
            <p style={{ fontSize: 13, margin: "2px 0 0", color: "var(--text-muted)" }}>Créalos arriba, o copia los del día anterior.</p>
          </div>
        )}

        {bloques.map((b) => renderGrupo(
          b.inicio + " – " + b.fin,
          b.nombre || "",
          despachosDia.filter((d) => d.bloqueId === b.id),
          b
        ))}

        {sinHorario.length > 0 && renderGrupo("Sin horario asignado", "", sinHorario, null)}
      </div>

      <div style={{ position: "absolute", left: -99999, top: 0, pointerEvents: "none" }} aria-hidden="true">
        <div ref={exportRef}>
          <VistaExportable fecha={fecha} bloques={bloques} despachos={despachosDia} sedes={sedes} />
        </div>
      </div>

      {pendiente && <ToastDeshacer mensaje={pendiente.mensaje} onDeshacer={() => { pendiente.deshacerFn(); limpiar(); }} onExpirar={limpiar} />}

      {modal && modal.tipo === "despacho" && (
        <Modal title={modal.data.id ? "Editar despacho" : "Nuevo despacho"} onClose={cerrarModal} wide>
          <FormDespacho
            inicial={modal.data.id ? modal.data : null}
            bloqueIdInicial={modal.bloqueId}
            bloques={bloques}
            fecha={fecha}
            onGuardar={guardarDespacho}
            onCancelar={cerrarModal}
            catalogos={catalogos}
            sedes={sedes}
            todosDespachos={despachos}
            oscuro={oscuro}
            conteoPorBloqueId={conteoPorBloqueId}
            onCrearHorario={(datosHorario) => onCrearHorarioRapido(fecha, datosHorario)}
          />
        </Modal>
      )}
      {modal && modal.tipo === "bloque" && (
        <Modal title={modal.data.id ? "Editar horario de salida" : "Nuevo horario de salida"} onClose={cerrarModal}>
          <FormBloque
            inicial={modal.data.id ? modal.data : null}
            onGuardar={guardarBloque}
            onGuardarYSeguir={onGuardarBloque}
            onCancelar={cerrarModal}
            bloquesExistentes={bloques}
          />
        </Modal>
      )}
      {modal && modal.tipo === "confirmar-despacho" && (
        <Modal title="Eliminar despacho" onClose={cerrarModal}>
          <ConfirmarEliminar
            titulo={tituloDespacho(modal.data, sedes)}
            detalle={sedeLabel(modal.data.tienda, sedes)}
            onConfirm={ejecutarBorrado} onCancel={cerrarModal}
          />
        </Modal>
      )}
      {modal && modal.tipo === "confirmar-bloque" && (
        <Modal title="Eliminar horario de salida" onClose={cerrarModal}>
          <ConfirmarEliminar
            titulo={etiquetaBloque(modal.data) + " (" + modal.data.inicio + "–" + modal.data.fin + ")"}
            detalle={modal.enUso > 0 ? modal.enUso + " despacho(s) quedarán sin horario asignado, pero no se borran." : "Este horario no tiene despachos."}
            onConfirm={ejecutarBorrado} onCancel={cerrarModal}
          />
        </Modal>
      )}
    </div>
  );
}
