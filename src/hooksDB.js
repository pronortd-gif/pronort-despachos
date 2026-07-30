import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "./supabaseClient";

// ---------------- Sedes ----------------
export function useSedesDB() {
  const [sedes, setSedes] = useState([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    supabase.from("sedes").select("*").order("codigo").then(({ data }) => {
      setSedes(data || []);
      setCargando(false);
    });
  }, []);

  const agregar = async (nuevaSede) => {
    const { data, error } = await supabase.from("sedes").insert(nuevaSede).select().single();
    if (!error) setSedes((prev) => prev.concat([data]).sort((a, b) => a.codigo.localeCompare(b.codigo)));
    return error;
  };
  const actualizar = async (codigoViejo, sedeActualizada) => {
    const { data, error } = await supabase.from("sedes").update(sedeActualizada).eq("codigo", codigoViejo).select().single();
    if (!error) setSedes((prev) => prev.map((x) => (x.codigo === codigoViejo ? data : x)));
    return error;
  };
  const eliminar = async (codigo) => {
    const { error } = await supabase.from("sedes").delete().eq("codigo", codigo);
    if (!error) setSedes((prev) => prev.filter((x) => x.codigo !== codigo));
    return error;
  };

  return { sedes, cargando, agregar, actualizar, eliminar };
}

// ---------------- Horarios (bloques) ----------------
// Ahora pertenecen a una fecha concreta: cada día tiene los suyos.
export function useBloquesDB() {
  const [porFecha, setPorFecha] = useState({}); // { "2026-07-25": [bloques] }
  const [cargandoFechas, setCargandoFechas] = useState({});
  const solicitadas = useRef(new Set());

  const cargarFecha = useCallback(async (fecha) => {
    if (!fecha || solicitadas.current.has(fecha)) return;
    solicitadas.current.add(fecha);
    setCargandoFechas((prev) => Object.assign({}, prev, { [fecha]: true }));
    const { data } = await supabase.from("bloques").select("*").eq("fecha", fecha).order("inicio");
    setPorFecha((prev) => Object.assign({}, prev, { [fecha]: data || [] }));
    setCargandoFechas((prev) => Object.assign({}, prev, { [fecha]: false }));
  }, []);

  const bloquesDe = (fecha) => porFecha[fecha] || [];
  const cargandoDe = (fecha) => Boolean(cargandoFechas[fecha]);

  const ordenar = (lista) => lista.slice().sort((a, c) => a.inicio.localeCompare(c.inicio));

  const agregar = async (fecha, bloque) => {
    const { data, error } = await supabase
      .from("bloques")
      .insert({ fecha: fecha, nombre: bloque.nombre || null, inicio: bloque.inicio, fin: bloque.fin })
      .select().single();
    if (!error) setPorFecha((prev) => Object.assign({}, prev, { [fecha]: ordenar((prev[fecha] || []).concat([data])) }));
    return error;
  };

  const actualizar = async (fecha, id, bloque) => {
    const { data, error } = await supabase
      .from("bloques")
      .update({ nombre: bloque.nombre || null, inicio: bloque.inicio, fin: bloque.fin })
      .eq("id", id).select().single();
    if (!error) setPorFecha((prev) => Object.assign({}, prev, { [fecha]: ordenar((prev[fecha] || []).map((x) => (x.id === id ? data : x))) }));
    return error;
  };

  const eliminar = async (fecha, id) => {
    const { error } = await supabase.from("bloques").delete().eq("id", id);
    if (!error) setPorFecha((prev) => Object.assign({}, prev, { [fecha]: (prev[fecha] || []).filter((x) => x.id !== id) }));
    return error;
  };

  // Crea un horario y devuelve el registro creado (con su id), para
  // poder seleccionarlo de inmediato en el mismo formulario de
  // despacho, sin tener que salir a "Nuevo horario de salida" antes.
  const crearRapido = async (fecha, bloque) => {
    const { data, error } = await supabase
      .from("bloques")
      .insert({ fecha: fecha, nombre: bloque.nombre || null, inicio: bloque.inicio, fin: bloque.fin })
      .select().single();
    if (!error) setPorFecha((prev) => Object.assign({}, prev, { [fecha]: ordenar((prev[fecha] || []).concat([data])) }));
    return { bloque: data, error };
  };

  // Copia los horarios de otra fecha: evita recrearlos a mano cada día.
  const copiarDesde = async (fechaOrigen, fechaDestino) => {
    const { data: origen } = await supabase.from("bloques").select("*").eq("fecha", fechaOrigen).order("inicio");
    if (!origen || origen.length === 0) return { copiados: 0 };
    const nuevos = origen.map((b) => ({ fecha: fechaDestino, nombre: b.nombre, inicio: b.inicio, fin: b.fin }));
    const { data, error } = await supabase.from("bloques").insert(nuevos).select();
    if (error) return { copiados: 0, error };
    setPorFecha((prev) => Object.assign({}, prev, { [fechaDestino]: ordenar((prev[fechaDestino] || []).concat(data || [])) }));
    return { copiados: (data || []).length };
  };

  return { bloquesDe, cargandoDe, cargarFecha, agregar, actualizar, eliminar, copiarDesde, crearRapido };
}

