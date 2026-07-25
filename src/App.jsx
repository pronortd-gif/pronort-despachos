import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { supabase } from "./supabaseClient";

const BRAND = { rojo: "#BD0B3B", rojoOscuro: "#8A0829", azul: "#091F42", azulClaro: "#1B3A6B" };

const TIPOS = {
  VENTA: { label: "Venta", color: BRAND.rojo, dark: "#FF6B8F" },
  COMPRA: { label: "Compra", color: BRAND.azul, dark: "#7FA8E8" },
  MOV_MERCADERIA: { label: "Mov. mercadería", color: "#854F0B", dark: "#EF9F27" },
};

const DIAS_CORTOS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

function hoy() { return new Date().toISOString().slice(0, 10); }
function uid() { return Math.random().toString(36).slice(2, 10); }
function formatFechaLarga(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return DIAS_CORTOS[dt.getDay()] + " " + String(d).padStart(2, "0") + " de " + MESES[m - 1];
}
function diasAtras(n) {
  const dt = new Date();
  dt.setDate(dt.getDate() - n);
  return dt.toISOString().slice(0, 10);
}

const BLOQUES_DEFAULT = [];

const DESPACHOS_DEMO = [];

const CAMPOS_CATALOGO = ["cliente", "responsable", "celular", "direccion"];

const SEDES_DEFAULT = [
  { codigo: "P01", nombre: "DRYWALL PRINCIPAL", linea: "DRYWALL" },
  { codigo: "P03", nombre: "DRYWALL UNION", linea: "DRYWALL" },
  { codigo: "P05", nombre: "ADITIVOS PRINCIPAL", linea: "ADITIVOS" },
  { codigo: "P08", nombre: "ADITIVOS 2 TRUJILLO", linea: "ADITIVOS" },
  { codigo: "P09", nombre: "ALMACEN CJ", linea: "ALMACEN" },
];
function sedeLabel(codigo, sedes) {
  const s = (sedes || SEDES_DEFAULT).find((x) => x.codigo === codigo);
  return s ? s.codigo + " · " + s.nombre : codigo;
}

function esLinkOCoordenadas(texto) {
  const t = (texto || "").trim();
  if (!t) return false;
  if (/^https?:\/\//i.test(t)) return true;
  if (/^-?\d{1,2}\.\d+\s*,\s*-?\d{1,3}\.\d+$/.test(t)) return true;
  return false;
}
function convertirCoordenadasALink(texto) {
  const m = texto.trim().match(/^(-?\d{1,2}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)$/);
  if (m) return "https://maps.google.com/maps?q=" + m[1] + "," + m[2];
  return texto.trim();
}

// ---- Conexión a Supabase por tabla ----
// Cada hook carga los datos al iniciar y expone funciones para
// insertar, actualizar y eliminar directamente contra la base de datos.

function useSedesDB() {
  const [sedes, setSedes] = useState([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    supabase.from("sedes").select("*").order("codigo").then(({ data }) => {
      setSedes(data || []);
      setCargando(false);
    });
  }, []);

  const agregar = async (s) => {
    const { data, error } = await supabase.from("sedes").insert(s).select().single();
    if (!error) setSedes((prev) => prev.concat([data]).sort((a, b) => a.codigo.localeCompare(b.codigo)));
    return error;
  };
  const actualizar = async (codigoViejo, s) => {
    const { data, error } = await supabase.from("sedes").update(s).eq("codigo", codigoViejo).select().single();
    if (!error) setSedes((prev) => prev.map((x) => (x.codigo === codigoViejo ? data : x)));
    return error;
  };
  const eliminar = async (codigo) => {
    const { error } = await supabase.from("sedes").delete().eq("codigo", codigo);
    if (!error) setSedes((prev) => prev.filter((x) => x.codigo !== codigo));
    return error;
  };
  const restaurar = async (s) => { await agregar(s); };

  return { sedes, cargando, agregar, actualizar, eliminar, restaurar };
}

function useBloquesDB() {
  const [bloques, setBloques] = useState([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    supabase.from("bloques").select("*").order("inicio").then(({ data }) => {
      setBloques(data || []);
      setCargando(false);
    });
  }, []);

  const agregar = async (b) => {
    const { id, ...rest } = b;
    const { data, error } = await supabase.from("bloques").insert(rest).select().single();
    if (!error) setBloques((prev) => prev.concat([data]).sort((a, c) => a.inicio.localeCompare(c.inicio)));
    return error;
  };
  const actualizar = async (id, b) => {
    const { data, error } = await supabase.from("bloques").update(b).eq("id", id).select().single();
    if (!error) setBloques((prev) => prev.map((x) => (x.id === id ? data : x)).sort((a, c) => a.inicio.localeCompare(c.inicio)));
    return error;
  };
  const eliminar = async (id) => {
    const { error } = await supabase.from("bloques").delete().eq("id", id);
    if (!error) setBloques((prev) => prev.filter((x) => x.id !== id));
    return error;
  };
  const restaurar = async (b) => { await agregar(b); };

  return { bloques, cargando, agregar, actualizar, eliminar, restaurar };
}

function despachoDbToApp(d) {
  return {
    id: d.id, fecha: d.fecha, bloqueNombre: d.bloque_nombre, tipo: d.tipo, tienda: d.tienda || "",
    cliente: d.cliente || "", responsable: d.responsable || "", celular: d.celular || "",
    comprobante: d.comprobante || "", guia: d.guia, numGuia: d.num_guia || "", cobra: d.cobra,
    monto: d.monto != null ? String(d.monto) : "", direccion: d.direccion || "", mapsUrl: d.maps_url || "",
    estado: d.estado || "pendiente",
  };
}
function despachoAppToDb(d) {
  return {
    fecha: d.fecha, bloque_nombre: d.bloqueNombre, tipo: d.tipo, tienda: d.tienda || null,
    cliente: d.cliente || null, responsable: d.responsable || null, celular: d.celular || null,
    comprobante: d.comprobante || null, guia: d.guia, num_guia: d.numGuia || null, cobra: d.cobra,
    monto: d.monto !== "" && d.monto != null ? Number(d.monto) : null, direccion: d.direccion || null,
    maps_url: d.mapsUrl || null, estado: d.estado || "pendiente",
  };
}

function useDespachosDB() {
  const [despachos, setDespachos] = useState([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    supabase.from("despachos").select("*").order("fecha", { ascending: false }).then(({ data }) => {
      setDespachos((data || []).map(despachoDbToApp));
      setCargando(false);
    });
  }, []);

  const guardar = async (d) => {
    const existe = despachos.some((x) => x.id === d.id);
    if (existe) {
      const { data, error } = await supabase.from("despachos").update(despachoAppToDb(d)).eq("id", d.id).select().single();
      if (!error) setDespachos((prev) => prev.map((x) => (x.id === d.id ? despachoDbToApp(data) : x)));
      return error;
    } else {
      const { data, error } = await supabase.from("despachos").insert(despachoAppToDb(d)).select().single();
      if (!error) setDespachos((prev) => prev.concat([despachoDbToApp(data)]));
      return error;
    }
  };
  const eliminar = async (id) => {
    const { error } = await supabase.from("despachos").delete().eq("id", id);
    if (!error) setDespachos((prev) => prev.filter((x) => x.id !== id));
    return error;
  };
  const restaurar = async (d) => {
    const { data, error } = await supabase.from("despachos").insert(despachoAppToDb(d)).select().single();
    if (!error) setDespachos((prev) => prev.concat([despachoDbToApp(data)]));
  };

  return { despachos, setDespachos, cargando, guardar, eliminar, restaurar };
}

function useCatalogosDB() {
  const [catalogos, setCatalogos] = useState({ cliente: [], responsable: [], celular: [], direccion: [] });
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    supabase.from("catalogos").select("*").then(({ data }) => {
      const next = { cliente: [], responsable: [], celular: [], direccion: [] };
      (data || []).forEach((row) => {
        if (next[row.campo]) next[row.campo].push(row.valor);
      });
      setCatalogos(next);
      setCargando(false);
    });
  }, []);

  // Agrega un valor si no existe todavía (usado tanto manualmente como al detectar valores nuevos en despachos)
  const agregarSiNoExiste = async (campo, valor) => {
    if (!valor || catalogos[campo].indexOf(valor) !== -1) return;
    const { error } = await supabase.from("catalogos").insert({ campo, valor });
    if (!error) setCatalogos((prev) => Object.assign({}, prev, { [campo]: prev[campo].concat([valor]) }));
  };
  const editar = async (campo, valorViejo, valorNuevo) => {
    const { error } = await supabase.from("catalogos").update({ valor: valorNuevo }).eq("campo", campo).eq("valor", valorViejo);
    if (!error) setCatalogos((prev) => Object.assign({}, prev, { [campo]: prev[campo].map((v) => (v === valorViejo ? valorNuevo : v)) }));
  };
  const eliminar = async (campo, valor) => {
    const { error } = await supabase.from("catalogos").delete().eq("campo", campo).eq("valor", valor);
    if (!error) setCatalogos((prev) => Object.assign({}, prev, { [campo]: prev[campo].filter((v) => v !== valor) }));
  };

  return { catalogos, cargando, agregarSiNoExiste, editar, eliminar };
}

function useMetricasDB() {
  const [metricas, setMetricas] = useState([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    supabase.from("metricas").select("*").then(({ data }) => {
      setMetricas((data || []).map((m) => ({ id: m.id, nombre: m.nombre, operacion: m.operacion, filtroCampo: m.filtro_campo || "", filtroValor: m.filtro_valor || "" })));
      setCargando(false);
    });
  }, []);

  const agregar = async (m) => {
    const { data, error } = await supabase.from("metricas").insert({ nombre: m.nombre, operacion: m.operacion, filtro_campo: m.filtroCampo || null, filtro_valor: m.filtroValor || null }).select().single();
    if (!error) setMetricas((prev) => prev.concat([{ id: data.id, nombre: data.nombre, operacion: data.operacion, filtroCampo: data.filtro_campo || "", filtroValor: data.filtro_valor || "" }]));
  };
  const eliminar = async (id) => {
    const { error } = await supabase.from("metricas").delete().eq("id", id);
    if (!error) setMetricas((prev) => prev.filter((m) => m.id !== id));
  };

  return { metricas, cargando, agregar, eliminar };
}

