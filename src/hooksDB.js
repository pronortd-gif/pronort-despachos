import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "./supabaseClient";
import { diasAtras } from "./constants";

// ============================================================
// Reglas comunes de acceso a datos
// ============================================================

// Supabase (PostgREST) devuelve como máximo 1000 filas por consulta y no
// avisa de que truncó: simplemente manda menos datos. Con un select("*")
// pelado, al pasar los 1000 despachos el historial y los reportes
// empezarían a mentir en silencio. Esta función pide de a 1000 hasta
// agotar los resultados.
const TAMANO_PAGINA = 1000;

export async function traerTodo(construirConsulta) {
  const filas = [];
  for (let desde = 0; ; desde += TAMANO_PAGINA) {
    const { data, error } = await construirConsulta().range(desde, desde + TAMANO_PAGINA - 1);
    if (error) return { data: null, error };
    const lote = data || [];
    filas.push.apply(filas, lote);
    if (lote.length < TAMANO_PAGINA) break;
  }
  return { data: filas, error: null };
}

// Mensaje en español para el usuario. El detalle técnico va a la consola,
// que es donde sirve; en pantalla solo va algo accionable.
export function mensajeError(error, accion) {
  if (!error) return "";
  console.error("[Pronort] Error al " + accion + ":", error);
  const texto = (error.message || "").toLowerCase();
  if (texto.includes("failed to fetch") || texto.includes("network")) {
    return "Sin conexión. No se pudo " + accion + ". Revisa tu internet e intenta de nuevo.";
  }
  if (texto.includes("duplicate") || error.code === "23505") {
    return "Ya existe un registro con esos datos.";
  }
  if (texto.includes("violates foreign key") || error.code === "23503") {
    return "No se puede " + accion + ": hay otros registros que dependen de este.";
  }
  if (texto.includes("jwt") || texto.includes("token")) {
    return "Tu sesión expiró. Vuelve a entrar.";
  }
  return "No se pudo " + accion + ". Intenta de nuevo.";
}

// Cuántos días de despachos se cargan al abrir la app. El histórico
// completo se pide aparte (Historial y el rango "Todo" de Reportes),
// para no traer años de datos en cada arranque.
export const DIAS_VENTANA = 90;

// ---------------- Sedes ----------------
export function useSedesDB() {
  const [sedes, setSedes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let vigente = true;
    traerTodo(() => supabase.from("sedes").select("*").order("codigo")).then(({ data, error: err }) => {
      if (!vigente) return;
      if (err) setError(mensajeError(err, "cargar las sedes"));
      else setSedes(data);
      setCargando(false);
    });
    return () => { vigente = false; };
  }, []);

  const agregar = async (nuevaSede) => {
    const { data, error: err } = await supabase.from("sedes").insert(nuevaSede).select().single();
    if (err) return mensajeError(err, "guardar la sede");
    setSedes((prev) => prev.concat([data]).sort((a, b) => a.codigo.localeCompare(b.codigo)));
    return "";
  };

  const actualizar = async (codigoViejo, sedeActualizada) => {
    const { data, error: err } = await supabase.from("sedes").update(sedeActualizada).eq("codigo", codigoViejo).select().single();
    if (err) return mensajeError(err, "guardar la sede");
    setSedes((prev) => prev.map((x) => (x.codigo === codigoViejo ? data : x)).sort((a, b) => a.codigo.localeCompare(b.codigo)));
    return "";
  };

  // Cuenta CONTRA LA BASE cuántos despachos referencian esta sede, como
  // origen o como destino. No sirve contar los que hay en memoria: al
  // arrancar solo están los últimos 90 días, así que una sede con años
  // de historia podía parecer que no la usaba nadie.
  const contarUso = async (codigo) => {
    const { count, error: err } = await supabase
      .from("despachos")
      .select("id", { count: "exact", head: true })
      .or("tienda.eq." + codigo + ",sede_destino.eq." + codigo);
    if (err) return { total: null, error: mensajeError(err, "comprobar si la sede está en uso") };
    return { total: count || 0, error: "" };
  };

  const eliminar = async (codigo) => {
    // Comprobación de seguridad en el último momento: las dos claves
    // foráneas son "on delete set null", así que borrar una sede en uso
    // pondría en NULL la sede de TODOS sus despachos históricos, y eso
    // no lo arregla ningún "deshacer" — la sede se recrearía vacía y los
    // despachos ya habrían perdido a qué sede pertenecían.
    const { total, error: errConteo } = await contarUso(codigo);
    if (errConteo) return errConteo;
    if (total > 0) {
      return "No se puede eliminar " + codigo + ": " + total + " despacho(s) la usan. "
        + "Si se borrara, esos despachos perderían para siempre a qué sede pertenecían.";
    }
    const { error: err } = await supabase.from("sedes").delete().eq("codigo", codigo);
    if (err) return mensajeError(err, "eliminar la sede");
    setSedes((prev) => prev.filter((x) => x.codigo !== codigo));
    return "";
  };

  return { sedes, cargando, error, agregar, actualizar, eliminar, contarUso };
}

