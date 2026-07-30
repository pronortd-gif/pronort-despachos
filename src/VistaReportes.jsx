import React, { useState, useRef, useEffect, useMemo } from "react";
import { TIPOS, BRAND, hoy, diasAtras, sedeLabel, colorLinea, sedeLinea, bandasHorarias, bandaDeHora, tituloDespacho, HORA_INICIO_JORNADA, HORA_FIN_JORNADA } from "./constants";
import { Icon, Modal } from "./ui";

const OPERACIONES = { contar: "Contar registros", sumar: "Sumar monto", promediar: "Promediar monto", porcentaje: "% del total filtrado" };
const CAMPOS_FILTRO = { tipo: "Tipo", tienda: "Sede origen", sedeDestino: "Sede destino", cobra: "¿Se cobra?", estado: "Estado" };

function calcularMetrica(m, despachos) {
  let base = despachos;
  if (m.filtroCampo && m.filtroValor !== "" && m.filtroValor != null) {
    base = base.filter((d) => {
      if (m.filtroCampo === "cobra") return String(Boolean(d.cobra)) === m.filtroValor;
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

function FormMetrica({ onGuardar, onCancelar, sedes }) {
  const [m, setM] = useState({ nombre: "", operacion: "contar", filtroCampo: "", filtroValor: "" });
  const labelStyle = { fontSize: 13, color: "var(--text-secondary)", display: "block", marginBottom: 4 };
  const cambiar = (clave, valor) => setM((prev) => Object.assign({}, prev, { [clave]: valor }));

  const opcionesValor = () => {
    if (m.filtroCampo === "tipo") return Object.keys(TIPOS).map((k) => ({ v: k, l: TIPOS[k].label }));
    if (m.filtroCampo === "tienda" || m.filtroCampo === "sedeDestino") return sedes.map((s) => ({ v: s.codigo, l: s.codigo + " · " + s.nombre }));
    if (m.filtroCampo === "cobra") return [{ v: "true", l: "Sí cobra" }, { v: "false", l: "No cobra" }];
    if (m.filtroCampo === "estado") return [{ v: "pendiente", l: "Pendiente" }, { v: "entregado", l: "Entregado" }];
    return [];
  };

  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <label style={labelStyle}>Nombre de la métrica</label>
        <input style={{ width: "100%" }} value={m.nombre} onChange={(e) => cambiar("nombre", e.target.value)} placeholder="Nombre descriptivo de la métrica" />
      </div>
      <div style={{ marginBottom: 12 }}>
        <label style={labelStyle}>Operación</label>
        <select style={{ width: "100%" }} value={m.operacion} onChange={(e) => cambiar("operacion", e.target.value)}>
          {Object.keys(OPERACIONES).map((k) => <option key={k} value={k}>{OPERACIONES[k]}</option>)}
        </select>
      </div>
      <div className="form-grid form-grid-2" style={{ marginBottom: 20 }}>
        <div>
          <label style={labelStyle}>Filtrar por (opcional)</label>
          <select style={{ width: "100%" }} value={m.filtroCampo} onChange={(e) => setM((prev) => Object.assign({}, prev, { filtroCampo: e.target.value, filtroValor: "" }))}>
            <option value="">Sin filtro</option>
            {Object.keys(CAMPOS_FILTRO).map((k) => <option key={k} value={k}>{CAMPOS_FILTRO[k]}</option>)}
          </select>
        </div>
        {m.filtroCampo && (
          <div>
            <label style={labelStyle}>Valor</label>
            <select style={{ width: "100%" }} value={m.filtroValor} onChange={(e) => cambiar("filtroValor", e.target.value)}>
              <option value="">Selecciona...</option>
              {opcionesValor().map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
            </select>
          </div>
        )}
      </div>
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button onClick={onCancelar}>Cancelar</button>
        <button style={{ borderColor: "var(--brand-accent)", color: "var(--brand-accent)" }} onClick={() => m.nombre.trim() && onGuardar(m)}>
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

export function VistaReportes({ despachos, metricas, onAgregarMetrica, onEliminarMetrica, sedes, mapaHorarios, oscuro }) {
  const [rango, setRango] = useState("mes");
  const [desde, setDesde] = useState(diasAtras(30));
  const [hasta, setHasta] = useState(hoy());
  const [tipoEnCalor, setTipoEnCalor] = useState("");
  const [vistaCalor, setVistaCalor] = useState("salida"); // "salida" | "ocupacion"
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
    const anterior = despachos.filter((d) => d.fecha >= diasAtras(diasRango * 2) && d.fecha < diasAtras(diasRango)).length;
    if (anterior === 0) return null;
    return { delta: ((despachosFiltrados.length - anterior) / anterior) * 100, anterior };
  }, [despachos, despachosFiltrados, rango]);

  const porDia = {};
  despachosFiltrados.forEach((d) => { porDia[d.fecha] = (porDia[d.fecha] || 0) + 1; });
  const fechasOrdenadas = Object.keys(porDia).sort();

  // ---- Mapa de calor por BANDAS HORARIAS fijas (08:00–18:00) ----
  // Tiene 2 vistas posibles:
  // - "salida": cuenta despachos en la banda de su hora de SALIDA (lo
  //   de siempre: cuántos pedidos salen en cada franja).
  // - "ocupacion": cuenta, por cada HORARIO creado, todas las bandas
  //   que ocupa desde su inicio hasta su fin — sin importar cuántos
  //   despachos lleve adentro (un horario con 5 despachos ocupa el
  //   carro una sola vez, no 5). Un horario vacío también cuenta como
  //   ocupado, porque el carro/horario existe igual.
  const bandas = bandasHorarias();

  // Bloques (horarios) que caen dentro del mismo rango de fechas
  // elegido arriba, para que "ocupación" respete el mismo filtro.
  const bloquesFiltrados = useMemo(() => {
    const todos = Object.values(mapaHorarios || {});
    if (rango === "todo") return todos;
    if (rango === "hoy") return todos.filter((b) => b.fecha === hoy());
    if (rango === "custom") return todos.filter((b) => b.fecha >= desde && b.fecha <= hasta);
    const inicio = diasAtras(RANGOS[rango].dias);
    return todos.filter((b) => b.fecha >= inicio);
  }, [mapaHorarios, rango, desde, hasta]);

  // Bandas de hora que ocupa un horario completo (no solo su inicio).
  // Si termina justo en punto (ej. 11:00) esa hora ya no cuenta como
  // ocupada; si termina pasado en punto (ej. 11:30) sí se incluye.
  function bandasOcupadas(inicio, fin) {
    const hi = Number((inicio || "").split(":")[0]);
    const [hf, mf] = (fin || "").split(":").map(Number);
    if (isNaN(hi) || isNaN(hf)) return [];
    let ultimaHora = mf === 0 ? hf - 1 : hf;
    if (ultimaHora < hi) ultimaHora = hi;
    const desdeB = Math.max(HORA_INICIO_JORNADA, Math.min(hi, HORA_FIN_JORNADA - 1));
    const hastaB = Math.max(HORA_INICIO_JORNADA, Math.min(ultimaHora, HORA_FIN_JORNADA - 1));
    const lista = [];
    for (let h = desdeB; h <= hastaB; h++) lista.push(h);
    return lista;
  }

  const heatSalida = useMemo(() => {
    const acc = {};
    despachosFiltrados.forEach((d) => {
      if (tipoEnCalor && d.tipo !== tipoEnCalor) return;
      if (!d.tienda) return;
      const bloque = mapaHorarios[d.bloqueId];
      if (!bloque) return;
      const banda = bandaDeHora(bloque.inicio);
      if (banda == null) return;
      const clave = banda + "|" + d.tienda;
      acc[clave] = (acc[clave] || 0) + 1;
    });
    return acc;
  }, [despachosFiltrados, mapaHorarios, tipoEnCalor]);

  const heatOcupacion = useMemo(() => {
    const acc = {};
    bloquesFiltrados.forEach((b) => {
      const despachosDelBloque = despachosFiltrados.filter((d) => d.bloqueId === b.id && (!tipoEnCalor || d.tipo === tipoEnCalor));
      // Si se filtró por tipo y este horario no tiene despachos de ese
      // tipo, no aplica a esta vista filtrada (aunque sí tenga otros).
      if (tipoEnCalor && despachosDelBloque.length === 0) return;
      const sedesDelBloque = despachosDelBloque.length > 0
        ? Array.from(new Set(despachosDelBloque.map((d) => d.tienda).filter(Boolean)))
        : ["__vacio__"];
      const bandasDelBloque = bandasOcupadas(b.inicio, b.fin);
      sedesDelBloque.forEach((sede) => {
        bandasDelBloque.forEach((h) => {
          const clave = h + "|" + sede;
          acc[clave] = (acc[clave] || 0) + 1;
        });
      });
    });
    return acc;
  }, [bloquesFiltrados, despachosFiltrados, tipoEnCalor]);

  const heat = vistaCalor === "ocupacion" ? heatOcupacion : heatSalida;

  const sedesConDatos = useMemo(() => {
    const set = new Set();
    Object.keys(heat).forEach((clave) => set.add(clave.split("|")[1]));
    const arr = Array.from(set);
    // La columna "Vacío" (horarios sin despachos) siempre al final.
    arr.sort((a, b) => (a === "__vacio__" ? 1 : b === "__vacio__" ? -1 : a.localeCompare(b)));
    return arr;
  }, [heat]);

  const maxHeat = Math.max(1, ...Object.keys(heat).map((k) => heat[k]), 1);

  // Misma escala que usa colorCalor: se extrae aparte para que el
  // contraste del texto (blanco u oscuro) se decida con el mismo
  // número que pinta el fondo, y no con la proporción "cruda"
  // v/maxHeat, que ya no corresponde 1 a 1 desde que se agregó el piso
  // de 0.35 (antes el texto podía quedar oscuro sobre fondo oscuro).
  const intensidadVisual = (valor) => 0.35 + (valor / maxHeat) * 0.65;

  const colorCalor = (valor) => {
    if (!valor) return "var(--surface-1)";
    // Piso de 0.35: así, aunque haya un solo despacho registrado (o
    // pocos datos en general), la franja ya se nota de inmediato en
    // vez de verse casi en blanco. El máximo real de cada rango sigue
    // siendo siempre el más intenso (i llega a 1), así que la franja
    // más usada nunca deja de distinguirse aunque haya mucho volumen.
    const i = intensidadVisual(valor);
    // Degradado continuo: azul de marca (poca carga) a rojo de marca (saturado)
    return oscuro
      ? (i < 0.5
        ? "rgba(127,168,232," + (0.12 + i * 2 * 0.38) + ")"
        : "rgba(255,107,143," + (0.20 + (i - 0.5) * 2 * 0.60) + ")")
      : (i < 0.5
        ? "rgba(9,31,66," + (0.08 + i * 2 * 0.34) + ")"
        : "rgba(189,11,59," + (0.16 + (i - 0.5) * 2 * 0.62) + ")");
  };

  // ---- Análisis por sede ----
  const porSede = useMemo(() => {
    const acc = {};
    despachosFiltrados.forEach((d) => {
      if (!d.tienda) return;
      if (!acc[d.tienda]) acc[d.tienda] = { total: 0, entregados: 0, monto: 0 };
      acc[d.tienda].total += 1;
      if (d.estado === "entregado") acc[d.tienda].entregados += 1;
      if (d.cobra && d.monto) acc[d.tienda].monto += Number(d.monto) || 0;
    });
    return Object.keys(acc).map((cod) => Object.assign({ codigo: cod }, acc[cod])).sort((a, b) => b.total - a.total);
  }, [despachosFiltrados]);

  const porTipo = useMemo(() => {
    const acc = {};
    Object.keys(TIPOS).forEach((k) => { acc[k] = 0; });
    despachosFiltrados.forEach((d) => { acc[d.tipo] = (acc[d.tipo] || 0) + 1; });
    return acc;
  }, [despachosFiltrados]);
  const totalTipos = Object.keys(porTipo).reduce((a, k) => a + porTipo[k], 0) || 1;

  // ---- Rutas más frecuentes (solo movimientos) ----
  const rutasFrecuentes = useMemo(() => {
    const acc = {};
    despachosFiltrados.forEach((d) => {
      if (d.tipo !== "MOV_MERCADERIA" || !d.tienda || !d.sedeDestino) return;
      const clave = d.tienda + " → " + d.sedeDestino;
      acc[clave] = (acc[clave] || 0) + 1;
    });
    return Object.keys(acc).map((r) => ({ ruta: r, veces: acc[r] })).sort((a, b) => b.veces - a.veces).slice(0, 6);
  }, [despachosFiltrados]);

  // ---- Contrapartes más frecuentes (clientes y proveedores) ----
  const contrapartes = useMemo(() => {
    const acc = {};
    despachosFiltrados.forEach((d) => {
      const nombre = (d.cliente || d.proveedor || "").trim();
      if (!nombre) return;
      if (!acc[nombre]) acc[nombre] = { veces: 0, tipo: d.tipo };
      acc[nombre].veces += 1;
    });
    return Object.keys(acc).map((c) => ({ nombre: c, veces: acc[c].veces, tipo: acc[c].tipo })).sort((a, b) => b.veces - a.veces).slice(0, 8);
  }, [despachosFiltrados]);

  const entregadosTotal = despachosFiltrados.filter((d) => d.estado === "entregado").length;
  const noEntregadosTotal = despachosFiltrados.filter((d) => d.estado === "no_entregado").length;
  const pctEntregado = despachosFiltrados.length ? (entregadosTotal / despachosFiltrados.length) * 100 : 0;

  useEffect(() => {
    function renderChart() {
      if (!canvasRef.current || !window.Chart) return;
      if (canvasRef.current._chart) canvasRef.current._chart.destroy();
      canvasRef.current._chart = new window.Chart(canvasRef.current, {
        type: "bar",
        data: { labels: fechasOrdenadas, datasets: [{ label: "Despachos por día", data: fechasOrdenadas.map((f) => porDia[f]), backgroundColor: oscuro ? "#FF6B8F" : BRAND.rojo, borderRadius: 4 }] },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            y: { beginAtZero: true, ticks: { stepSize: 1, color: oscuro ? "#A9AFC3" : "#5B6272" }, grid: { color: oscuro ? "rgba(255,255,255,0.08)" : "rgba(9,31,66,0.08)" } },
            x: { ticks: { maxRotation: 45, minRotation: 45, font: { size: 10 }, color: oscuro ? "#A9AFC3" : "#5B6272" }, grid: { display: false } },
          },
        },
      });
    }
    if (!window.Chart) {
      const s = document.createElement("script");
      s.src = "https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js";
      s.onload = renderChart;
      document.body.appendChild(s);
    } else renderChart();
  }, [despachosFiltrados.length, rango, desde, hasta, oscuro]);

  return (
    <div className="view-in">
      <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
        {Object.keys(RANGOS).map((k) => (
          <button key={k} onClick={() => setRango(k)} style={{ fontSize: 13, height: 34, padding: "0 12px", borderColor: rango === k ? "var(--brand-accent)" : "var(--border)", color: rango === k ? "var(--brand-accent)" : "var(--text-secondary)" }}>
            {RANGOS[k].label}
          </button>
        ))}
      </div>
      {rango === "custom" && (
        <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 16, flexWrap: "wrap" }}>
          <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
          <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>hasta</span>
          <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
        </div>
      )}
      <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 20 }}>{despachosFiltrados.length} despachos en el rango seleccionado</p>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <h3 style={{ margin: 0 }}>Resumen</h3>
        <button onClick={() => setFormMetrica(true)} style={{ fontSize: 13, height: 32, padding: "0 10px" }}><Icon name="plus" size={14} /> Nueva métrica</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(155px, 1fr))", gap: 12, marginBottom: 28 }}>
        <div className="stat-card" style={{ animation: "statIn 0.3s cubic-bezier(0.16,1,0.3,1)" }}>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "0 0 4px" }}>Total en el rango</p>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <p style={{ fontSize: 24, fontWeight: 500, margin: 0 }}>{despachosFiltrados.length}</p>
            {comparacion && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 2, fontSize: 12, fontWeight: 500, color: comparacion.delta >= 0 ? "var(--ok)" : "var(--brand-accent)" }}>
                <Icon name={comparacion.delta >= 0 ? "trending-up" : "trending-down"} size={14} />{Math.abs(comparacion.delta).toFixed(0)}%
              </span>
            )}
          </div>
          {comparacion && <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "2px 0 0" }}>vs. periodo anterior ({comparacion.anterior})</p>}
        </div>
        <div className="stat-card" style={{ animation: "statIn 0.3s cubic-bezier(0.16,1,0.3,1) 0.03s backwards" }}>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "0 0 4px" }}>Días con actividad</p>
          <p style={{ fontSize: 24, fontWeight: 500, margin: 0 }}>{fechasOrdenadas.length}</p>
        </div>
        <div className="stat-card" style={{ animation: "statIn 0.3s cubic-bezier(0.16,1,0.3,1) 0.06s backwards" }}>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "0 0 4px" }}>Promedio por día</p>
          <p style={{ fontSize: 24, fontWeight: 500, margin: 0 }}>{fechasOrdenadas.length ? (despachosFiltrados.length / fechasOrdenadas.length).toFixed(1) : "0"}</p>
        </div>
        <div className="stat-card" style={{ animation: "statIn 0.3s cubic-bezier(0.16,1,0.3,1) 0.09s backwards" }}>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "0 0 4px" }}>% entregado</p>
          <p style={{ fontSize: 24, fontWeight: 500, margin: 0, color: pctEntregado >= 80 ? "var(--ok)" : pctEntregado >= 50 ? "var(--warn)" : "var(--brand-accent)" }}>{pctEntregado.toFixed(0)}%</p>
        </div>
        <div className="stat-card" style={{ animation: "statIn 0.3s cubic-bezier(0.16,1,0.3,1) 0.11s backwards" }}>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "0 0 4px" }}>No entregados</p>
          <p style={{ fontSize: 24, fontWeight: 500, margin: 0, color: noEntregadosTotal > 0 ? "var(--brand-accent)" : "var(--text-primary)" }}>{noEntregadosTotal}</p>
        </div>
        {metricas.map((m, idx) => (
          <div key={m.id} className="stat-card" style={{ position: "relative", animation: "statIn 0.3s cubic-bezier(0.16,1,0.3,1) " + (0.12 + idx * 0.03) + "s backwards" }}>
            <button onClick={() => onEliminarMetrica(m.id)} aria-label="Eliminar métrica" style={{ position: "absolute", top: 8, right: 8, width: 22, height: 22, padding: 0, border: "none" }}><Icon name="x" size={13} /></button>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "0 0 4px", paddingRight: 18 }}>{m.nombre}</p>
            <p style={{ fontSize: 24, fontWeight: 500, margin: 0, color: "var(--brand-accent)" }}>{formatoMetrica(calcularMetrica(m, despachosFiltrados), m.operacion)}</p>
          </div>
        ))}
      </div>

      <h3 style={{ marginBottom: 12 }}>Tendencia de despachos por día</h3>
      <div style={{ overflowX: "auto", marginBottom: 32 }}>
        <div style={{ position: "relative", height: 240, minWidth: Math.max(320, fechasOrdenadas.length * 34) }}>
          <canvas ref={canvasRef} />
        </div>
      </div>

      {/* ---- Mapa de calor por banda horaria ---- */}
      <h3 style={{ marginBottom: 4 }}>Saturación por hora del día</h3>

      <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
        <button onClick={() => setVistaCalor("salida")} style={{ fontSize: 12, height: 30, padding: "0 10px", borderColor: vistaCalor === "salida" ? "var(--brand-accent)" : "var(--border)", color: vistaCalor === "salida" ? "var(--brand-accent)" : "var(--text-secondary)" }}>
          Despachos por hora
        </button>
        <button onClick={() => setVistaCalor("ocupacion")} style={{ fontSize: 12, height: 30, padding: "0 10px", borderColor: vistaCalor === "ocupacion" ? "var(--brand-accent)" : "var(--border)", color: vistaCalor === "ocupacion" ? "var(--brand-accent)" : "var(--text-secondary)" }}>
          Ocupación de horarios
        </button>
      </div>

      <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 10 }}>
        {vistaCalor === "salida"
          ? "Cada despacho se ubica en la banda de su hora de salida, así el análisis no depende de que todos los días tengan los mismos horarios."
          : "Cada horario (carro) cuenta como ocupado en todas las horas entre su inicio y su fin, tenga o no despachos adentro — así se ve cuándo hay varios carros trabajando a la vez en una misma sede."}
      </p>

      <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
        <button onClick={() => setTipoEnCalor("")} style={{ fontSize: 12, height: 30, padding: "0 10px", borderColor: tipoEnCalor === "" ? "var(--brand-accent)" : "var(--border)", color: tipoEnCalor === "" ? "var(--brand-accent)" : "var(--text-secondary)" }}>
          Todos
        </button>
        {Object.keys(TIPOS).map((k) => (
          <button key={k} onClick={() => setTipoEnCalor(k)} style={{ fontSize: 12, height: 30, padding: "0 10px", borderColor: tipoEnCalor === k ? "var(--brand-accent)" : "var(--border)", color: tipoEnCalor === k ? "var(--brand-accent)" : "var(--text-secondary)" }}>
            {TIPOS[k].label}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--text-secondary)" }}>
          <span>menos</span>
          <span style={{ display: "inline-block", width: 60, height: 8, borderRadius: 4, background: oscuro ? "linear-gradient(90deg, rgba(127,168,232,0.15), rgba(255,107,143,0.8))" : "linear-gradient(90deg, rgba(9,31,66,0.1), rgba(189,11,59,0.78))" }} />
          <span>más</span>
        </div>
      </div>

      {sedesConDatos.length === 0 ? (
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 28 }}>
          {vistaCalor === "salida" ? "Aún no hay despachos con sede y horario asignados en este rango." : "Aún no hay horarios creados en este rango."}
        </p>
      ) : (
        <div style={{ overflowX: "auto", marginBottom: 32 }}>
          <table className="heat-tabla">
            <thead>
              <tr>
                <th></th>
                {sedesConDatos.map((cod) => (
                  <th key={cod} style={{ padding: "4px 6px", textAlign: "center", fontSize: 11.5, minWidth: 78 }}>
                    <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: cod === "__vacio__" ? "var(--text-muted)" : colorLinea(sedeLinea(cod, sedes), oscuro), marginRight: 5 }} />
                    {cod === "__vacio__" ? "Vacío" : cod}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bandas.map((banda) => {
                const filaTotal = sedesConDatos.reduce((a, cod) => a + (heat[banda.hora + "|" + cod] || 0), 0);
                return (
                  <tr key={banda.hora}>
                    <td className="heat-hora" style={{ fontSize: 11.5, color: filaTotal ? "var(--text-primary)" : "var(--text-muted)" }}>{banda.label}</td>
                    {sedesConDatos.map((cod) => {
                      const v = heat[banda.hora + "|" + cod] || 0;
                      const intensa = v > 0 && intensidadVisual(v) > 0.62;
                      return (
                        <td key={cod} className="heat-celda" style={{ background: colorCalor(v), color: intensa ? "#fff" : "var(--text-primary)" }}>
                          {v || ""}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <h3 style={{ marginBottom: 4 }}>Distribución por tipo</h3>
      <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 12 }}>Proporción de ventas, compras y movimientos en el rango elegido.</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 28 }}>
        {Object.keys(TIPOS).map((k) => {
          const cantidad = porTipo[k] || 0;
          const pct = (cantidad / totalTipos) * 100;
          return (
            <div key={k}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 3 }}>
                <span><Icon name={TIPOS[k].icono} size={13} /> {TIPOS[k].label}</span>
                <span style={{ color: "var(--text-secondary)" }}>{cantidad} ({pct.toFixed(0)}%)</span>
              </div>
              <div style={{ height: 8, borderRadius: 4, background: "var(--surface-1)", overflow: "hidden" }}>
                <div style={{ width: pct + "%", height: "100%", background: oscuro ? TIPOS[k].dark : TIPOS[k].color, borderRadius: 4, transition: "width 0.3s ease" }} />
              </div>
            </div>
          );
        })}
      </div>

      <h3 style={{ marginBottom: 4 }}>Desempeño por sede</h3>
      <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 12 }}>Volumen, entregas completadas y monto cobrado.</p>
      {porSede.length === 0 ? (
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 28 }}>Sin datos de sede en este rango.</p>
      ) : (
        <div style={{ overflowX: "auto", marginBottom: 28 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: "0.5px solid var(--border)" }}>
                <th style={{ textAlign: "left", padding: "6px 8px" }}>Sede</th>
                <th style={{ textAlign: "right", padding: "6px 8px" }}>Despachos</th>
                <th style={{ textAlign: "right", padding: "6px 8px" }}>Entregados</th>
                <th style={{ textAlign: "right", padding: "6px 8px" }}>Monto cobrado</th>
              </tr>
            </thead>
            <tbody>
              {porSede.map((s) => (
                <tr key={s.codigo} style={{ borderBottom: "0.5px solid var(--border)" }}>
                  <td style={{ padding: "6px 8px" }}>
                    <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: colorLinea(sedeLinea(s.codigo, sedes), oscuro), marginRight: 6 }} />
                    {sedeLabel(s.codigo, sedes)}
                  </td>
                  <td style={{ padding: "6px 8px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{s.total}</td>
                  <td style={{ padding: "6px 8px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{s.entregados}/{s.total}</td>
                  <td style={{ padding: "6px 8px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{s.monto > 0 ? "S/ " + s.monto.toFixed(2) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {rutasFrecuentes.length > 0 && (
        <React.Fragment>
          <h3 style={{ marginBottom: 4 }}>Rutas de movimiento más frecuentes</h3>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 12 }}>Traslados entre sedes que más se repiten.</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 28 }}>
            {rutasFrecuentes.map((r) => (
              <div key={r.ruta} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 10px", background: "var(--surface-1)", borderRadius: "var(--radius)" }}>
                <span style={{ fontSize: 13 }}>{r.ruta}</span>
                <span style={{ fontSize: 12, color: "var(--text-secondary)", fontVariantNumeric: "tabular-nums" }}>{r.veces} vez{r.veces === 1 ? "" : "es"}</span>
              </div>
            ))}
          </div>
        </React.Fragment>
      )}

      <h3 style={{ marginBottom: 4 }}>Clientes y proveedores más frecuentes</h3>
      <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 12 }}>Quiénes concentran más despachos en el rango elegido.</p>
      {contrapartes.length === 0 ? (
        <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Sin datos en este rango.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {contrapartes.map((c) => (
            <div key={c.nombre} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "7px 10px", background: "var(--surface-1)", borderRadius: "var(--radius)" }}>
              <span style={{ fontSize: 13, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>
                <Icon name={(TIPOS[c.tipo] || TIPOS.VENTA).icono} size={12} /> {c.nombre}
              </span>
              <span style={{ fontSize: 12, color: "var(--text-secondary)", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{c.veces} despacho{c.veces === 1 ? "" : "s"}</span>
            </div>
          ))}
        </div>
      )}

      {formMetrica && (
        <Modal title="Nueva métrica" onClose={() => setFormMetrica(false)}>
          <FormMetrica onGuardar={(m) => { onAgregarMetrica(m); setFormMetrica(false); }} onCancelar={() => setFormMetrica(false)} sedes={sedes} />
        </Modal>
      )}
    </div>
  );
}