// Preferencia de tema: esta sí puede quedarse local a cada dispositivo,
// no tiene sentido compartirla entre los dos usuarios.
function useTemaLocal() {
  const [theme, setThemeState] = useState(() => localStorage.getItem("pronort-theme") || "light");
  const setTheme = (t) => { localStorage.setItem("pronort-theme", t); setThemeState(t); };
  return [theme, setTheme];
}

function Icon({ name, size }) {
  return <i className={"ti ti-" + name} style={{ fontSize: size || 16 }} aria-hidden="true" />;
}
function Badge({ children, color, bg }) {
  return <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 500, padding: "2px 8px", borderRadius: 20, background: bg, color: color }}>{children}</span>;
}
function Modal({ onClose, children, title, wide }) {
  return (
    <div style={{ position: "static", minHeight: 420, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "2rem 1rem", borderRadius: 12, animation: "modalFade 0.15s ease" }}>
      <style>{"@keyframes modalFade { from { opacity: 0; } to { opacity: 1; } } @keyframes modalPop { from { opacity: 0; transform: translateY(8px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }"}</style>
      <div style={{ background: "var(--surface-2)", borderRadius: 12, width: "100%", maxWidth: wide ? 620 : 480, border: "0.5px solid var(--border)", padding: "1.25rem", animation: "modalPop 0.18s cubic-bezier(0.16, 1, 0.3, 1)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h3 style={{ margin: 0 }}>{title}</h3>
          <button onClick={onClose} aria-label="Cerrar" style={{ width: 32, height: 32, padding: 0 }}><Icon name="x" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function CampoSugerido({ label, value, onChange, sugerencias, placeholder }) {
  const [abierto, setAbierto] = useState(false);
  const wrapRef = useRef(null);
  const labelStyle = { fontSize: 13, color: "var(--text-secondary)", display: "block", marginBottom: 4 };

  const filtradas = useMemo(() => {
    const q = (value || "").toLowerCase().trim();
    const base = sugerencias.filter((s) => s.toLowerCase() !== q);
    if (!q) return base.slice(0, 6);
    return base.filter((s) => s.toLowerCase().includes(q)).slice(0, 6);
  }, [value, sugerencias]);

  useEffect(() => {
    function onDocClick(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setAbierto(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <label style={labelStyle}>{label}</label>
      <input
        style={{ width: "100%" }}
        value={value}
        placeholder={placeholder}
        onChange={(e) => { onChange(e.target.value); setAbierto(true); }}
        onFocus={() => setAbierto(true)}
      />
      {abierto && filtradas.length > 0 && (
        <div style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 20, marginTop: 2, background: "var(--surface-2)", border: "0.5px solid var(--border-strong)", borderRadius: "var(--radius)", boxShadow: "0 8px 24px rgba(0,0,0,0.12)", maxHeight: 180, overflowY: "auto" }}>
          {filtradas.map((s) => (
            <div
              key={s}
              onMouseDown={(e) => { e.preventDefault(); onChange(s); setAbierto(false); }}
              style={{ padding: "7px 10px", fontSize: 13, cursor: "pointer" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-1)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              {s}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CampoDireccion({ direccion, mapsUrl, onChangeDireccion, onChangeMaps, sugerencias }) {
  const labelStyle = { fontSize: 13, color: "var(--text-secondary)", display: "block", marginBottom: 4 };
  const [ultimoPegado, setUltimoPegado] = useState(Boolean(mapsUrl));

  const manejarCambio = (valor) => {
    if (esLinkOCoordenadas(valor)) {
      onChangeMaps(convertirCoordenadasALink(valor));
      onChangeDireccion("");
      setUltimoPegado(true);
    } else {
      onChangeDireccion(valor);
      setUltimoPegado(false);
    }
  };

  if (mapsUrl && ultimoPegado) {
    return (
      <div>
        <label style={labelStyle}>Dirección / link de Google Maps</label>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", background: "var(--surface-1)", borderRadius: "var(--radius)", fontSize: 13 }}>
          <Icon name="map-pin" size={15} />
          <a href={mapsUrl} style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{mapsUrl}</a>
          <button onClick={() => { onChangeMaps(""); setUltimoPegado(false); }} aria-label="Quitar link" style={{ width: 26, height: 26, padding: 0, border: "none" }}><Icon name="x" size={13} /></button>
        </div>
        <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "4px 0 0" }}>Link detectado automáticamente. También puedes agregar una referencia de texto abajo.</p>
        <input style={{ width: "100%", marginTop: 6 }} value={direccion} onChange={(e) => onChangeDireccion(e.target.value)} placeholder="Referencia adicional (opcional)" />
      </div>
    );
  }

  return (
    <div>
      <CampoSugerido label="Dirección o pega un link de Google Maps" value={direccion} onChange={manejarCambio} sugerencias={sugerencias} placeholder="Dirección, o pega aquí el link de Maps" />
      {mapsUrl && (
        <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: "4px 0 0" }}>
          <Icon name="map-pin" size={13} /> Link guardado: <a href={mapsUrl}>{mapsUrl}</a>
        </p>
      )}
    </div>
  );
}

function ConfirmarEliminar({ titulo, detalle, onConfirm, onCancel }) {
  const labelStyle = { fontSize: 13, color: "var(--text-secondary)" };
  return (
    <div>
      <div style={{ background: "var(--surface-1)", borderRadius: "var(--radius)", padding: "0.75rem 1rem", marginBottom: 16, borderLeft: "3px solid " + BRAND.rojo }}>
        <p style={{ margin: 0, fontWeight: 500, fontSize: 14 }}>{titulo}</p>
        {detalle && <p style={{ margin: "4px 0 0", ...labelStyle }}>{detalle}</p>}
      </div>
      <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 16 }}>Esta acción se puede deshacer por unos segundos después de confirmar.</p>
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button onClick={onCancel}>Cancelar</button>
        <button style={{ borderColor: BRAND.rojo, color: BRAND.rojo }} onClick={onConfirm}><Icon name="trash" size={14} /> Eliminar</button>
      </div>
    </div>
  );
}

function ToastDeshacer({ mensaje, onDeshacer, onExpirar }) {
  useEffect(() => {
    const t = setTimeout(onExpirar, 6000);
    return () => clearTimeout(t);
  }, [onExpirar]);
  return (
    <div style={{ position: "sticky", bottom: 0, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, background: "var(--text-primary)", color: "var(--surface-0)", borderRadius: "var(--radius)", padding: "10px 14px", marginTop: 12, animation: "toastIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)" }}>
      <style>{"@keyframes toastIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }"}</style>
      <span style={{ fontSize: 13 }}>{mensaje}</span>
      <button onClick={onDeshacer} style={{ background: "transparent", border: "0.5px solid rgba(255,255,255,0.3)", color: "var(--surface-0)", height: 28, padding: "0 12px", fontSize: 13 }}>
        <Icon name="rotate" size={13} /> Deshacer
      </button>
    </div>
  );
}

function useDeshacer() {
  const [pendiente, setPendiente] = useState(null);
  const disparar = (mensaje, deshacerFn) => setPendiente({ mensaje, deshacerFn, id: uid() });
  const limpiar = () => setPendiente(null);
  return { pendiente, disparar, limpiar };
}


function FormDespacho({ initial, bloques, fecha, onSave, onCancel, catalogos, sedes, todosDespachos }) {
  const [f, setF] = useState(initial || { bloqueNombre: bloques[0] ? bloques[0].nombre : "", tipo: "VENTA", tienda: "", cliente: "", responsable: "", celular: "", comprobante: "", guia: false, numGuia: "", cobra: false, monto: "", direccion: "", mapsUrl: "", estado: "pendiente" });
  const [intentoGuardar, setIntentoGuardar] = useState(false);
  const set = (k) => (e) => {
    const v = e && e.target ? (e.target.type === "checkbox" ? e.target.checked : e.target.value) : e;
    setF((prev) => Object.assign({}, prev, { [k]: v }));
  };
  const setDirecto = (k) => (v) => setF((prev) => Object.assign({}, prev, { [k]: v }));
  const labelStyle = { fontSize: 13, color: "var(--text-secondary)", display: "block", marginBottom: 4 };
  const row = { marginBottom: 12 };

  const sinCamposMinimos = !f.cliente.trim() && !f.tienda.trim();
  const posibleDuplicado = useMemo(() => {
    if (!f.cliente.trim() || !todosDespachos) return false;
    return todosDespachos.some((d) =>
      d.id !== (initial ? initial.id : null) &&
      d.fecha === fecha &&
      d.bloqueNombre === f.bloqueNombre &&
      d.cliente.trim().toLowerCase() === f.cliente.trim().toLowerCase()
    );
  }, [f.cliente, f.bloqueNombre, fecha, todosDespachos, initial]);

  const intentarGuardar = () => {
    if (sinCamposMinimos) { setIntentoGuardar(true); return; }
    onSave(Object.assign({}, f, { fecha: fecha, id: initial ? initial.id : uid() }));
  };

  const inputInvalido = { borderColor: BRAND.rojo };

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
        <div>
          <label style={labelStyle}>Bloque horario</label>
          <select style={{ width: "100%" }} value={f.bloqueNombre} onChange={set("bloqueNombre")}>
            {bloques.map((b) => <option key={b.id} value={b.nombre}>{b.nombre} ({b.inicio}–{b.fin})</option>)}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Tipo</label>
          <select style={{ width: "100%" }} value={f.tipo} onChange={set("tipo")}>
            {Object.keys(TIPOS).map((k) => <option key={k} value={k}>{TIPOS[k].label}</option>)}
          </select>
        </div>
      </div>

      <div style={row}>
        <label style={labelStyle}>Sede</label>
        <select style={intentoGuardar && sinCamposMinimos ? Object.assign({ width: "100%" }, inputInvalido) : { width: "100%" }} value={f.tienda} onChange={set("tienda")}>
          <option value="">Selecciona una sede...</option>
          {sedes.map((s) => <option key={s.codigo} value={s.codigo}>{s.codigo} · {s.nombre}</option>)}
        </select>
      </div>
      <div style={row}>
        <div style={intentoGuardar && sinCamposMinimos ? { border: "1px solid " + BRAND.rojo, borderRadius: "var(--radius)", padding: 1 } : {}}>
          <CampoSugerido label="Cliente" value={f.cliente} onChange={setDirecto("cliente")} sugerencias={catalogos.cliente} placeholder="Nombre del cliente (ej: Comercial RC)" />
        </div>
        {intentoGuardar && sinCamposMinimos && <p style={{ fontSize: 12, color: BRAND.rojo, margin: "4px 0 0" }}>Ingresa al menos cliente o sede para guardar.</p>}
        {posibleDuplicado && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(239,159,39,0.12)", borderRadius: "var(--radius)", padding: "6px 10px", marginTop: 6 }}>
            <Icon name="alert-triangle" size={14} />
            <span style={{ fontSize: 12, color: "#854F0B" }}>Ya existe un despacho similar en este bloque y fecha. Revisa que no sea duplicado.</span>
          </div>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
        <CampoSugerido label="Responsable / recepción" value={f.responsable} onChange={setDirecto("responsable")} sugerencias={catalogos.responsable} placeholder="Nombre de quien recibe" />
        <CampoSugerido label="Celular" value={f.celular} onChange={setDirecto("celular")} sugerencias={catalogos.celular} placeholder="999 999 999" />
      </div>

      <div style={row}><label style={labelStyle}>Comprobante</label><input style={{ width: "100%" }} value={f.comprobante} onChange={set("comprobante")} placeholder="FAC 001-2345" /></div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, paddingTop: 20 }}>
          <input type="checkbox" id="guia" checked={f.guia} onChange={set("guia")} />
          <label htmlFor="guia" style={{ fontSize: 14 }}>¿Tiene guía?</label>
        </div>
        {f.guia && <div><label style={labelStyle}>N° de guía</label><input style={{ width: "100%" }} value={f.numGuia} onChange={set("numGuia")} /></div>}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, paddingTop: 20 }}>
          <input type="checkbox" id="cobra" checked={f.cobra} onChange={set("cobra")} />
          <label htmlFor="cobra" style={{ fontSize: 14 }}>¿Se cobra?</label>
        </div>
        {f.cobra && <div><label style={labelStyle}>Monto (S/)</label><input style={{ width: "100%" }} type="number" min="0" step="0.1" value={f.monto} onChange={set("monto")} /></div>}
      </div>

      <div style={Object.assign({}, row, { marginBottom: 20 })}>
        <CampoDireccion
          direccion={f.direccion}
          mapsUrl={f.mapsUrl}
          onChangeDireccion={setDirecto("direccion")}
          onChangeMaps={setDirecto("mapsUrl")}
          sugerencias={catalogos.direccion}
        />
      </div>

      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button onClick={onCancel}>Cancelar</button>
        <button style={{ borderColor: BRAND.rojo, color: BRAND.rojo }} onClick={intentarGuardar}>
          <Icon name="check" /> Guardar despacho
        </button>
      </div>
    </div>
  );
}

function seTraslapan(inicioA, finA, inicioB, finB) {
  return inicioA < finB && inicioB < finA;
}

function FormBloque({ initial, onSave, onCancel, bloquesExistentes }) {
  const [b, setB] = useState(initial || { nombre: "", inicio: "08:00", fin: "09:00" });
  const [intentoGuardar, setIntentoGuardar] = useState(false);
  const labelStyle = { fontSize: 13, color: "var(--text-secondary)", display: "block", marginBottom: 4 };

  const horaInvalida = b.inicio && b.fin && b.fin <= b.inicio;
  const traslape = useMemo(() => {
    if (!b.inicio || !b.fin || horaInvalida) return null;
    return (bloquesExistentes || []).find((x) =>
      x.id !== (initial ? initial.id : null) && seTraslapan(b.inicio, b.fin, x.inicio, x.fin)
    );
  }, [b.inicio, b.fin, bloquesExistentes, initial, horaInvalida]);

  const puedeGuardar = b.nombre.trim() && b.inicio && b.fin && !horaInvalida && !traslape;

  const intentarGuardar = () => {
    if (!puedeGuardar) { setIntentoGuardar(true); return; }
    onSave(Object.assign({}, b, { id: initial ? initial.id : uid() }));
  };

  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <label style={labelStyle}>Nombre del bloque</label>
        <input style={{ width: "100%" }} value={b.nombre} onChange={(e) => setB(Object.assign({}, b, { nombre: e.target.value }))} placeholder="Salida 1" />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 8 }}>
        <div>
          <label style={labelStyle}>Hora inicio</label>
          <input style={{ width: "100%", borderColor: (horaInvalida || traslape) ? BRAND.rojo : undefined }} type="time" value={b.inicio} onChange={(e) => setB(Object.assign({}, b, { inicio: e.target.value }))} />
        </div>
        <div>
          <label style={labelStyle}>Hora fin</label>
          <input style={{ width: "100%", borderColor: (horaInvalida || traslape) ? BRAND.rojo : undefined }} type="time" value={b.fin} onChange={(e) => setB(Object.assign({}, b, { fin: e.target.value }))} />
        </div>
      </div>
      {horaInvalida && <p style={{ fontSize: 12, color: BRAND.rojo, margin: "0 0 12px" }}>La hora de fin debe ser posterior a la hora de inicio.</p>}
      {!horaInvalida && traslape && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(189,11,59,0.08)", borderRadius: "var(--radius)", padding: "6px 10px", marginBottom: 12 }}>
          <Icon name="alert-triangle" size={14} />
          <span style={{ fontSize: 12, color: BRAND.rojo }}>Se cruza con "{traslape.nombre}" ({traslape.inicio}–{traslape.fin}).</span>
        </div>
      )}
      <div style={{ marginBottom: 20 }} />
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button onClick={onCancel}>Cancelar</button>
        <button onClick={intentarGuardar}><Icon name="check" /> Guardar bloque</button>
      </div>
    </div>
  );
}