// ---------------- Horarios (bloques) ----------------
// Cada horario pertenece a una fecha concreta: cada día tiene los suyos.
export function useBloquesDB() {
  const [porFecha, setPorFecha] = useState({}); // { "2026-07-25": [bloques] }
  const [cargandoFechas, setCargandoFechas] = useState({});
  const [error, setError] = useState("");
  const solicitadas = useRef(new Set());

  const cargarFecha = useCallback(async (fecha, forzar) => {
    if (!fecha) return;
    if (!forzar && solicitadas.current.has(fecha)) return;
    solicitadas.current.add(fecha);
    setCargandoFechas((prev) => Object.assign({}, prev, { [fecha]: true }));
    const { data, error: err } = await supabase.from("bloques").select("*").eq("fecha", fecha).order("inicio");
    if (err) {
      // Se quita de "solicitadas" para que un reintento vuelva a pedirla:
      // si no, un fallo de red dejaría ese día vacío para siempre.
      solicitadas.current.delete(fecha);
      setError(mensajeError(err, "cargar los horarios del día"));
    } else {
      setError("");
      setPorFecha((prev) => Object.assign({}, prev, { [fecha]: data || [] }));
    }
    setCargandoFechas((prev) => Object.assign({}, prev, { [fecha]: false }));
  }, []);

  const bloquesDe = (fecha) => porFecha[fecha] || [];
  const cargandoDe = (fecha) => Boolean(cargandoFechas[fecha]);

  const ordenar = (lista) => lista.slice().sort((a, c) => a.inicio.localeCompare(c.inicio));

  const meterEnEstado = (fecha, bloque) =>
    setPorFecha((prev) => Object.assign({}, prev, { [fecha]: ordenar((prev[fecha] || []).concat([bloque])) }));

  // Una sola función de alta. Devuelve siempre { bloque, error } para que
  // quien la llame pueda usar el registro creado (con su id real) o
  // mostrar el fallo. Si se le pasa un id explícito está restaurando un
  // horario borrado, y ese id debe conservarse para que los despachos que
  // lo referenciaban puedan volver a apuntarle.
  const crear = async (fecha, bloque) => {
    const fila = { fecha: fecha, nombre: bloque.nombre || null, inicio: bloque.inicio, fin: bloque.fin };
    if (bloque.id) fila.id = bloque.id;
    const { data, error: err } = await supabase.from("bloques").insert(fila).select().single();
    if (err) return { bloque: null, error: mensajeError(err, "guardar el horario") };
    meterEnEstado(fecha, data);
    return { bloque: data, error: "" };
  };

  const actualizar = async (fecha, id, bloque) => {
    const { data, error: err } = await supabase
      .from("bloques")
      .update({ nombre: bloque.nombre || null, inicio: bloque.inicio, fin: bloque.fin })
      .eq("id", id).select().single();
    if (err) return { bloque: null, error: mensajeError(err, "guardar el horario") };
    setPorFecha((prev) => Object.assign({}, prev, { [fecha]: ordenar((prev[fecha] || []).map((x) => (x.id === id ? data : x))) }));
    return { bloque: data, error: "" };
  };

  const eliminar = async (fecha, id) => {
    const { error: err } = await supabase.from("bloques").delete().eq("id", id);
    if (err) return mensajeError(err, "eliminar el horario");
    setPorFecha((prev) => Object.assign({}, prev, { [fecha]: (prev[fecha] || []).filter((x) => x.id !== id) }));
    return "";
  };

  // Copia los horarios de otra fecha: evita recrearlos a mano cada día.
  const copiarDesde = async (fechaOrigen, fechaDestino) => {
    const { data: origen, error: errLectura } = await supabase.from("bloques").select("*").eq("fecha", fechaOrigen).order("inicio");
    if (errLectura) return { copiados: 0, error: mensajeError(errLectura, "leer los horarios del día anterior") };
    if (!origen || origen.length === 0) return { copiados: 0, error: "" };
    const nuevos = origen.map((b) => ({ fecha: fechaDestino, nombre: b.nombre, inicio: b.inicio, fin: b.fin }));
    const { data, error: err } = await supabase.from("bloques").insert(nuevos).select();
    if (err) return { copiados: 0, error: mensajeError(err, "copiar los horarios") };
    setPorFecha((prev) => Object.assign({}, prev, { [fechaDestino]: ordenar((prev[fechaDestino] || []).concat(data || [])) }));
    return { copiados: (data || []).length, error: "" };
  };

  return { bloquesDe, cargandoDe, cargarFecha, error, crear, actualizar, eliminar, copiarDesde };
}