// ---------------- Despachos ----------------
function despachoDbToApp(f) {
  const base = {
    id: f.id,
    fecha: f.fecha,
    bloqueId: f.bloque_id || "",
    tipo: f.tipo || "VENTA",
    tienda: f.tienda || "",
    cliente: f.cliente || "",
    proveedor: f.proveedor || "",
    sedeDestino: f.sede_destino || "",
    celular: f.celular || "",
    // Movimiento guarda un celular por persona; los demás tipos usan el campo "celular" compartido de arriba.
    celular1: f.celular_persona1 || "",
    celular2: f.celular_persona2 || "",
    comprobante: f.comprobante || "",
    numGuia: f.num_guia || "",
    cobra: Boolean(f.cobra),
    monto: f.monto != null ? String(f.monto) : "",
    direccion: f.direccion || "",
    mapsUrl: f.maps_url || "",
    estado: f.estado || "pendiente",
    orden: f.orden || 0,
    creadoEn: f.created_at || null,
  };
  // Las dos personas se guardan en columnas distintas según el tipo,
  // para que la base de datos siga siendo legible por sí sola.
  if (base.tipo === "COMPRA") {
    base.persona1 = f.gestionado_por || "";
    base.persona2 = f.entregado_por || "";
  } else if (base.tipo === "MOV_MERCADERIA") {
    base.persona1 = f.trasladado_por || "";
    base.persona2 = f.recibe_destino || "";
  } else {
    base.persona1 = f.responsable || "";
    base.persona2 = "";
  }
  return base;
}

function despachoAppToDb(d) {
  const fila = {
    fecha: d.fecha,
    bloque_id: d.bloqueId || null,
    tipo: d.tipo,
    tienda: d.tienda || null,
    cliente: null, proveedor: null, sede_destino: null,
    responsable: null, gestionado_por: null, entregado_por: null,
    trasladado_por: null, recibe_destino: null,
    celular: d.celular || null,
    celular_persona1: d.celular1 || null,
    celular_persona2: d.celular2 || null,
    comprobante: d.comprobante || null,
    num_guia: d.numGuia || null,
    cobra: Boolean(d.cobra),
    monto: d.monto !== "" && d.monto != null ? Number(d.monto) : null,
    direccion: d.direccion || null,
    maps_url: d.mapsUrl || null,
    estado: d.estado || "pendiente",
    orden: d.orden != null ? d.orden : 0,
  };
  if (d.tipo === "COMPRA") {
    fila.proveedor = d.proveedor || null;
    fila.gestionado_por = d.persona1 || null;
    fila.entregado_por = d.persona2 || null;
  } else if (d.tipo === "MOV_MERCADERIA") {
    fila.sede_destino = d.sedeDestino || null;
    fila.trasladado_por = d.persona1 || null;
    fila.recibe_destino = d.persona2 || null;
  } else {
    fila.cliente = d.cliente || null;
    fila.responsable = d.persona1 || null;
  }
  return fila;
}