function TarjetaDespacho({ d, onEdit, onDelete, onToggleEstado, isDark, sedes }) {
  const t = TIPOS[d.tipo] || TIPOS.VENTA;
  const color = isDark ? t.dark : t.color;
  const entregado = d.estado === "entregado";
  return (
    <div style={{ background: "var(--surface-2)", border: "0.5px solid " + (entregado ? "var(--border)" : color), borderLeft: "3px solid " + color, borderRadius: 10, padding: "0.65rem 0.9rem", marginBottom: 8, opacity: entregado ? 0.55 : 1, transition: "opacity 0.2s ease, transform 0.2s ease, border-color 0.2s ease", animation: "cardIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)" }}>
      <style>{"@keyframes cardIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }"}</style>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4, flexWrap: "wrap" }}>
            <Badge color={color} bg={isDark ? "rgba(255,255,255,0.08)" : "rgba(189,11,59,0.08)"}>{t.label}</Badge>
            {d.cobra && d.monto && <Badge color="#854F0B" bg="rgba(239,159,39,0.15)">S/ {Number(d.monto).toFixed(2)}</Badge>}
            {entregado && <Badge color="#0F6E56" bg="rgba(93,202,165,0.15)"><Icon name="check" size={12} /> Entregado</Badge>}
          </div>
          <p style={{ margin: 0, fontWeight: 500, fontSize: 14 }}>{d.cliente || "Sin cliente"}</p>
          {d.tienda && <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--text-secondary)" }}>{sedeLabel(d.tienda, sedes)}</p>}
          {d.responsable && <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--text-secondary)" }}><Icon name="user" size={13} /> {d.responsable}{d.celular ? " · " + d.celular : ""}</p>}
          {d.direccion && <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--text-secondary)" }}><Icon name="map-pin" size={13} /> {d.direccion}{d.mapsUrl && <a href={d.mapsUrl} style={{ marginLeft: 6 }}><Icon name="external-link" size={12} /></a>}</p>}
          {d.comprobante && <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--text-secondary)" }}><Icon name="file" size={13} /> {d.comprobante}{d.guia && d.numGuia ? " · Guía " + d.numGuia : ""}</p>}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <button onClick={() => onToggleEstado(d.id)} aria-label="Cambiar estado" style={{ width: 30, height: 30, padding: 0 }}><Icon name={entregado ? "rotate" : "check"} size={15} /></button>
          <button onClick={() => onEdit(d)} aria-label="Editar" style={{ width: 30, height: 30, padding: 0 }}><Icon name="edit" size={15} /></button>
          <button onClick={() => onDelete(d.id)} aria-label="Eliminar" style={{ width: 30, height: 30, padding: 0 }}><Icon name="trash" size={15} /></button>
        </div>
      </div>
    </div>
  );
}

function VistaCalendario({ mesActual, setMesActual, despachos, onSelectDia }) {
  const parts = mesActual.split("-").map(Number);
  const y = parts[0], m = parts[1];
  const primerDia = new Date(y, m - 1, 1);
  const ultimoDia = new Date(y, m, 0);
  const diasEnMes = ultimoDia.getDate();
  const offset = primerDia.getDay();

  const conteoPorDia = useMemo(() => {
    const acc = {};
    despachos.forEach((d) => {
      if (d.fecha.indexOf(mesActual) === 0) {
        if (!acc[d.fecha]) acc[d.fecha] = { total: 0, tipos: {} };
        acc[d.fecha].total += 1;
        acc[d.fecha].tipos[d.tipo] = (acc[d.fecha].tipos[d.tipo] || 0) + 1;
      }
    });
    return acc;
  }, [despachos, mesActual]);

  const totales = Object.keys(conteoPorDia).map((k) => conteoPorDia[k].total);
  const maxTotal = Math.max(1, totales.length ? Math.max.apply(null, totales) : 1);
  const celdas = [];
  for (let i = 0; i < offset; i++) celdas.push(null);
  for (let d = 1; d <= diasEnMes; d++) celdas.push(d);

  const cambiarMes = (delta) => {
    const dt = new Date(y, m - 1 + delta, 1);
    setMesActual(dt.getFullYear() + "-" + String(dt.getMonth() + 1).padStart(2, "0"));
  };
  const irHoy = () => setMesActual(hoy().slice(0, 7));
  const hoyIso = hoy();

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <button onClick={() => cambiarMes(-1)} aria-label="Mes anterior" style={{ width: 36, height: 36, padding: 0 }}><Icon name="chevron-left" /></button>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <h2 style={{ margin: 0, textTransform: "capitalize" }}>{MESES[m - 1]} {y}</h2>
          {mesActual !== hoyIso.slice(0, 7) && <button onClick={irHoy} style={{ fontSize: 12, height: 26, padding: "0 10px" }}>Hoy</button>}
        </div>
        <button onClick={() => cambiarMes(1)} aria-label="Mes siguiente" style={{ width: 36, height: 36, padding: 0 }}><Icon name="chevron-right" /></button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 4, marginBottom: 6 }}>
        {DIAS_CORTOS.map((d) => <div key={d} style={{ textAlign: "center", fontSize: 11, fontWeight: 500, color: "var(--text-secondary)", textTransform: "uppercase", padding: "4px 0" }}>{d}</div>)}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 4 }}>
        {celdas.map((d, i) => {
          if (d === null) return <div key={"empty-" + i} />;
          const iso = y + "-" + String(m).padStart(2, "0") + "-" + String(d).padStart(2, "0");
          const info = conteoPorDia[iso];
          const esHoy = iso === hoyIso;
          const intensidad = info ? info.total / maxTotal : 0;
          return (
            <button
              key={iso}
              onClick={() => onSelectDia(iso)}
              style={{ aspectRatio: "1", border: esHoy ? "1.5px solid " + BRAND.rojo : "0.5px solid var(--border)", borderRadius: 10, background: info ? "rgba(189,11,59," + (0.05 + intensidad * 0.18) + ")" : "var(--surface-2)", padding: "6px 4px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-start", cursor: "pointer", minHeight: 62, transition: "transform 0.15s cubic-bezier(0.16, 1, 0.3, 1), border-color 0.15s ease" }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = "scale(1.05)"; e.currentTarget.style.borderColor = "var(--border-strong)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; if (!esHoy) e.currentTarget.style.borderColor = "var(--border)"; }}
            >
              <span style={{ fontSize: 13, fontWeight: esHoy ? 500 : 400, color: esHoy ? BRAND.rojo : "var(--text-primary)" }}>{d}</span>
              {info && (
                <React.Fragment>
                  <span style={{ fontSize: 11, fontWeight: 500, marginTop: 4, color: "#fff", background: BRAND.rojo, borderRadius: 20, padding: "1px 7px" }}>{info.total}</span>
                  <div style={{ display: "flex", gap: 2, marginTop: 3 }}>
                    {Object.keys(info.tipos).slice(0, 3).map((tk) => <span key={tk} style={{ width: 5, height: 5, borderRadius: "50%", background: TIPOS[tk] ? TIPOS[tk].color : "#888" }} />)}
                  </div>
                </React.Fragment>
              )}
            </button>
          );
        })}
      </div>

      <div style={{ display: "flex", gap: 14, marginTop: 16, flexWrap: "wrap" }}>
        {Object.keys(TIPOS).map((k) => (
          <div key={k} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text-secondary)" }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: TIPOS[k].color }} />{TIPOS[k].label}
          </div>
        ))}
      </div>
    </div>
  );
}