// ---------------- Despachos ----------------
// Exportadas para poder probarlas: son las que deciden en qué COLUMNA
// acaba cada persona según el tipo de despacho, y un error ahí no se
// nota en pantalla — se nota meses después, en la base de datos.
export function despachoDbToApp(f) {
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

export function despachoAppToDb(d) {
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

// Fuera del componente: no depende de nada del render, y así "cargar"
// puede ser un useCallback estable de verdad (del que dependen el
// refresco automático y sus efectos).
function consultarDespachos(completo) {
  return () => {
    const q = supabase.from("despachos").select("*").order("fecha", { ascending: false });
    return completo ? q : q.gte("fecha", diasAtras(DIAS_VENTANA));
  };
}

// Primer día del mes siguiente a "YYYY-MM". Se usa como límite superior
// exclusivo: construir "YYYY-MM-31" fallaría en meses de 30 días o en
// febrero, porque Postgres rechaza una fecha que no existe.
function inicioDelMesSiguiente(mes) {
  const [y, m] = mes.split("-").map(Number);
  return m === 12 ? (y + 1) + "-01-01" : y + "-" + String(m + 1).padStart(2, "0") + "-01";
}

export function useDespachosDB() {
  const [despachos, setDespachos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  // Al abrir solo se traen los últimos DIAS_VENTANA días. Cargar años de
  // despachos en memoria en cada arranque no escala, y el 99% del uso
  // diario mira las últimas semanas.
  const [historicoCompleto, setHistoricoCompleto] = useState(false);
  const [cargandoHistorico, setCargandoHistorico] = useState(false);
  // Lista, no booleano: dos meses pueden estar cargándose a la vez si se
  // navega rápido por el calendario. Es estado (y no solo un ref) porque
  // la vista tiene que volver a pintarse cuando uno termina.
  const [mesesCargando, setMesesCargando] = useState([]);

  // Meses anteriores a la ventana que ya se trajeron bajo demanda, y los
  // que están en camino ahora mismo.
  const mesesCargados = useRef(new Set());
  const mesesEnCurso = useRef(new Set());
  // Contador de peticiones: varias cargas pueden solaparse (el refresco
  // al volver a la pestaña, el botón manual y "cargar histórico"), y sin
  // esto la que RESPONDE última gana, aunque sea la más antigua. Una
  // consulta de 90 días que llegue después de la del histórico completo
  // dejaba la lista recortada pero con historicoCompleto ya en true, y
  // el botón para volver a pedirlo desaparecido.
  const peticionActual = useRef(0);
  const historicoRef = useRef(false);

  // Devuelve true si se aplicó, false si falló, null si quedó superada
  // por una petición posterior.
  const cargar = useCallback(async (completo) => {
    const miPeticion = ++peticionActual.current;
    const { data, error: err } = await traerTodo(consultarDespachos(completo));
    if (miPeticion !== peticionActual.current) return null;
    if (err) { setError(mensajeError(err, "cargar los despachos")); return false; }
    setError("");
    // Una carga completa reemplaza la lista entera, así que los meses
    // traídos aparte dejan de estar presentes.
    mesesCargados.current = new Set();
    setMesesCargando(Array.from(mesesEnCurso.current));
    setDespachos((data || []).map(despachoDbToApp));
    return true;
  }, []);

  useEffect(() => { cargar(false).then(() => setCargando(false)); }, [cargar]);

  const cargarHistorico = useCallback(async () => {
    if (historicoRef.current || cargandoHistorico) return;
    setCargandoHistorico(true);
    const r = await cargar(true);
    // Solo se marca como completo si esta respuesta fue la que se aplicó.
    if (r === true) { historicoRef.current = true; setHistoricoCompleto(true); }
    setCargandoHistorico(false);
  }, [cargar, cargandoHistorico]);

  const recargar = useCallback(() => cargar(historicoRef.current), [cargar]);

  // El calendario deja abrir cualquier fecha, pero al arrancar solo hay
  // en memoria los últimos DIAS_VENTANA días. Sin esto, un día anterior
  // mostraba sus horarios pero CERO despachos: parecía vacío y se podían
  // crear duplicados o reordenar sobre información incompleta.
  const asegurarMes = useCallback(async (mes) => {
    if (!mes) return "";
    const dentroDeVentana = (mes + "-01") >= diasAtras(DIAS_VENTANA);
    if (historicoRef.current || dentroDeVentana || mesesCargados.current.has(mes) || mesesEnCurso.current.has(mes)) return "";

    // El mes se marca EN CURSO, no como cargado: darlo por disponible
    // antes de que llegue la respuesta hacía que un día de ese mes se
    // mostrara como vacío y editable mientras la consulta seguía en el
    // aire. Solo pasa a "cargado" si de verdad llegan los datos.
    mesesEnCurso.current.add(mes);
    setMesesCargando(Array.from(mesesEnCurso.current));

    const { data, error: err } = await traerTodo(() =>
      supabase.from("despachos").select("*")
        .gte("fecha", mes + "-01")
        .lt("fecha", inicioDelMesSiguiente(mes))
        .order("fecha", { ascending: false })
    );

    mesesEnCurso.current.delete(mes);
    setMesesCargando(Array.from(mesesEnCurso.current));

    if (err) {
      const m = mensajeError(err, "cargar los despachos de ese mes");
      setError(m);
      return m;
    }
    mesesCargados.current.add(mes);
    const traidos = (data || []).map(despachoDbToApp);
    setDespachos((prev) => prev.filter((d) => (d.fecha || "").slice(0, 7) !== mes).concat(traidos));
    return "";
  }, []);

  // Para que la vista sepa si un día está realmente cargado o solo
  // parece vacío porque su mes nunca se pidió (o sigue en camino).
  // Se seguían por separado, y no con un único booleano "cargandoMes",
  // porque al navegar rápido entre meses la primera respuesta apagaba
  // el indicador mientras el segundo mes seguía cargando.
  const mesDisponible = useCallback((mes) => {
    if (!mes) return true;
    if (mesesEnCurso.current.has(mes)) return false;
    return historicoRef.current || (mes + "-01") >= diasAtras(DIAS_VENTANA) || mesesCargados.current.has(mes);
  }, []);

  const mesCargando = useCallback((mes) => Boolean(mes) && mesesEnCurso.current.has(mes), []);

  const guardar = async (despacho) => {
    const yaEnPantalla = despacho.id && despachos.some((x) => x.id === despacho.id);
    if (yaEnPantalla) {
      const { data, error: err } = await supabase.from("despachos").update(despachoAppToDb(despacho)).eq("id", despacho.id).select().single();
      if (err) return mensajeError(err, "guardar el despacho");
      setDespachos((prev) => prev.map((x) => (x.id === despacho.id ? despachoDbToApp(data) : x)));
      return "";
    }
    // Sin id -> alta normal (la base de datos genera el UUID).
    // Con un id que ya no está en pantalla -> se está restaurando un
    // despacho borrado, y hay que reinsertarlo con SU id original para
    // que cualquier referencia a él siga siendo válida.
    const fila = despachoAppToDb(despacho);
    if (despacho.id) fila.id = despacho.id;
    const { data, error: err } = await supabase.from("despachos").insert(fila).select().single();
    if (err) return mensajeError(err, "guardar el despacho");
    setDespachos((prev) => prev.concat([despachoDbToApp(data)]));
    return "";
  };

  const eliminar = async (id) => {
    const { error: err } = await supabase.from("despachos").delete().eq("id", id);
    if (err) return mensajeError(err, "eliminar el despacho");
    setDespachos((prev) => prev.filter((x) => x.id !== id));
    return "";
  };

  // Cambia el estado a uno explícito de los 3 posibles. Se usa un
  // estado explícito (no un alternador de 2 valores) a propósito:
  // así "marcar todo como entregado" nunca puede pisar por error un
  // despacho que ya se había marcado como "no entregado".
  const cambiarEstado = async (id, nuevoEstado) => {
    const actual = despachos.find((x) => x.id === id);
    if (!actual) return "";
    setDespachos((prev) => prev.map((x) => (x.id === id ? Object.assign({}, x, { estado: nuevoEstado }) : x)));
    const { error: err } = await supabase.from("despachos").update({ estado: nuevoEstado }).eq("id", id);
    if (err) {
      setDespachos((prev) => prev.map((x) => (x.id === id ? actual : x)));
      return mensajeError(err, "cambiar el estado");
    }
    return "";
  };

  // Actualiza solo el orden manual (para reordenar dentro de un bloque
  // sin reescribir todo el despacho).
  const actualizarOrden = async (id, ordenNuevo) => {
    const actual = despachos.find((x) => x.id === id);
    if (!actual) return "";
    setDespachos((prev) => prev.map((x) => (x.id === id ? Object.assign({}, x, { orden: ordenNuevo }) : x)));
    const { error: err } = await supabase.from("despachos").update({ orden: ordenNuevo }).eq("id", id);
    if (err) {
      setDespachos((prev) => prev.map((x) => (x.id === id ? actual : x)));
      return mensajeError(err, "reordenar los despachos");
    }
    return "";
  };

  // Al borrar un horario, la base de datos pone en NULL el bloque_id de
  // sus despachos (on delete set null). Esto refleja eso mismo en
  // pantalla y devuelve los ids afectados, para poder volver a
  // vincularlos si el usuario pulsa "Deshacer".
  const desasignarBloque = (bloqueId) => {
    const afectados = despachos.filter((d) => d.bloqueId === bloqueId).map((d) => d.id);
    if (afectados.length) {
      setDespachos((prev) => prev.map((d) => (d.bloqueId === bloqueId ? Object.assign({}, d, { bloqueId: "" }) : d)));
    }
    return afectados;
  };

  const reasignarBloque = async (ids, bloqueId) => {
    if (!ids || ids.length === 0) return "";
    const { error: err } = await supabase.from("despachos").update({ bloque_id: bloqueId }).in("id", ids);
    if (err) return mensajeError(err, "devolver los despachos a su horario");
    setDespachos((prev) => prev.map((d) => (ids.indexOf(d.id) !== -1 ? Object.assign({}, d, { bloqueId: bloqueId }) : d)));
    return "";
  };

  return {
    despachos, cargando, error,
    historicoCompleto, cargandoHistorico, cargarHistorico, recargar,
    mesesCargando, asegurarMes, mesDisponible, mesCargando,
    guardar, eliminar, cambiarEstado, actualizarOrden,
    desasignarBloque, reasignarBloque,
  };
}

// ---------------- Catálogos de sugerencias ----------------
// Función, no constante compartida: cada uso necesita sus propios
// arrays, o dos consumidores acabarían escribiendo en la misma lista.
const nuevoCatalogo = () => ({ cliente: [], proveedor: [], responsable: [], celular: [], direccion: [] });

export function useCatalogosDB() {
  const [catalogos, setCatalogos] = useState(nuevoCatalogo);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  // Copia sincronizada para consultar sin leer estado dentro del setter
  // (leerlo así no es fiable y podía intentar insertar duplicados).
  const actuales = useRef(nuevoCatalogo());

  const aplicar = (siguiente) => {
    actuales.current = siguiente;
    setCatalogos(siguiente);
  };

  useEffect(() => {
    let vigente = true;
    traerTodo(() => supabase.from("catalogos").select("*")).then(({ data, error: err }) => {
      if (!vigente) return;
      if (err) {
        setError(mensajeError(err, "cargar las sugerencias"));
      } else {
        const inicial = nuevoCatalogo();
        (data || []).forEach((fila) => { if (inicial[fila.campo]) inicial[fila.campo].push(fila.valor); });
        aplicar(inicial);
      }
      setCargando(false);
    });
    return () => { vigente = false; };
  }, []);

  const agregarSiNoExiste = async (campo, valorNuevo) => {
    const valor = (valorNuevo || "").trim();
    if (!valor || !actuales.current[campo]) return "";
    if (actuales.current[campo].indexOf(valor) !== -1) return "";
    // Se agrega primero en memoria para que dos guardados seguidos no
    // intenten insertar el mismo valor dos veces.
    aplicar(Object.assign({}, actuales.current, { [campo]: actuales.current[campo].concat([valor]) }));
    const { error: err } = await supabase.from("catalogos").insert({ campo, valor });
    if (err) {
      aplicar(Object.assign({}, actuales.current, { [campo]: actuales.current[campo].filter((v) => v !== valor) }));
      return mensajeError(err, "guardar la sugerencia");
    }
    return "";
  };

  const editar = async (campo, valorViejo, valorNuevo) => {
    if (valorViejo === valorNuevo) return "";
    const { error: err } = await supabase.from("catalogos").update({ valor: valorNuevo }).eq("campo", campo).eq("valor", valorViejo);
    if (err) return mensajeError(err, "renombrar la sugerencia");
    aplicar(Object.assign({}, actuales.current, { [campo]: actuales.current[campo].map((v) => (v === valorViejo ? valorNuevo : v)) }));
    return "";
  };

  const eliminar = async (campo, valor) => {
    const { error: err } = await supabase.from("catalogos").delete().eq("campo", campo).eq("valor", valor);
    if (err) return mensajeError(err, "eliminar la sugerencia");
    aplicar(Object.assign({}, actuales.current, { [campo]: actuales.current[campo].filter((v) => v !== valor) }));
    return "";
  };

  return { catalogos, cargando, error, agregarSiNoExiste, editar, eliminar };
}

// ---------------- Métricas ----------------
export function useMetricasDB() {
  const [metricas, setMetricas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  const aApp = (m) => ({ id: m.id, nombre: m.nombre, operacion: m.operacion, filtroCampo: m.filtro_campo || "", filtroValor: m.filtro_valor || "" });

  useEffect(() => {
    let vigente = true;
    traerTodo(() => supabase.from("metricas").select("*")).then(({ data, error: err }) => {
      if (!vigente) return;
      if (err) setError(mensajeError(err, "cargar las métricas"));
      else setMetricas((data || []).map(aApp));
      setCargando(false);
    });
    return () => { vigente = false; };
  }, []);

  const agregar = async (metrica) => {
    const { data, error: err } = await supabase.from("metricas")
      .insert({ nombre: metrica.nombre, operacion: metrica.operacion, filtro_campo: metrica.filtroCampo || null, filtro_valor: metrica.filtroValor || null })
      .select().single();
    if (err) return mensajeError(err, "crear la métrica");
    setMetricas((prev) => prev.concat([aApp(data)]));
    return "";
  };

  const eliminar = async (id) => {
    const { error: err } = await supabase.from("metricas").delete().eq("id", id);
    if (err) return mensajeError(err, "eliminar la métrica");
    setMetricas((prev) => prev.filter((m) => m.id !== id));
    return "";
  };

  return { metricas, cargando, error, agregar, eliminar };
}

// Mapa de todos los horarios (para reportes: permite saber a qué hora
// salió cada despacho sin cargar fecha por fecha). Sigue la misma
// ventana de DIAS_VENTANA que los despachos, y se expande junto con
// ellos cuando se pide el histórico completo.
export function useMapaHorarios() {
  const [mapa, setMapa] = useState({});
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const completo = useRef(false);
  // Mismo problema que tenían los despachos: varias recargas pueden
  // solaparse (cambiar de pestaña, el botón manual, pedir el histórico)
  // y ganaba la que respondía última. Una consulta de 90 días que
  // llegara después de la del histórico completo reemplazaba el mapa
  // entero, y los reportes de fechas antiguas se quedaban sin horarios:
  // sus despachos dejaban de aparecer en el mapa de calor.
  const peticionActual = useRef(0);

  const recargar = useCallback(async (todoElHistorico) => {
    const miPeticion = ++peticionActual.current;
    const quiereCompleto = Boolean(todoElHistorico) || completo.current;

    const { data, error: err } = await traerTodo(() => {
      const q = supabase.from("bloques").select("id, fecha, nombre, inicio, fin");
      return quiereCompleto ? q : q.gte("fecha", diasAtras(DIAS_VENTANA));
    });
    if (miPeticion !== peticionActual.current) return;

    if (err) {
      setError(mensajeError(err, "cargar los horarios"));
    } else {
      setError("");
      // Solo se recuerda que el mapa es completo si esta respuesta fue
      // la que se aplicó de verdad.
      if (quiereCompleto) completo.current = true;
      const m = {};
      (data || []).forEach((b) => { m[b.id] = b; });
      setMapa(m);
    }
    setCargando(false);
  }, []);

  useEffect(() => { recargar(false); }, [recargar]);

  return { mapa, cargando, error, recargar };
}

// ---------------- Tema ----------------
export function useTemaLocal() {
  const [tema, setTemaState] = useState(() => {
    try { return localStorage.getItem("pronort-theme") || "light"; } catch (e) { return "light"; }
  });
  const setTema = (t) => {
    try { localStorage.setItem("pronort-theme", t); } catch (e) { /* modo privado: el tema no persiste */ }
    setTemaState(t);
  };
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
