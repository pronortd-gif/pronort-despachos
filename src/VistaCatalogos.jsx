import React, { useState, useMemo, useRef } from "react";
import { CAMPOS_CATALOGO, colorLinea, capitalizarPalabras, limpiarCelular } from "./constants";
import { Icon, Modal, ConfirmarEliminar, ToastDeshacer, AvisoError } from "./ui";
import { useDeshacer } from "./campos";

function FormSede({ inicial, enUso, onGuardar, onCancelar }) {
  const [datos, setDatos] = useState(inicial || { codigo: "", nombre: "", linea: "DRYWALL" });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  // El código es la clave primaria y los despachos la referencian sin
  // "on update cascade": si la sede está en uso, Postgres rechaza el
  // cambio de código. Antes ese rechazo se descartaba y el modal se
  // cerraba igual, así que parecía que el cambio había funcionado.
  const codigoBloqueado = Boolean(inicial && enUso > 0);

  const guardar = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (guardando) return;
    if (!datos.codigo.trim() || !datos.nombre.trim()) { setError("El código y el nombre son obligatorios."); return; }
    setError("");
    setGuardando(true);
    const err = await onGuardar(Object.assign({}, datos, { codigo: datos.codigo.trim(), nombre: datos.nombre.trim() }));
    setGuardando(false);
    if (err) setError(err);
  };

  return (
    <form onSubmit={guardar} noValidate>
      <div className="form-grid form-grid-sede" style={{ marginBottom: 12 }}>
        <div>
          <label className="campo-label">Código</label>
          <input
            style={{ width: "100%", textTransform: "uppercase" }}
            value={datos.codigo}
            disabled={codigoBloqueado}
            onChange={(e) => setDatos(Object.assign({}, datos, { codigo: e.target.value.toUpperCase() }))}
            placeholder="Código"
            maxLength={6}
          />
          {codigoBloqueado && (
            <p className="campo-ayuda">
              El código no se puede cambiar: {enUso} despacho(s) ya lo usan. Puedes editar el nombre y la línea.
            </p>
          )}
        </div>
        <div>
          <label className="campo-label">Nombre de la sede</label>
          <input style={{ width: "100%" }} value={datos.nombre} onChange={(e) => setDatos(Object.assign({}, datos, { nombre: e.target.value }))} placeholder="Nombre de la sede" />
        </div>
      </div>
      <div style={{ marginBottom: 20 }}>
        <label className="campo-label">Línea</label>
        <select style={{ width: "100%" }} value={datos.linea} onChange={(e) => setDatos(Object.assign({}, datos, { linea: e.target.value }))}>
          <option value="DRYWALL">Drywall</option>
          <option value="ADITIVOS">Aditivos</option>
          <option value="ALMACEN">Almacén</option>
          <option value="OTRO">Otro</option>
        </select>
        <p className="campo-ayuda">La línea define el color con el que se distingue la sede en reportes.</p>
      </div>

      <AvisoError mensaje={error} onCerrar={() => setError("")} />

      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button type="button" onClick={onCancelar}>Cancelar</button>
        <button type="submit" disabled={guardando} style={{ borderColor: "var(--brand-accent)", color: "var(--brand-accent)" }}>
          <Icon name="check" /> {guardando ? "Guardando..." : "Guardar sede"}
        </button>
      </div>
    </form>
  );
}