const CAPACIDAD_BLOQUE = 5;

function BarraCapacidad(props) {
  const cantidad = props.cantidad;
  const ratio = Math.min(1, cantidad / CAPACIDAD_BLOQUE);
  const color = cantidad >= CAPACIDAD_BLOQUE ? BRAND.rojo : cantidad >= CAPACIDAD_BLOQUE - 1 ? "#EF9F27" : "#5DCAA5";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 60 }}>
      <div style={{ flex: 1, height: 5, borderRadius: 3, background: "var(--surface-1)", overflow: "hidden" }}>
        <div style={{ width: (ratio * 100) + "%", height: "100%", background: color, borderRadius: 3, transition: "width 0.25s ease, background 0.25s ease" }} />
      </div>
    </div>
  );
}

function VistaDia({ fecha, onVolver, bloques, setBloques, despachos, setDespachos, isDark, catalogos, sedes }) {
  const [formDespacho, setFormDespacho] = useState(null);
  const [formBloque, setFormBloque] = useState(null);
  const [confirmarBorrado, setConfirmarBorrado] = useState(null);
  const { pendiente, disparar, limpiar } = useDeshacer();
  const captureRef = useRef(null);
  const [exporting, setExporting] = useState(false);

  const despachosDia = despachos.filter((d) => d.fecha === fecha);

  const guardarDespacho = (d) => {
    setDespachos((prev) => {
      const existe = prev.some((x) => x.id === d.id);
      return existe ? prev.map((x) => (x.id === d.id ? d : x)) : prev.concat([d]);
    });
    setFormDespacho(null);
  };

  const confirmarEliminarDespacho = (d) => setConfirmarBorrado({ tipo: "despacho", data: d });
  const confirmarEliminarBloque = (b) => {
    const enUso = despachosDia.filter((d) => d.bloqueNombre === b.nombre).length;
    setConfirmarBorrado({ tipo: "bloque", data: b, enUso });
  };

  const ejecutarBorrado = () => {
    if (!confirmarBorrado) return;
    if (confirmarBorrado.tipo === "despacho") {
      const d = confirmarBorrado.data;
      setDespachos((prev) => prev.filter((x) => x.id !== d.id));
      disparar("Despacho de " + (d.cliente || "sin cliente") + " eliminado.", () => {
        setDespachos((prev) => prev.concat([d]));
      });
    } else {
      const b = confirmarBorrado.data;
      setBloques((prev) => prev.filter((x) => x.id !== b.id));
      disparar("Bloque \"" + b.nombre + "\" eliminado.", () => {
        setBloques((prev) => prev.concat([b]).slice().sort((a, c) => a.inicio.localeCompare(c.inicio)));
      });
    }
    setConfirmarBorrado(null);
  };

  const toggleEstado = (id) => setDespachos((prev) => prev.map((x) => x.id === id ? Object.assign({}, x, { estado: x.estado === "entregado" ? "pendiente" : "entregado" }) : x));
  const guardarBloque = (b) => {
    setBloques((prev) => {
      const existe = prev.some((x) => x.id === b.id);
      const actualizado = existe ? prev.map((x) => (x.id === b.id ? b : x)) : prev.concat([b]);
      return actualizado.slice().sort((a, c) => a.inicio.localeCompare(c.inicio));
    });
    setFormBloque(null);
  };

  const totalDia = despachosDia.length;
  const totalPorTipo = {};
  Object.keys(TIPOS).forEach((k) => { totalPorTipo[k] = despachosDia.filter((d) => d.tipo === k).length; });

  const exportarImagen = useCallback(() => {
    async function run() {
      if (!window.htmlToImage) {
        setExporting(true);
        const s = document.createElement("script");
        s.src = "https://cdnjs.cloudflare.com/ajax/libs/html-to-image/1.11.11/html-to-image.min.js";
        await new Promise((resolve) => { s.onload = resolve; document.body.appendChild(s); });
      }
      try {
        setExporting(true);
        const dataUrl = await window.htmlToImage.toPng(captureRef.current, { backgroundColor: isDark ? "#12172A" : "#ffffff", pixelRatio: 2 });
        const link = document.createElement("a");
        link.download = "despachos-" + fecha + ".png";
        link.href = dataUrl;
        link.click();
      } catch (e) {}
      finally { setExporting(false); }
    }
    run();
  }, [fecha, isDark]);

  return (
    <div>
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 16, flexWrap: "wrap" }}>
        <button onClick={onVolver} aria-label="Volver al calendario" style={{ padding: "0 12px", height: 36 }}><Icon name="arrow-left" size={15} /> Calendario</button>
        <button onClick={() => setFormBloque({})}><Icon name="plus" /> Bloque</button>
        <div style={{ flex: 1 }} />
        <button onClick={exportarImagen} disabled={exporting}><Icon name="download" /> {exporting ? "Generando..." : "Descargar imagen"}</button>
      </div>

      <div ref={captureRef} style={{ background: "var(--surface-2)", padding: "1rem", borderRadius: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <div style={{ width: 4, height: 22, background: BRAND.rojo, borderRadius: 2 }} />
          <p style={{ margin: 0, fontSize: 18, fontWeight: 500, textTransform: "capitalize" }}>{formatFechaLarga(fecha)}</p>
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 10, marginBottom: 16, flexWrap: "wrap" }}>
          <Badge color="var(--text-primary)" bg="var(--surface-1)">{totalDia} despachos</Badge>
          {Object.keys(totalPorTipo).filter((k) => totalPorTipo[k] > 0).map((k) => (
            <Badge key={k} color={isDark ? TIPOS[k].dark : TIPOS[k].color} bg={isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)"}>{TIPOS[k].label}: {totalPorTipo[k]}</Badge>
          ))}
        </div>

        {bloques.length === 0 && (
          <div style={{ textAlign: "center", padding: "2rem 1rem", color: "var(--text-secondary)" }}>
            <Icon name="clock" size={28} />
            <p style={{ fontSize: 14, margin: "8px 0 0" }}>Aún no hay bloques de horario para este día.</p>
            <p style={{ fontSize: 13, margin: "2px 0 0", color: "var(--text-muted)" }}>Usa el botón "Bloque" de arriba para crear la primera salida.</p>
          </div>
        )}

        {bloques.map((b) => {
          const items = despachosDia.filter((d) => d.bloqueNombre === b.nombre);
          const lleno = items.length >= CAPACIDAD_BLOQUE;
          return (
            <div key={b.id} style={{ marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8, gap: 8, flexWrap: "wrap" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Icon name="clock" size={16} />
                  <span style={{ fontWeight: 500, fontSize: 15 }}>{b.nombre}</span>
                  <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>{b.inicio}–{b.fin}</span>
                  <Badge color="var(--text-secondary)" bg="var(--surface-1)">{items.length}</Badge>
                  <BarraCapacidad cantidad={items.length} />
                  {lleno && (
                    <span style={{ fontSize: 11, color: BRAND.rojo, display: "inline-flex", alignItems: "center", gap: 3 }}>
                      <Icon name="alert-triangle" size={12} /> lleno
                    </span>
                  )}
                </div>
                <div style={{ display: "flex", gap: 4 }}>
                  <button onClick={() => setFormDespacho({ bloqueNombre: b.nombre })} style={{ height: 28, padding: "0 10px", fontSize: 13 }}><Icon name="plus" size={14} /> Despacho</button>
                  <button onClick={() => setFormBloque(b)} aria-label="Editar bloque" style={{ width: 28, height: 28, padding: 0 }}><Icon name="edit" size={14} /></button>
                  <button onClick={() => confirmarEliminarBloque(b)} aria-label="Eliminar bloque" style={{ width: 28, height: 28, padding: 0 }}><Icon name="trash" size={14} /></button>
                </div>
              </div>
              {items.length === 0 ? (
                <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "0 0 0 24px" }}>Sin despachos en este bloque.</p>
              ) : (
                items.map((d) => <TarjetaDespacho key={d.id} d={d} onEdit={setFormDespacho} onDelete={() => confirmarEliminarDespacho(d)} onToggleEstado={toggleEstado} isDark={isDark} sedes={sedes} />)
              )}
            </div>
          );
        })}
      </div>

      {pendiente && (
        <ToastDeshacer
          mensaje={pendiente.mensaje}
          onDeshacer={() => { pendiente.deshacerFn(); limpiar(); }}
          onExpirar={limpiar}
        />
      )}

      {formDespacho && (
        <Modal title={formDespacho.id ? "Editar despacho" : "Nuevo despacho"} onClose={() => setFormDespacho(null)}>
          <FormDespacho initial={formDespacho.id ? formDespacho : null} bloques={bloques} fecha={fecha} onSave={guardarDespacho} onCancel={() => setFormDespacho(null)} catalogos={catalogos} sedes={sedes} todosDespachos={despachos} />
        </Modal>
      )}
      {formBloque && (
        <Modal title={formBloque.id ? "Editar bloque" : "Nuevo bloque de horario"} onClose={() => setFormBloque(null)}>
          <FormBloque initial={formBloque.id ? formBloque : null} onSave={guardarBloque} onCancel={() => setFormBloque(null)} bloquesExistentes={bloques} />
        </Modal>
      )}
      {confirmarBorrado && confirmarBorrado.tipo === "despacho" && (
        <Modal title="Eliminar despacho" onClose={() => setConfirmarBorrado(null)}>
          <ConfirmarEliminar
            titulo={confirmarBorrado.data.cliente || "Despacho sin cliente"}
            detalle={sedeLabel(confirmarBorrado.data.tienda, sedes) + " · " + confirmarBorrado.data.bloqueNombre + (confirmarBorrado.data.comprobante ? " · " + confirmarBorrado.data.comprobante : "")}
            onConfirm={ejecutarBorrado}
            onCancel={() => setConfirmarBorrado(null)}
          />
        </Modal>
      )}
      {confirmarBorrado && confirmarBorrado.tipo === "bloque" && (
        <Modal title="Eliminar bloque" onClose={() => setConfirmarBorrado(null)}>
          <ConfirmarEliminar
            titulo={confirmarBorrado.data.nombre + " (" + confirmarBorrado.data.inicio + "–" + confirmarBorrado.data.fin + ")"}
            detalle={confirmarBorrado.enUso > 0 ? confirmarBorrado.enUso + " despacho(s) de hoy quedarán sin bloque asignado." : "Este bloque no tiene despachos hoy."}
            onConfirm={ejecutarBorrado}
            onCancel={() => setConfirmarBorrado(null)}
          />
        </Modal>
      )}
    </div>
  );
}