export function useDespachosDB() {
  const [despachos, setDespachos] = useState([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    supabase.from("despachos").select("*").order("fecha", { ascending: false }).then(({ data }) => {
      setDespachos((data || []).map(despachoDbToApp));
      setCargando(false);
    });
  }, []);

  const guardar = async (despacho) => {
    const yaExiste = despachos.some((x) => x.id === despacho.id);
    if (yaExiste) {
      const { data, error } = await supabase.from("despachos").update(despachoAppToDb(despacho)).eq("id", despacho.id).select().single();
      if (!error) setDespachos((prev) => prev.map((x) => (x.id === despacho.id ? despachoDbToApp(data) : x)));
      return error;
    }
    const { data, error } = await supabase.from("despachos").insert(despachoAppToDb(despacho)).select().single();
    if (!error) setDespachos((prev) => prev.concat([despachoDbToApp(data)]));
    return error;
  };

  const eliminar = async (id) => {
    const { error } = await supabase.from("despachos").delete().eq("id", id);
    if (!error) setDespachos((prev) => prev.filter((x) => x.id !== id));
    return error;
  };

  // Cambia el estado a uno explícito de los 3 posibles. Se usa un
  // estado explícito (no un alternador de 2 valores) a propósito:
  // así "marcar todo como entregado" nunca puede pisar por error un
  // despacho que ya se había marcado como "no entregado".
  const cambiarEstado = async (id, nuevoEstado) => {
    const actual = despachos.find((x) => x.id === id);
    if (!actual) return;
    setDespachos((prev) => prev.map((x) => (x.id === id ? Object.assign({}, x, { estado: nuevoEstado }) : x)));
    const { error } = await supabase.from("despachos").update({ estado: nuevoEstado }).eq("id", id);
    if (error) setDespachos((prev) => prev.map((x) => (x.id === id ? actual : x)));
  };

  // Actualiza solo el orden manual (para reordenar dentro de un bloque
  // sin reescribir todo el despacho).
  const actualizarOrden = async (id, ordenNuevo) => {
    const actual = despachos.find((x) => x.id === id);
    if (!actual) return;
    setDespachos((prev) => prev.map((x) => (x.id === id ? Object.assign({}, x, { orden: ordenNuevo }) : x)));
    const { error } = await supabase.from("despachos").update({ orden: ordenNuevo }).eq("id", id);
    if (error) setDespachos((prev) => prev.map((x) => (x.id === id ? actual : x)));
  };

  return { despachos, cargando, guardar, eliminar, cambiarEstado, actualizarOrden };
}

