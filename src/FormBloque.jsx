import React, { useState, useMemo } from "react";
import { uid, seTraslapan, sumarMinutos, etiquetaBloque, a12Horas, a24Horas } from "./constants";
import { Icon } from "./ui";

function siguienteNombre(nombre) {
  const m = (nombre || "").match(/^(.*?)(\d+)$/);
  if (!m) return nombre || "";
  return m[1] + (Number(m[2]) + 1);
}

const BLOQUE_VACIO = { nombre: "", inicio: "08:00", fin: "09:00" };

// Selector de hora libre (cualquier hora y minuto) pero siempre en
// formato 12h con a.m./p.m., para no depender del reloj nativo del
// sistema operativo (que en varios celulares se muestra en 24h).
// Redondea un minuto cualquiera al múltiplo de 10 más cercano, para
// que un horario guardado con minuto "raro" (ej. importado antes)
// no rompa el selector al no encontrar su opción exacta en la lista.
function redondearA10(m) {
  return Math.round(m / 10) * 10 % 60;
}

export function SelectorHora12({ valor, onCambiar, etiqueta, error }) {
  const { hora12, minuto, ampm } = a12Horas(valor);
  const minutoRedondeado = redondearA10(minuto);
  const cambiar = (h, m, ap) => onCambiar(a24Horas(h, m, ap));
  const estiloError = error ? { borderColor: "var(--brand-accent)" } : null;
  return (
    <div>
      <label style={{ fontSize: 13, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>{etiqueta}</label>
      <div style={{ display: "flex", gap: 6 }}>
        <select aria-label={etiqueta + ": hora"} value={hora12} onChange={(e) => cambiar(e.target.value, minutoRedondeado, ampm)} style={Object.assign({ width: 66 }, estiloError)}>
          {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => <option key={h} value={h}>{h}</option>)}
        </select>
        <select aria-label={etiqueta + ": minutos"} value={minutoRedondeado} onChange={(e) => cambiar(hora12, e.target.value, ampm)} style={Object.assign({ width: 72 }, estiloError)}>
          {Array.from({ length: 6 }, (_, i) => i * 10).map((m) => <option key={m} value={m}>{String(m).padStart(2, "0")}</option>)}
        </select>
        <select aria-label={etiqueta + ": a.m. o p.m."} value={ampm} onChange={(e) => cambiar(hora12, minutoRedondeado, e.target.value)} style={Object.assign({ width: 76 }, estiloError)}>
          <option value="AM">a.m.</option>
          <option value="PM">p.m.</option>
        </select>
      </div>
    </div>
  );
}

export function FormBloque({ inicial, onGuardar, onGuardarYSeguir, onCancelar, bloquesExistentes }) {
  const [datos, setDatos] = useState(inicial || BLOQUE_VACIO);
  const [intentoGuardar, setIntentoGuardar] = useState(false);
  const [creados, setCreados] = useState(0);
  const labelStyle = { fontSize: 13, color: "var(--text-secondary)", display: "block", marginBottom: 4 };

  const cambiarCampo = (clave, valorNuevo) => setDatos((prev) => Object.assign({}, prev, { [clave]: valorNuevo }));

  const horaInvalida = datos.inicio && datos.fin && datos.fin <= datos.inicio;
  const traslape = useMemo(() => {
    if (!datos.inicio || !datos.fin || horaInvalida) return null;
    return (bloquesExistentes || []).find((x) =>
      x.id !== (inicial ? inicial.id : null) && seTraslapan(datos.inicio, datos.fin, x.inicio, x.fin)
    );
  }, [datos.inicio, datos.fin, bloquesExistentes, inicial, horaInvalida]);

  const puedeGuardar = datos.inicio && datos.fin && !horaInvalida && !traslape;

  const confirmarGuardado = () => {
    if (!puedeGuardar) { setIntentoGuardar(true); return; }
    onGuardar(Object.assign({}, datos, { id: inicial ? inicial.id : uid() }));
  };

  const guardarYSeguir = () => {
    if (!puedeGuardar) { setIntentoGuardar(true); return; }
    onGuardarYSeguir(Object.assign({}, datos, { id: uid() }));
    const duracionMin =
      (Number(datos.fin.split(":")[0]) * 60 + Number(datos.fin.split(":")[1])) -
      (Number(datos.inicio.split(":")[0]) * 60 + Number(datos.inicio.split(":")[1]));
    setDatos({
      nombre: siguienteNombre(datos.nombre),
      inicio: datos.fin,
      fin: sumarMinutos(datos.fin, duracionMin > 0 ? duracionMin : 60),
    });
    setIntentoGuardar(false);
    setCreados((n) => n + 1);
  };

  const bordeError = Boolean(horaInvalida || traslape);

  return (
    <div>
      {creados > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--ok-bg)", borderRadius: "var(--radius)", padding: "8px 10px", marginBottom: 12 }}>
          <Icon name="check" size={14} />
          <span style={{ fontSize: 12, color: "var(--ok)" }}>{creados} horario(s) creado(s). Puedes seguir agregando.</span>
        </div>
      )}

      <div className="form-grid form-grid-2" style={{ marginBottom: 8 }}>
        <SelectorHora12 etiqueta="Hora inicio" valor={datos.inicio} onCambiar={(v) => cambiarCampo("inicio", v)} error={bordeError} />
        <SelectorHora12 etiqueta="Hora fin" valor={datos.fin} onCambiar={(v) => cambiarCampo("fin", v)} error={bordeError} />
      </div>

      {horaInvalida && <p style={{ fontSize: 12, color: "var(--brand-accent)", margin: "0 0 12px" }}>La hora de fin debe ser posterior a la de inicio.</p>}
      {!horaInvalida && traslape && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--warn-bg)", borderRadius: "var(--radius)", padding: "8px 10px", marginBottom: 12 }}>
          <Icon name="alert-triangle" size={14} />
          <span style={{ fontSize: 12, color: "var(--warn)" }}>Se cruza con {etiquetaBloque(traslape)} ({traslape.inicio}–{traslape.fin}).</span>
        </div>
      )}

      <div style={{ marginBottom: 20 }}>
        <label style={labelStyle}>Nombre (opcional)</label>
        <input style={{ width: "100%" }} value={datos.nombre || ""} onChange={(e) => cambiarCampo("nombre", e.target.value)} placeholder="Ej. Ruta norte, camión 2..." />
        <p className="campo-ayuda">Si lo dejas vacío, el horario se identifica por su hora.</p>
      </div>

      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
        <button onClick={onCancelar}>{creados > 0 ? "Listo" : "Cancelar"}</button>
        {!inicial && <button onClick={guardarYSeguir}><Icon name="plus" size={14} /> Guardar y crear otro</button>}
        <button style={{ borderColor: "var(--brand-accent)", color: "var(--brand-accent)" }} onClick={confirmarGuardado}><Icon name="check" /> Guardar horario</button>
      </div>
    </div>
  );
}