function VistaHistorial({ despachos, onEdit, onDelete, sedes }) {
  const [filtroTexto, setFiltroTexto] = useState("");
  const [filtroFecha, setFiltroFecha] = useState("");
  const [confirmarBorrado, setConfirmarBorrado] = useState(null);
  const { pendiente, disparar, limpiar } = useDeshacer();

  const filtrados = despachos
    .filter((d) => !filtroFecha || d.fecha === filtroFecha)
    .filter((d) => {
      if (!filtroTexto) return true;
      const q = filtroTexto.toLowerCase();
      return (d.cliente || "").toLowerCase().indexOf(q) !== -1 || (d.tienda || "").toLowerCase().indexOf(q) !== -1 || (d.responsable || "").toLowerCase().indexOf(q) !== -1 || (d.comprobante || "").toLowerCase().indexOf(q) !== -1;
    })
    .sort((a, b) => (a.fecha < b.fecha ? 1 : -1));

  const ejecutarBorrado = () => {
    if (!confirmarBorrado) return;
    const d = confirmarBorrado;
    onDelete(d.id);
    disparar("Despacho de " + (d.cliente || "sin cliente") + " eliminado.", () => onEdit && null);
    setConfirmarBorrado(null);
  };

  return (
    <div>
      <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <input placeholder="Buscar por cliente, tienda, responsable, comprobante..." value={filtroTexto} onChange={(e) => setFiltroTexto(e.target.value)} style={{ flex: 1, minWidth: 220 }} />
        <input type="date" value={filtroFecha} onChange={(e) => setFiltroFecha(e.target.value)} style={{ width: 170 }} />
        {filtroFecha && <button onClick={() => setFiltroFecha("")}>Limpiar fecha</button>}
      </div>
      <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 8 }}>{filtrados.length} resultados</p>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "0.5px solid var(--border)" }}>
              <th style={{ textAlign: "left", padding: "6px 8px" }}>Fecha</th>
              <th style={{ textAlign: "left", padding: "6px 8px" }}>Bloque</th>
              <th style={{ textAlign: "left", padding: "6px 8px" }}>Tipo</th>
              <th style={{ textAlign: "left", padding: "6px 8px" }}>Cliente</th>
              <th style={{ textAlign: "left", padding: "6px 8px" }}>Tienda</th>
              <th style={{ textAlign: "left", padding: "6px 8px" }}>Comprobante</th>
              <th style={{ textAlign: "left", padding: "6px 8px" }}>Estado</th>
              <th style={{ padding: "6px 8px" }}></th>
            </tr>
          </thead>
          <tbody>
            {filtrados.map((d) => {
              const t = TIPOS[d.tipo] || TIPOS.VENTA;
              return (
                <tr key={d.id} style={{ borderBottom: "0.5px solid var(--border)" }}>
                  <td style={{ padding: "6px 8px", whiteSpace: "nowrap" }}>{d.fecha}</td>
                  <td style={{ padding: "6px 8px", whiteSpace: "nowrap" }}>{d.bloqueNombre}</td>
                  <td style={{ padding: "6px 8px" }}><Badge color={t.color} bg="rgba(0,0,0,0.05)">{t.label}</Badge></td>
                  <td style={{ padding: "6px 8px" }}>{d.cliente || "—"}</td>
                  <td style={{ padding: "6px 8px" }}>{d.tienda ? sedeLabel(d.tienda, sedes) : "—"}</td>
                  <td style={{ padding: "6px 8px" }}>{d.comprobante || "—"}</td>
                  <td style={{ padding: "6px 8px" }}>{d.estado === "entregado" ? "Entregado" : "Pendiente"}</td>
                  <td style={{ padding: "6px 8px", whiteSpace: "nowrap" }}>
                    <button onClick={() => onEdit(d)} aria-label="Editar" style={{ width: 26, height: 26, padding: 0, marginRight: 4 }}><Icon name="edit" size={13} /></button>
                    <button onClick={() => setConfirmarBorrado(d)} aria-label="Eliminar" style={{ width: 26, height: 26, padding: 0 }}><Icon name="trash" size={13} /></button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {pendiente && (
        <ToastDeshacer
          mensaje={pendiente.mensaje}
          onDeshacer={() => { pendiente.deshacerFn(); limpiar(); }}
          onExpirar={limpiar}
        />
      )}

      {confirmarBorrado && (
        <Modal title="Eliminar despacho" onClose={() => setConfirmarBorrado(null)}>
          <ConfirmarEliminar
            titulo={confirmarBorrado.cliente || "Despacho sin cliente"}
            detalle={confirmarBorrado.fecha + " · " + confirmarBorrado.bloqueNombre + (confirmarBorrado.comprobante ? " · " + confirmarBorrado.comprobante : "")}
            onConfirm={ejecutarBorrado}
            onCancel={() => setConfirmarBorrado(null)}
          />
        </Modal>
      )}
    </div>
  );
}

function FormSede({ initial, onSave, onCancel }) {
  const [s, setS] = useState(initial || { codigo: "", nombre: "", linea: "DRYWALL" });
  const labelStyle = { fontSize: 13, color: "var(--text-secondary)", display: "block", marginBottom: 4 };
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 12, marginBottom: 12 }}>
        <div>
          <label style={labelStyle}>Código</label>
          <input style={{ width: "100%", textTransform: "uppercase" }} value={s.codigo} onChange={(e) => setS(Object.assign({}, s, { codigo: e.target.value.toUpperCase() }))} placeholder="P11" maxLength={6} />
        </div>
        <div>
          <label style={labelStyle}>Nombre de la sede</label>
          <input style={{ width: "100%" }} value={s.nombre} onChange={(e) => setS(Object.assign({}, s, { nombre: e.target.value }))} placeholder="NUEVA SEDE TRUJILLO" />
        </div>
      </div>
      <div style={{ marginBottom: 20 }}>
        <label style={labelStyle}>Línea</label>
        <select style={{ width: "100%" }} value={s.linea} onChange={(e) => setS(Object.assign({}, s, { linea: e.target.value }))}>
          <option value="DRYWALL">Drywall</option>
          <option value="ADITIVOS">Aditivos</option>
          <option value="ALMACEN">Almacén</option>
          <option value="OTRO">Otro</option>
        </select>
      </div>
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button onClick={onCancel}>Cancelar</button>
        <button
          style={{ borderColor: BRAND.rojo, color: BRAND.rojo }}
          onClick={() => s.codigo.trim() && s.nombre.trim() && onSave(Object.assign({}, s, { codigo: s.codigo.trim(), nombre: s.nombre.trim() }))}
        >
          <Icon name="check" /> Guardar sede
        </button>
      </div>
    </div>
  );
}