// ---------------- Catálogos de sugerencias ----------------
export function useCatalogosDB() {
  const [catalogos, setCatalogos] = useState({ cliente: [], proveedor: [], responsable: [], celular: [], direccion: [] });
  const [cargando, setCargando] = useState(true);
  // Copia sincronizada para consultar sin leer estado dentro del setter
  // (leerlo así no es fiable y podía intentar insertar duplicados).
  const actuales = useRef({ cliente: [], proveedor: [], responsable: [], celular: [], direccion: [] });

  const aplicar = (siguiente) => {
    actuales.current = siguiente;
    setCatalogos(siguiente);
  };

  useEffect(() => {
    supabase.from("catalogos").select("*").then(({ data }) => {
      const inicial = { cliente: [], proveedor: [], responsable: [], celular: [], direccion: [] };
      (data || []).forEach((fila) => { if (inicial[fila.campo]) inicial[fila.campo].push(fila.valor); });
      aplicar(inicial);
      setCargando(false);
    });
  }, []);

  const agregarSiNoExiste = async (campo, valorNuevo) => {
    const valor = (valorNuevo || "").trim();
    if (!valor || !actuales.current[campo]) return;
    if (actuales.current[campo].indexOf(valor) !== -1) return;
    // Se agrega primero en memoria para que dos guardados seguidos no
    // intenten insertar el mismo valor dos veces.
    aplicar(Object.assign({}, actuales.current, { [campo]: actuales.current[campo].concat([valor]) }));
    const { error } = await supabase.from("catalogos").insert({ campo, valor });
    if (error) {
      aplicar(Object.assign({}, actuales.current, { [campo]: actuales.current[campo].filter((v) => v !== valor) }));
    }
  };

  const editar = async (campo, valorViejo, valorNuevo) => {
    const { error } = await supabase.from("catalogos").update({ valor: valorNuevo }).eq("campo", campo).eq("valor", valorViejo);
    if (!error) aplicar(Object.assign({}, actuales.current, { [campo]: actuales.current[campo].map((v) => (v === valorViejo ? valorNuevo : v)) }));
  };

  const eliminar = async (campo, valor) => {
    const { error } = await supabase.from("catalogos").delete().eq("campo", campo).eq("valor", valor);
    if (!error) aplicar(Object.assign({}, actuales.current, { [campo]: actuales.current[campo].filter((v) => v !== valor) }));
  };

  return { catalogos, cargando, agregarSiNoExiste, editar, eliminar };
}

// ---------------- Métricas ----------------
export function useMetricasDB() {
  const [metricas, setMetricas] = useState([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    supabase.from("metricas").select("*").then(({ data }) => {
      setMetricas((data || []).map((m) => ({ id: m.id, nombre: m.nombre, operacion: m.operacion, filtroCampo: m.filtro_campo || "", filtroValor: m.filtro_valor || "" })));
      setCargando(false);
    });
  }, []);

  const agregar = async (metrica) => {
    const { data, error } = await supabase.from("metricas")
      .insert({ nombre: metrica.nombre, operacion: metrica.operacion, filtro_campo: metrica.filtroCampo || null, filtro_valor: metrica.filtroValor || null })
      .select().single();
    if (!error) setMetricas((prev) => prev.concat([{ id: data.id, nombre: data.nombre, operacion: data.operacion, filtroCampo: data.filtro_campo || "", filtroValor: data.filtro_valor || "" }]));
  };
  const eliminar = async (id) => {
    const { error } = await supabase.from("metricas").delete().eq("id", id);
    if (!error) setMetricas((prev) => prev.filter((m) => m.id !== id));
  };

  return { metricas, cargando, agregar, eliminar };
}

// Mapa de todos los horarios (para reportes: permite saber a qué hora
// salió cada despacho sin cargar fecha por fecha).
export function useMapaHorarios() {
  const [mapa, setMapa] = useState({});
  const [cargando, setCargando] = useState(true);

  const recargar = async () => {
    const { data } = await supabase.from("bloques").select("id, fecha, nombre, inicio, fin");
    const m = {};
    (data || []).forEach((b) => { m[b.id] = b; });
    setMapa(m);
    setCargando(false);
  };

  useEffect(() => { recargar(); }, []);

  return { mapa, cargando, recargar };
}

// ---------------- Tema ----------------
export function useTemaLocal() {
  const [tema, setTemaState] = useState(() => localStorage.getItem("pronort-theme") || "light");
  const setTema = (t) => { localStorage.setItem("pronort-theme", t); setTemaState(t); };
  return [tema, setTema];
}

// ---------------- Sesión ----------------
export function useSesion() {
  const [sesion, setSesion] = useState(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSesion(data.session);
      setCargando(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_evento, nuevaSesion) => setSesion(nuevaSesion));
    return () => sub.subscription.unsubscribe();
  }, []);

  const cerrarSesion = async () => { await supabase.auth.signOut(); };

  return { sesion, cargando, cerrarSesion };
}