export function VistaCatalogos({ catalogos, onAgregarValor, onEditarValor, onEliminarValor, sedes, onGuardarSede, onEliminarSede, despachos, oscuro }) {
  const [campoActivo, setCampoActivo] = useState("sedes");
  const [nuevo, setNuevo] = useState("");
  const [editando, setEditando] = useState(null);
  const [modal, setModal] = useState(null);
  const [error, setError] = useState("");
  const { pendiente, disparar, limpiar } = useDeshacer();
  const cerrarModal = () => setModal(null);

  const labelCampo = {
    sedes: "Sedes", cliente: "Clientes", proveedor: "Proveedores",
    responsable: "Personas", celular: "Celulares", direccion: "Direcciones",
  };
  const tabsCatalogo = ["sedes"].concat(CAMPOS_CATALOGO);

  const usosPorSede = useMemo(() => {
    const acc = {};
    (despachos || []).forEach((d) => {
      if (d.tienda) acc[d.tienda] = (acc[d.tienda] || 0) + 1;
      if (d.sedeDestino) acc[d.sedeDestino] = (acc[d.sedeDestino] || 0) + 1;
    });
    return acc;
  }, [despachos]);

  // El celular no se capitaliza (es un número); el resto sí, para que
  // no queden sugerencias duplicadas por mayúsculas/minúsculas distintas.
  const estandarizar = (v) => (campoActivo === "celular" ? limpiarCelular(v) : capitalizarPalabras(v));

  const agregar = async () => {
    const v = estandarizar(nuevo);
    if (!v) return;
    setNuevo("");
    setError(await onAgregarValor(campoActivo, v) || "");
  };

  // Enter y blur disparaban ambos el guardado, así que se enviaban dos
  // actualizaciones seguidas y la segunda buscaba un valor que ya no
  // existía. Con la bandera solo corre la primera.
  const guardandoEdicion = useRef(false);
  const guardarEdicion = async (valorViejo, valorNuevo) => {
    if (guardandoEdicion.current) return;
    guardandoEdicion.current = true;
    setEditando(null);
    const v = estandarizar(valorNuevo);
    if (v && v !== valorViejo) setError(await onEditarValor(campoActivo, valorViejo, v) || "");
    guardandoEdicion.current = false;
  };

  const ejecutarBorrado = async () => {
    if (!modal) return;
    const actual = modal;
    cerrarModal();
    setError("");
    if (actual.tipo === "confirmar-sede") {
      const s = actual.data;
      const err = await onEliminarSede(s.codigo);
      if (err) { setError(err); return; }
      disparar("Sede " + s.codigo + " eliminada.", async () => setError(await onGuardarSede(null, s) || ""));
    } else {
      const v = actual.data;
      const err = await onEliminarValor(campoActivo, v);
      if (err) { setError(err); return; }
      disparar("\"" + v + "\" eliminado.", async () => setError(await onAgregarValor(campoActivo, v) || ""));
    }
  };

  return (
    <div>
      <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 16 }}>
        Estos valores alimentan las sugerencias al llenar un despacho. Se agregan solos al escribir uno nuevo, o los gestionas aquí.
      </p>

      <AvisoError mensaje={error} onCerrar={() => setError("")} />

      <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
        {tabsCatalogo.map((c) => (
          <button
            key={c}
            onClick={() => setCampoActivo(c)}
            style={{ fontSize: 13, height: 34, padding: "0 12px", borderColor: campoActivo === c ? "var(--brand-accent)" : "var(--border)", color: campoActivo === c ? "var(--brand-accent)" : "var(--text-secondary)" }}
          >
            {labelCampo[c]} <span style={{ opacity: 0.7 }}>({c === "sedes" ? sedes.length : (catalogos[c] || []).length})</span>
          </button>
        ))}
      </div>

      <div key={campoActivo} style={{ animation: "viewIn 0.2s ease" }}>
        {campoActivo === "sedes" ? (
          <div>
            <div style={{ marginBottom: 16 }}>
              <button onClick={() => setModal({ tipo: "sede", data: {} })}><Icon name="plus" /> Nueva sede</button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {sedes.length === 0 && <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Sin sedes registradas.</p>}
              {sedes.map((s) => {
                const enUso = usosPorSede[s.codigo] || 0;
                return (
                  <div key={s.codigo} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", background: "var(--surface-1)", borderRadius: "var(--radius)" }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "#fff", background: colorLinea(s.linea, false), borderRadius: 6, padding: "3px 8px", minWidth: 42, textAlign: "center" }}>{s.codigo}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 500 }}>{s.nombre}</p>
                      <p style={{ margin: 0, fontSize: 11, color: "var(--text-secondary)" }}>{s.linea}</p>
                    </div>
                    {enUso > 0 && (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 11, color: "var(--text-secondary)" }} title="Sede en uso">
                        <Icon name="lock" size={12} /> {enUso}
                      </span>
                    )}
                    <button onClick={() => setModal({ tipo: "sede", data: s, enUso })} aria-label="Editar sede" style={{ width: 28, height: 28, padding: 0 }}><Icon name="edit" size={13} /></button>
                    <button onClick={() => setModal({ tipo: "confirmar-sede", data: s, enUso })} aria-label="Eliminar sede" style={{ width: 28, height: 28, padding: 0 }}><Icon name="trash" size={13} /></button>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div>
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              <input style={{ flex: 1 }} value={nuevo} onChange={(e) => setNuevo(e.target.value)} placeholder={"Nuevo valor para " + labelCampo[campoActivo].toLowerCase()} onKeyDown={(e) => e.key === "Enter" && agregar()} />
              <button onClick={agregar}><Icon name="plus" /> Agregar</button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {(catalogos[campoActivo] || []).length === 0 && <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Sin valores guardados todavía.</p>}
              {(catalogos[campoActivo] || []).map((v) => (
                <div key={v} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", background: "var(--surface-1)", borderRadius: "var(--radius)" }}>
                  {editando === v ? (
                    <input autoFocus defaultValue={v} style={{ flex: 1 }} onKeyDown={(e) => e.key === "Enter" && guardarEdicion(v, e.target.value)} onBlur={(e) => guardarEdicion(v, e.target.value)} />
                  ) : (
                    <span style={{ flex: 1, fontSize: 13 }}>{v}</span>
                  )}
                  <button onClick={() => setEditando(editando === v ? null : v)} aria-label="Editar" style={{ width: 28, height: 28, padding: 0 }}><Icon name="edit" size={13} /></button>
                  <button onClick={() => setModal({ tipo: "confirmar-valor", data: v })} aria-label="Eliminar" style={{ width: 28, height: 28, padding: 0 }}><Icon name="trash" size={13} /></button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {pendiente && <ToastDeshacer mensaje={pendiente.mensaje} onDeshacer={() => { pendiente.deshacerFn(); limpiar(); }} onExpirar={limpiar} />}

      {modal && modal.tipo === "sede" && (
        <Modal title={modal.data.codigo ? "Editar sede" : "Nueva sede"} onClose={cerrarModal}>
          <FormSede
            inicial={modal.data.codigo ? modal.data : null}
            enUso={modal.enUso || 0}
            onGuardar={async (s) => {
              const err = await onGuardarSede(modal.data.codigo || null, s);
              if (err) return err;
              cerrarModal();
              return "";
            }}
            onCancelar={cerrarModal}
          />
        </Modal>
      )}
      {modal && modal.tipo === "confirmar-sede" && (
        <Modal title="Eliminar sede" onClose={cerrarModal}>
          <ConfirmarEliminar
            titulo={modal.data.codigo + " · " + modal.data.nombre}
            detalle={modal.enUso > 0 ? modal.enUso + " despacho(s) usan esta sede. No se eliminan, pero quedarán con un código sin nombre." : "Esta sede no tiene despachos asociados."}
            onConfirm={ejecutarBorrado} onCancel={cerrarModal}
          />
        </Modal>
      )}
      {modal && modal.tipo === "confirmar-valor" && (
        <Modal title="Eliminar valor" onClose={cerrarModal}>
          <ConfirmarEliminar titulo={modal.data} detalle="Ya no aparecerá como sugerencia." onConfirm={ejecutarBorrado} onCancel={cerrarModal} />
        </Modal>
      )}
    </div>
  );
}