function VistaCatalogos({ catalogos, setCatalogos, sedes, setSedes, despachos }) {
  const [campoActivo, setCampoActivo] = useState("sedes");
  const [nuevo, setNuevo] = useState("");
  const [editando, setEditando] = useState(null);
  const [formSede, setFormSede] = useState(null);
  const [confirmarBorrado, setConfirmarBorrado] = useState(null);
  const { pendiente, disparar, limpiar } = useDeshacer();

  const labelCampo = { sedes: "Sedes", cliente: "Clientes", responsable: "Responsables", celular: "Celulares", direccion: "Direcciones" };
  const tabsCatalogo = ["sedes"].concat(CAMPOS_CATALOGO);

  const usosPorSede = useMemo(() => {
    const acc = {};
    (despachos || []).forEach((d) => { if (d.tienda) acc[d.tienda] = (acc[d.tienda] || 0) + 1; });
    return acc;
  }, [despachos]);

  const agregar = () => {
    const v = nuevo.trim();
    if (!v) return;
    setCatalogos((prev) => {
      if (prev[campoActivo].indexOf(v) !== -1) return prev;
      const next = Object.assign({}, prev);
      next[campoActivo] = prev[campoActivo].concat([v]);
      return next;
    });
    setNuevo("");
  };

  const guardarEdicion = (valorViejo, valorNuevo) => {
    if (!valorNuevo.trim()) { setEditando(null); return; }
    setCatalogos((prev) => {
      const next = Object.assign({}, prev);
      next[campoActivo] = prev[campoActivo].map((x) => (x === valorViejo ? valorNuevo.trim() : x));
      return next;
    });
    setEditando(null);
  };

  const guardarSede = (s) => {
    setSedes((prev) => {
      const existeCodigo = prev.some((x) => x.codigo === s.codigo && (!formSede.codigo || x.codigo !== formSede.codigo));
      if (existeCodigo) return prev;
      const yaExiste = formSede && formSede.codigo && prev.some((x) => x.codigo === formSede.codigo);
      return yaExiste ? prev.map((x) => (x.codigo === formSede.codigo ? s : x)) : prev.concat([s]);
    });
    setFormSede(null);
  };

  const pedirBorrarSede = (s) => setConfirmarBorrado({ tipo: "sede", data: s, enUso: usosPorSede[s.codigo] || 0 });
  const pedirBorrarValor = (v) => setConfirmarBorrado({ tipo: "valor", data: v });

  const ejecutarBorrado = () => {
    if (!confirmarBorrado) return;
    if (confirmarBorrado.tipo === "sede") {
      const s = confirmarBorrado.data;
      setSedes((prev) => prev.filter((x) => x.codigo !== s.codigo));
      disparar("Sede " + s.codigo + " eliminada.", () => setSedes((prev) => prev.concat([s])));
    } else {
      const v = confirmarBorrado.data;
      setCatalogos((prev) => {
        const next = Object.assign({}, prev);
        next[campoActivo] = prev[campoActivo].filter((x) => x !== v);
        return next;
      });
      disparar("\"" + v + "\" eliminado de " + labelCampo[campoActivo].toLowerCase() + ".", () => {
        setCatalogos((prev) => {
          const next = Object.assign({}, prev);
          next[campoActivo] = prev[campoActivo].concat([v]);
          return next;
        });
      });
    }
    setConfirmarBorrado(null);
  };

  const lineaColor = { DRYWALL: BRAND.azul, ADITIVOS: BRAND.rojo, ALMACEN: "#854F0B", OTRO: "#5B6272" };

  return (
    <div>
      <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 16 }}>
        Estos valores alimentan las sugerencias del desplegable al llenar un despacho. Se agregan solos al escribir uno nuevo, o los puedes gestionar aquí.
      </p>
      <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
        {tabsCatalogo.map((c) => (
          <button
            key={c}
            onClick={() => setCampoActivo(c)}
            style={{ fontSize: 13, height: 32, padding: "0 12px", borderColor: campoActivo === c ? BRAND.rojo : "var(--border)", color: campoActivo === c ? BRAND.rojo : "var(--text-secondary)", transition: "border-color 0.15s ease, color 0.15s ease" }}
          >
            {labelCampo[c]} <span style={{ opacity: 0.7 }}>({c === "sedes" ? sedes.length : catalogos[c].length})</span>
          </button>
        ))}
      </div>

      <div key={campoActivo} style={{ animation: "fadeIn 0.2s ease" }}>
        <style>{"@keyframes fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }"}</style>

        {campoActivo === "sedes" ? (
          <div>
            <div style={{ marginBottom: 16 }}>
              <button onClick={() => setFormSede({})}><Icon name="plus" /> Nueva sede</button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {sedes.length === 0 && <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Sin sedes registradas.</p>}
              {sedes.map((s) => {
                const enUso = usosPorSede[s.codigo] || 0;
                return (
                  <div key={s.codigo} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", background: "var(--surface-1)", borderRadius: "var(--radius)" }}>
                    <span style={{ fontSize: 12, fontWeight: 500, color: "#fff", background: lineaColor[s.linea] || lineaColor.OTRO, borderRadius: 6, padding: "3px 8px", minWidth: 40, textAlign: "center" }}>{s.codigo}</span>
                    <div style={{ flex: 1 }}>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 500 }}>{s.nombre}</p>
                      <p style={{ margin: 0, fontSize: 11, color: "var(--text-secondary)" }}>{s.linea}</p>
                    </div>
                    {enUso > 0 && (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 11, color: "var(--text-secondary)" }} title="Sede en uso">
                        <Icon name="lock" size={12} /> {enUso}
                      </span>
                    )}
                    <button onClick={() => setFormSede(s)} aria-label="Editar sede" style={{ width: 26, height: 26, padding: 0 }}><Icon name="edit" size={13} /></button>
                    <button onClick={() => pedirBorrarSede(s)} aria-label="Eliminar sede" style={{ width: 26, height: 26, padding: 0 }}><Icon name="trash" size={13} /></button>
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
              {catalogos[campoActivo].length === 0 && <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Sin valores guardados todavía.</p>}
              {catalogos[campoActivo].map((v) => (
                <div key={v} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", background: "var(--surface-1)", borderRadius: "var(--radius)" }}>
                  {editando === v ? (
                    <input autoFocus defaultValue={v} style={{ flex: 1 }} onKeyDown={(e) => e.key === "Enter" && guardarEdicion(v, e.target.value)} onBlur={(e) => guardarEdicion(v, e.target.value)} />
                  ) : (
                    <span style={{ flex: 1, fontSize: 13 }}>{v}</span>
                  )}
                  <button onClick={() => setEditando(editando === v ? null : v)} aria-label="Editar" style={{ width: 26, height: 26, padding: 0 }}><Icon name="edit" size={13} /></button>
                  <button onClick={() => pedirBorrarValor(v)} aria-label="Eliminar" style={{ width: 26, height: 26, padding: 0 }}><Icon name="trash" size={13} /></button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {pendiente && (
        <ToastDeshacer
          mensaje={pendiente.mensaje}
          onDeshacer={() => { pendiente.deshacerFn(); limpiar(); }}
          onExpirar={limpiar}
        />
      )}

      {formSede && (
        <Modal title={formSede.codigo ? "Editar sede" : "Nueva sede"} onClose={() => setFormSede(null)}>
          <FormSede initial={formSede.codigo ? formSede : null} onSave={guardarSede} onCancel={() => setFormSede(null)} />
        </Modal>
      )}
      {confirmarBorrado && confirmarBorrado.tipo === "sede" && (
        <Modal title="Eliminar sede" onClose={() => setConfirmarBorrado(null)}>
          <ConfirmarEliminar
            titulo={confirmarBorrado.data.codigo + " · " + confirmarBorrado.data.nombre}
            detalle={confirmarBorrado.enUso > 0 ? confirmarBorrado.enUso + " despacho(s) históricos usan esta sede. No se eliminarán, pero quedarán con un código sin nombre visible." : "Esta sede no tiene despachos asociados."}
            onConfirm={ejecutarBorrado}
            onCancel={() => setConfirmarBorrado(null)}
          />
        </Modal>
      )}
      {confirmarBorrado && confirmarBorrado.tipo === "valor" && (
        <Modal title="Eliminar valor" onClose={() => setConfirmarBorrado(null)}>
          <ConfirmarEliminar
            titulo={confirmarBorrado.data}
            detalle={"Ya no aparecerá como sugerencia en " + labelCampo[campoActivo].toLowerCase() + "."}
            onConfirm={ejecutarBorrado}
            onCancel={() => setConfirmarBorrado(null)}
          />
        </Modal>
      )}
    </div>
  );
}

const OPERACIONES = { contar: "Contar registros", sumar: "Sumar monto", promediar: "Promediar monto", porcentaje: "% del total filtrado" };
const CAMPOS_FILTRO = { tipo: "Tipo", tienda: "Tienda", cobra: "¿Se cobra?", estado: "Estado" };

function calcularMetrica(m, despachos) {
  let base = despachos;
  if (m.filtroCampo && m.filtroValor !== "" && m.filtroValor != null) {
    base = base.filter((d) => {
      if (m.filtroCampo === "cobra") return String(d.cobra) === m.filtroValor;
      return String(d[m.filtroCampo] || "") === m.filtroValor;
    });
  }
  if (m.operacion === "contar") return base.length;
  if (m.operacion === "sumar") return base.reduce((acc, d) => acc + (Number(d.monto) || 0), 0);
  if (m.operacion === "promediar") {
    const conMonto = base.filter((d) => d.monto !== "" && d.monto != null && !isNaN(Number(d.monto)));
    if (conMonto.length === 0) return 0;
    return conMonto.reduce((acc, d) => acc + Number(d.monto), 0) / conMonto.length;
  }
  if (m.operacion === "porcentaje") {
    if (despachos.length === 0) return 0;
    return (base.length / despachos.length) * 100;
  }
  return 0;
}

function formatoMetrica(valor, operacion) {
  if (operacion === "sumar" || operacion === "promediar") return "S/ " + valor.toFixed(2);
  if (operacion === "porcentaje") return valor.toFixed(1) + "%";
  return String(Math.round(valor));
}

function FormMetrica({ onSave, onCancel, tiendas, sedes }) {
  const [m, setM] = useState({ nombre: "", operacion: "contar", filtroCampo: "", filtroValor: "" });
  const labelStyle = { fontSize: 13, color: "var(--text-secondary)", display: "block", marginBottom: 4 };

  const opcionesValor = () => {
    if (m.filtroCampo === "tipo") return Object.keys(TIPOS).map((k) => ({ v: k, l: TIPOS[k].label }));
    if (m.filtroCampo === "tienda") return sedes.map((s) => ({ v: s.codigo, l: s.codigo + " · " + s.nombre }));
    if (m.filtroCampo === "cobra") return [{ v: "true", l: "Sí cobra" }, { v: "false", l: "No cobra" }];
    if (m.filtroCampo === "estado") return [{ v: "pendiente", l: "Pendiente" }, { v: "entregado", l: "Entregado" }];
    return [];
  };

  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <label style={labelStyle}>Nombre de la métrica</label>
        <input style={{ width: "100%" }} value={m.nombre} onChange={(e) => setM(Object.assign({}, m, { nombre: e.target.value }))} placeholder="Ej: Ventas que cobran" />
      </div>
      <div style={{ marginBottom: 12 }}>
        <label style={labelStyle}>Operación</label>
        <select style={{ width: "100%" }} value={m.operacion} onChange={(e) => setM(Object.assign({}, m, { operacion: e.target.value }))}>
          {Object.keys(OPERACIONES).map((k) => <option key={k} value={k}>{OPERACIONES[k]}</option>)}
        </select>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
        <div>
          <label style={labelStyle}>Filtrar por (opcional)</label>
          <select style={{ width: "100%" }} value={m.filtroCampo} onChange={(e) => setM(Object.assign({}, m, { filtroCampo: e.target.value, filtroValor: "" }))}>
            <option value="">Sin filtro</option>
            {Object.keys(CAMPOS_FILTRO).map((k) => <option key={k} value={k}>{CAMPOS_FILTRO[k]}</option>)}
          </select>
        </div>
        {m.filtroCampo && (
          <div>
            <label style={labelStyle}>Valor</label>
            <select style={{ width: "100%" }} value={m.filtroValor} onChange={(e) => setM(Object.assign({}, m, { filtroValor: e.target.value }))}>
              <option value="">Selecciona...</option>
              {opcionesValor().map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
            </select>
          </div>
        )}
      </div>
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button onClick={onCancel}>Cancelar</button>
        <button style={{ borderColor: BRAND.rojo, color: BRAND.rojo }} onClick={() => m.nombre.trim() && onSave(Object.assign({}, m, { id: uid() }))}>
          <Icon name="check" /> Crear métrica
        </button>
      </div>
    </div>
  );
}

const RANGOS = {
  hoy: { label: "Hoy", dias: 0 },
  semana: { label: "Última semana", dias: 7 },
  mes: { label: "Último mes", dias: 30 },
  todo: { label: "Todo el histórico", dias: null },
  custom: { label: "Rango personalizado", dias: "custom" },
};

function VistaReportes({ despachos, metricas, setMetricas, sedes, bloques }) {
  const [rango, setRango] = useState("mes");
  const [desde, setDesde] = useState(diasAtras(30));
  const [hasta, setHasta] = useState(hoy());
  const [formMetrica, setFormMetrica] = useState(false);
  const canvasRef = useRef(null);

  const despachosFiltrados = useMemo(() => {
    if (rango === "todo") return despachos;
    if (rango === "hoy") return despachos.filter((d) => d.fecha === hoy());
    if (rango === "custom") return despachos.filter((d) => d.fecha >= desde && d.fecha <= hasta);
    const inicio = diasAtras(RANGOS[rango].dias);
    return despachos.filter((d) => d.fecha >= inicio);
  }, [despachos, rango, desde, hasta]);

  const comparacion = useMemo(() => {
    if (rango === "todo" || rango === "custom") return null;
    const diasRango = rango === "hoy" ? 1 : RANGOS[rango].dias;
    const inicioActual = rango === "hoy" ? hoy() : diasAtras(diasRango);
    const inicioAnterior = diasAtras(diasRango * 2);
    const finAnterior = diasAtras(diasRango);
    const anterior = despachos.filter((d) => d.fecha >= inicioAnterior && d.fecha < finAnterior).length;
    if (anterior === 0) return null;
    const actual = despachosFiltrados.length;
    const delta = ((actual - anterior) / anterior) * 100;
    return { delta, anterior };
  }, [despachos, despachosFiltrados, rango]);

  const porDia = {};
  despachosFiltrados.forEach((d) => { porDia[d.fecha] = (porDia[d.fecha] || 0) + 1; });
  const fechasOrdenadas = Object.keys(porDia).sort();
  const tiendas = Array.from(new Set(despachos.map((d) => d.tienda).filter(Boolean)));

  const mapaHoraBloque = {};
  (bloques || []).forEach((b) => { mapaHoraBloque[b.nombre] = b.inicio + "–" + b.fin; });
  const rangoDeHora = (nombreBloque) => mapaHoraBloque[nombreBloque] || nombreBloque;

  const bloquesUsados = Array.from(new Set(despachosFiltrados.map((d) => d.bloqueNombre).filter(Boolean)))
    .sort((a, c) => (mapaHoraBloque[a] || a).localeCompare(mapaHoraBloque[c] || c));
  const heat = {};
  despachosFiltrados.forEach((d) => { if (!d.tienda) return; const key = d.bloqueNombre + "|" + d.tienda; heat[key] = (heat[key] || 0) + 1; });
  const heatValues = Object.keys(heat).map((k) => heat[k]);
  const maxHeat = Math.max(1, heatValues.length ? Math.max.apply(null, heatValues) : 1);

  useEffect(() => {
    function renderChart() {
      if (!canvasRef.current || !window.Chart) return;
      if (canvasRef.current._chart) canvasRef.current._chart.destroy();
      canvasRef.current._chart = new window.Chart(canvasRef.current, {
        type: "bar",
        data: { labels: fechasOrdenadas, datasets: [{ label: "Despachos por día", data: fechasOrdenadas.map((f) => porDia[f]), backgroundColor: BRAND.rojo, borderRadius: 4 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } }, x: { ticks: { maxRotation: 45, minRotation: 45, font: { size: 10 } } } } },
      });
    }
    if (!window.Chart) {
      const s = document.createElement("script");
      s.src = "https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js";
      s.onload = renderChart;
      document.body.appendChild(s);
    } else renderChart();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [despachosFiltrados.length, rango, desde, hasta]);

  const guardarMetrica = (m) => { setMetricas((prev) => prev.concat([m])); setFormMetrica(false); };
  const eliminarMetrica = (id) => setMetricas((prev) => prev.filter((m) => m.id !== id));

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
        {Object.keys(RANGOS).map((k) => (
          <button key={k} onClick={() => setRango(k)} style={{ fontSize: 13, height: 32, padding: "0 12px", borderColor: rango === k ? BRAND.rojo : "var(--border)", color: rango === k ? BRAND.rojo : "var(--text-secondary)" }}>
            {RANGOS[k].label}
          </button>
        ))}
      </div>
      {rango === "custom" && (
        <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 16 }}>
          <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
          <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>hasta</span>
          <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
        </div>
      )}
      <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 20 }}>{despachosFiltrados.length} despachos en el rango seleccionado</p>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <h3 style={{ margin: 0 }}>Métricas</h3>
        <button onClick={() => setFormMetrica(true)} style={{ fontSize: 13, height: 30, padding: "0 10px" }}><Icon name="plus" size={14} /> Nueva métrica</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 28 }}>
        <style>{"@keyframes statIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }"}</style>
        <div style={{ background: "var(--surface-1)", borderRadius: "var(--radius)", padding: "1rem", animation: "statIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)" }}>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "0 0 4px" }}>Total en el rango</p>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <p style={{ fontSize: 24, fontWeight: 500, margin: 0 }}>{despachosFiltrados.length}</p>
            {comparacion && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 2, fontSize: 12, fontWeight: 500, color: comparacion.delta >= 0 ? "#0F6E56" : BRAND.rojo }}>
                <Icon name={comparacion.delta >= 0 ? "trending-up" : "trending-down"} size={14} />
                {Math.abs(comparacion.delta).toFixed(0)}%
              </span>
            )}
          </div>
          {comparacion && <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "2px 0 0" }}>vs. periodo anterior ({comparacion.anterior})</p>}
        </div>
        <div style={{ background: "var(--surface-1)", borderRadius: "var(--radius)", padding: "1rem", animation: "statIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) 0.03s backwards" }}>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "0 0 4px" }}>Días con actividad</p>
          <p style={{ fontSize: 24, fontWeight: 500, margin: 0 }}>{fechasOrdenadas.length}</p>
        </div>
        <div style={{ background: "var(--surface-1)", borderRadius: "var(--radius)", padding: "1rem", animation: "statIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) 0.06s backwards" }}>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "0 0 4px" }}>Promedio por día</p>
          <p style={{ fontSize: 24, fontWeight: 500, margin: 0 }}>{fechasOrdenadas.length ? (despachosFiltrados.length / fechasOrdenadas.length).toFixed(1) : "0"}</p>
        </div>
        {metricas.map((m, idx) => {
          const valor = calcularMetrica(m, despachosFiltrados);
          return (
            <div key={m.id} style={{ background: "var(--surface-1)", borderRadius: "var(--radius)", padding: "1rem", position: "relative", animation: "statIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) " + (0.09 + idx * 0.03) + "s backwards" }}>
              <button onClick={() => eliminarMetrica(m.id)} aria-label="Eliminar métrica" style={{ position: "absolute", top: 8, right: 8, width: 22, height: 22, padding: 0, border: "none" }}><Icon name="x" size={13} /></button>
              <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "0 0 4px", paddingRight: 18 }}>{m.nombre}</p>
              <p style={{ fontSize: 24, fontWeight: 500, margin: 0, color: BRAND.rojo }}>{formatoMetrica(valor, m.operacion)}</p>
            </div>
          );
        })}
      </div>


      <h3 style={{ marginBottom: 12 }}>Tendencia de despachos por día</h3>
      <div style={{ overflowX: "auto", marginBottom: 32 }}>
        <div style={{ position: "relative", height: 240, minWidth: Math.max(320, fechasOrdenadas.length * 34) }}>
          <canvas ref={canvasRef} />
        </div>
      </div>

      <h3 style={{ marginBottom: 4 }}>Saturación por horario y sede</h3>
      <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 12 }}>Más intenso = más despachos concentrados en ese horario para esa sede, dentro del rango elegido.</p>
      {bloquesUsados.length === 0 || tiendas.length === 0 ? (
        <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Aún no hay suficientes datos con tienda asignada en este rango.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse", fontSize: 12 }}>
            <thead><tr><th style={{ padding: 6 }}></th>{tiendas.map((t) => <th key={t} style={{ padding: 6, textAlign: "center", fontWeight: 500, minWidth: 90 }}>{sedeLabel(t, sedes)}</th>)}</tr></thead>
            <tbody>
              {bloquesUsados.map((b) => (
                <tr key={b}>
                  <td style={{ padding: 6, fontWeight: 500, whiteSpace: "nowrap" }}>{rangoDeHora(b)}</td>
                  {tiendas.map((t) => {
                    const v = heat[b + "|" + t] || 0;
                    const intensity = v / maxHeat;
                    const bg = v === 0 ? "var(--surface-1)" : intensity < 0.5
                      ? "rgba(9, 31, 66, " + (0.08 + intensity * 2 * 0.35) + ")"
                      : "rgba(189, 11, 59, " + (0.15 + (intensity - 0.5) * 2 * 0.55) + ")";
                    return <td key={t} style={{ padding: 6, textAlign: "center", background: bg, borderRadius: 4, color: intensity > 0.55 ? "#fff" : "var(--text-primary)", transition: "background 0.2s ease" }}>{v || ""}</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {formMetrica && (
        <Modal title="Nueva métrica" onClose={() => setFormMetrica(false)}>
          <FormMetrica onSave={guardarMetrica} onCancel={() => setFormMetrica(false)} tiendas={tiendas} sedes={sedes} />
        </Modal>
      )}
    </div>
  );
}

function PantallaCarga() {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 300, gap: 10, color: "var(--text-secondary, #5B6272)" }}>
      <div style={{ width: 34, height: 34, borderRadius: "50%", background: BRAND.rojo, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ color: "#fff", fontWeight: 500, fontSize: 15 }}>P</span>
      </div>
      <p style={{ fontSize: 13, margin: 0 }}>Cargando datos de Pronort...</p>
    </div>
  );
}

export default function App() {
  const [tab, setTab] = useState("calendario");
  const [mesActual, setMesActual] = useState(hoy().slice(0, 7));
  const [diaSeleccionado, setDiaSeleccionado] = useState(null);
  const [theme, setTheme] = useTemaLocal();
  const isDark = theme === "dark";

  const bloquesDB = useBloquesDB();
  const despachosDB = useDespachosDB();
  const catalogosDB = useCatalogosDB();
  const metricasDB = useMetricasDB();
  const sedesDB = useSedesDB();

  // --- Capa de compatibilidad: los componentes de vista fueron escritos
  // esperando setX(prev => next) como useState. Aquí traducimos esas
  // llamadas a operaciones reales contra Supabase (insert/update/delete),
  // comparando el arreglo anterior con el que el componente hijo produjo.
  const setBloques = (updater) => {
    const prev = bloquesDB.bloques;
    const next = typeof updater === "function" ? updater(prev) : updater;
    if (next.length > prev.length) {
      const nuevo = next.find((b) => !prev.some((p) => p.id === b.id));
      if (nuevo) bloquesDB.agregar(nuevo);
    } else if (next.length < prev.length) {
      const quitado = prev.find((b) => !next.some((n) => n.id === b.id));
      if (quitado) bloquesDB.eliminar(quitado.id);
    } else {
      const cambiado = next.find((b, i) => JSON.stringify(b) !== JSON.stringify(prev[i]));
      if (cambiado) bloquesDB.actualizar(cambiado.id, cambiado);
    }
  };

  const setDespachos = (updater) => {
    const prev = despachosDB.despachos;
    const next = typeof updater === "function" ? updater(prev) : updater;
    if (next.length > prev.length) {
      const nuevo = next.find((d) => !prev.some((p) => p.id === d.id));
      if (nuevo) {
        despachosDB.guardar(nuevo);
        CAMPOS_CATALOGO.forEach((campo) => {
          const val = (nuevo[campo] || "").trim();
          if (val) catalogosDB.agregarSiNoExiste(campo, val);
        });
      }
    } else if (next.length < prev.length) {
      const quitado = prev.find((d) => !next.some((n) => n.id === d.id));
      if (quitado) despachosDB.eliminar(quitado.id);
    } else {
      const cambiado = next.find((d, i) => JSON.stringify(d) !== JSON.stringify(prev[i]));
      if (cambiado) {
        despachosDB.guardar(cambiado);
        CAMPOS_CATALOGO.forEach((campo) => {
          const val = (cambiado[campo] || "").trim();
          if (val) catalogosDB.agregarSiNoExiste(campo, val);
        });
      }
    }
  };

  const setSedes = (updater) => {
    const prev = sedesDB.sedes;
    const next = typeof updater === "function" ? updater(prev) : updater;
    if (next.length > prev.length) {
      const nueva = next.find((s) => !prev.some((p) => p.codigo === s.codigo));
      if (nueva) sedesDB.agregar(nueva);
    } else if (next.length < prev.length) {
      const quitada = prev.find((s) => !next.some((n) => n.codigo === s.codigo));
      if (quitada) sedesDB.eliminar(quitada.codigo);
    } else {
      const cambiada = next.find((s, i) => JSON.stringify(s) !== JSON.stringify(prev[i]));
      if (cambiada) {
        const original = prev.find((s, i) => next[i] && next[i].codigo === cambiada.codigo);
        sedesDB.actualizar(cambiada.codigo, cambiada);
      }
    }
  };

  const setCatalogosGuardados = (updater) => {
    const prev = catalogosDB.catalogos;
    const next = typeof updater === "function" ? updater(prev) : updater;
    CAMPOS_CATALOGO.forEach((campo) => {
      const prevVals = prev[campo] || [];
      const nextVals = next[campo] || [];
      nextVals.forEach((v) => { if (prevVals.indexOf(v) === -1) catalogosDB.agregarSiNoExiste(campo, v); });
      prevVals.forEach((v) => { if (nextVals.indexOf(v) === -1) catalogosDB.eliminar(campo, v); });
      prevVals.forEach((vOld, i) => {
        if (nextVals[i] && nextVals[i] !== vOld && nextVals.indexOf(vOld) === -1 && prevVals.indexOf(nextVals[i]) === -1) {
          catalogosDB.editar(campo, vOld, nextVals[i]);
        }
      });
    });
  };

  const setMetricas = (updater) => {
    const prev = metricasDB.metricas;
    const next = typeof updater === "function" ? updater(prev) : updater;
    if (next.length > prev.length) {
      const nueva = next.find((m) => !prev.some((p) => p.id === m.id));
      if (nueva) metricasDB.agregar(nueva);
    } else if (next.length < prev.length) {
      const quitada = prev.find((m) => !next.some((n) => n.id === m.id));
      if (quitada) metricasDB.eliminar(quitada.id);
    }
  };

  const bloques = bloquesDB.bloques;
  const despachos = despachosDB.despachos;
  const catalogosGuardados = catalogosDB.catalogos;
  const metricas = metricasDB.metricas;
  const sedes = sedesDB.sedes;

  const cargando = bloquesDB.cargando || despachosDB.cargando || catalogosDB.cargando || metricasDB.cargando || sedesDB.cargando;

  const themeVars = isDark
    ? { "--surface-0": "#0B0F1E", "--surface-1": "#151B30", "--surface-2": "#1C2438", "--text-primary": "#F2F3F7", "--text-secondary": "#A9AFC3", "--text-muted": "#7A8099", "--border": "rgba(255,255,255,0.1)", "--border-strong": "rgba(255,255,255,0.18)", "--radius": "8px" }
    : { "--surface-0": "#F7F6F3", "--surface-1": "#FFFFFF", "--surface-2": "#FFFFFF", "--text-primary": "#0B1220", "--text-secondary": "#5B6272", "--text-muted": "#9498A3", "--border": "rgba(9,31,66,0.12)", "--border-strong": "rgba(9,31,66,0.22)", "--radius": "8px" };

  const tabs = [
    { id: "calendario", label: "Calendario", icon: "calendar" },
    { id: "historial", label: "Historial", icon: "list" },
    { id: "reportes", label: "Reportes", icon: "chart-bar" },
    { id: "catalogos", label: "Catálogos", icon: "database" },
  ];

  const editarDesdeHistorial = (d) => { setDiaSeleccionado(d.fecha); setTab("calendario"); };
  const eliminarDesdeHistorial = (id) => despachosDB.eliminar(id);
  const totalHoy = despachos.filter((d) => d.fecha === hoy()).length;

  return (
    <div style={Object.assign({}, themeVars, { background: "var(--surface-0)", borderRadius: 16, padding: "1.25rem", maxWidth: 780, margin: "0 auto", minHeight: "100vh", transition: "background 0.25s ease" })}>
      <style>{"* { transition: background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease; } @keyframes spinIn { from { transform: rotate(-90deg) scale(0.6); opacity: 0; } to { transform: rotate(0) scale(1); opacity: 1; } }"}</style>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 34, height: 34, borderRadius: "50%", background: BRAND.rojo, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <span style={{ color: "#fff", fontWeight: 500, fontSize: 15 }}>P</span>
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <p style={{ margin: 0, fontWeight: 500, fontSize: 15, color: "var(--text-primary)", letterSpacing: 0.3 }}>PRONORT</p>
              {totalHoy > 0 && (
                <span style={{ fontSize: 11, fontWeight: 500, color: BRAND.rojo, background: isDark ? "rgba(255,107,143,0.12)" : "rgba(189,11,59,0.08)", borderRadius: 20, padding: "1px 8px" }}>
                  {totalHoy} hoy
                </span>
              )}
            </div>
            <p style={{ margin: 0, fontSize: 11, color: "var(--text-secondary)" }}>Programación de despachos</p>
          </div>
        </div>
        <button key={theme} onClick={() => setTheme(isDark ? "light" : "dark")} aria-label="Cambiar tema" style={{ width: 36, height: 36, padding: 0, animation: "spinIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)" }}>
          <Icon name={isDark ? "sun" : "moon"} size={17} />
        </button>
      </div>

      {cargando ? (
        <PantallaCarga />
      ) : (
        <React.Fragment>
          <div style={{ display: "flex", gap: 4, marginBottom: 20, borderBottom: "0.5px solid var(--border)", overflowX: "auto" }}>
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => { setTab(t.id); if (t.id === "calendario") setDiaSeleccionado(null); }}
                style={{ border: "none", borderBottom: tab === t.id ? "2px solid " + BRAND.rojo : "2px solid transparent", borderRadius: 0, background: "transparent", padding: "8px 14px", fontWeight: 500, color: tab === t.id ? "var(--text-primary)" : "var(--text-secondary)", whiteSpace: "nowrap", transition: "border-color 0.2s ease, color 0.2s ease" }}
              >
                <Icon name={t.icon} size={16} /> {t.label}
              </button>
            ))}
          </div>

          {tab === "calendario" && !diaSeleccionado && <VistaCalendario mesActual={mesActual} setMesActual={setMesActual} despachos={despachos} onSelectDia={setDiaSeleccionado} />}
          {tab === "calendario" && diaSeleccionado && (
            <VistaDia fecha={diaSeleccionado} onVolver={() => setDiaSeleccionado(null)} bloques={bloques} setBloques={setBloques} despachos={despachos} setDespachos={setDespachos} isDark={isDark} catalogos={catalogosGuardados} sedes={sedes} />
          )}
          {tab === "historial" && <VistaHistorial despachos={despachos} onEdit={editarDesdeHistorial} onDelete={eliminarDesdeHistorial} sedes={sedes} />}
          {tab === "reportes" && <VistaReportes despachos={despachos} metricas={metricas} setMetricas={setMetricas} sedes={sedes} bloques={bloques} />}
          {tab === "catalogos" && <VistaCatalogos catalogos={catalogosGuardados} setCatalogos={setCatalogosGuardados} sedes={sedes} setSedes={setSedes} despachos={despachos} />}
        </React.Fragment>
      )}
    </div>
  );
}
