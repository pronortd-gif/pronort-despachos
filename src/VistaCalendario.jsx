import React, { useMemo } from "react";
import { TIPOS, DIAS_CORTOS, MESES, hoy } from "./constants";
import { Icon } from "./ui";

export function VistaCalendario({ mesActual, onCambiarMes, despachos, mapaHorarios, onSeleccionarDia, oscuro, cargandoMes }) {
  const [anio, mes] = mesActual.split("-").map(Number);
  const primerDia = new Date(anio, mes - 1, 1);
  const diasEnMes = new Date(anio, mes, 0).getDate();
  const offset = primerDia.getDay();

  const conteoPorDia = useMemo(() => {
    const acc = {};
    const bloquesConDespacho = new Set();
    despachos.forEach((d) => {
      if (d.fecha.indexOf(mesActual) === 0) {
        if (!acc[d.fecha]) acc[d.fecha] = { total: 0, tipos: {}, pendientes: 0, tieneHorarioVacio: false };
        acc[d.fecha].total += 1;
        acc[d.fecha].tipos[d.tipo] = (acc[d.fecha].tipos[d.tipo] || 0) + 1;
        if (d.estado !== "entregado") acc[d.fecha].pendientes += 1;
      }
      if (d.bloqueId) bloquesConDespacho.add(d.bloqueId);
    });
    // Un horario "vacío" es uno creado que ningún despacho usa todavía.
    // Se marca en el día al que pertenece, aunque ese día no tenga
    // ningún despacho (para no perder de vista horarios olvidados).
    Object.values(mapaHorarios || {}).forEach((b) => {
      if (b.fecha.indexOf(mesActual) === 0 && !bloquesConDespacho.has(b.id)) {
        if (!acc[b.fecha]) acc[b.fecha] = { total: 0, tipos: {}, pendientes: 0, tieneHorarioVacio: false };
        acc[b.fecha].tieneHorarioVacio = true;
      }
    });
    return acc;
  }, [despachos, mesActual, mapaHorarios]);

  const totales = Object.keys(conteoPorDia).map((k) => conteoPorDia[k].total);
  const maxTotal = Math.max(1, totales.length ? Math.max.apply(null, totales) : 1);

  const celdas = [];
  for (let i = 0; i < offset; i++) celdas.push(null);
  for (let d = 1; d <= diasEnMes; d++) celdas.push(d);

  const cambiarMes = (delta) => {
    const dt = new Date(anio, mes - 1 + delta, 1);
    onCambiarMes(dt.getFullYear() + "-" + String(dt.getMonth() + 1).padStart(2, "0"));
  };
  const hoyIso = hoy();

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <button onClick={() => cambiarMes(-1)} aria-label="Mes anterior" style={{ width: 38, height: 38, padding: 0 }}><Icon name="chevron-left" /></button>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <h2 style={{ margin: 0, textTransform: "capitalize", fontSize: 19 }}>{MESES[mes - 1]} {anio}</h2>
          {mesActual !== hoyIso.slice(0, 7) && <button onClick={() => onCambiarMes(hoyIso.slice(0, 7))} style={{ fontSize: 12, height: 28, padding: "0 10px" }}>Hoy</button>}
        </div>
        <button onClick={() => cambiarMes(1)} aria-label="Mes siguiente" style={{ width: 38, height: 38, padding: 0 }}><Icon name="chevron-right" /></button>
      </div>

      {/* Los meses anteriores a los últimos 90 días se traen al abrirlos.
          Sin este aviso, los contadores en cero de cada día parecerían
          decir "no hubo despachos" cuando en realidad aún no llegaron. */}
      {cargandoMes && (
        <p style={{ fontSize: 12.5, color: "var(--text-secondary)", margin: "0 0 10px", display: "flex", alignItems: "center", gap: 6 }}>
          <Icon name="refresh" size={13} girando /> Cargando los despachos de este mes...
        </p>
      )}

      <div className="cal-grid" style={{ marginBottom: 6 }}>
        {DIAS_CORTOS.map((d) => (
          <div key={d} style={{ textAlign: "center", fontSize: 11, fontWeight: 500, color: "var(--text-secondary)", textTransform: "uppercase", padding: "2px 0" }}>{d}</div>
        ))}
      </div>

      <div key={mesActual} className="cal-grid">
        {celdas.map((d, i) => {
          if (d === null) return <div key={"empty-" + i} />;
          const iso = anio + "-" + String(mes).padStart(2, "0") + "-" + String(d).padStart(2, "0");
          const info = conteoPorDia[iso];
          const esHoy = iso === hoyIso;
          const intensidad = info ? info.total / maxTotal : 0;
          const fondo = info
            ? (oscuro ? "rgba(255,107,143," + (0.06 + intensidad * 0.20) + ")" : "rgba(189,11,59," + (0.05 + intensidad * 0.18) + ")")
            : "var(--surface-2)";
          return (
            <button
              key={iso}
              className="cal-cell"
              style={{ border: esHoy ? "1.5px solid var(--brand-accent)" : "0.5px solid var(--border)", background: fondo }}
              onClick={() => onSeleccionarDia(iso)}
              aria-label={"Ver día " + d + (info && info.total > 0 ? ", " + info.total + " despachos" : "") + (info && info.tieneHorarioVacio ? ", tiene un horario sin despachos" : "")}
            >
              <span style={{ fontSize: 12.5, fontWeight: esHoy ? 600 : 400, color: esHoy ? "var(--brand-accent)" : "var(--text-primary)", lineHeight: 1.2 }}>{d}</span>
              {info && info.total > 0 && (
                <React.Fragment>
                  <span style={{ fontSize: 10.5, fontWeight: 600, marginTop: 3, color: "#fff", background: "var(--brand-accent)", borderRadius: 20, padding: "1px 6px", lineHeight: 1.4 }}>{info.total}</span>
                  <div style={{ display: "flex", gap: 2, marginTop: 3 }}>
                    {Object.keys(info.tipos).slice(0, 3).map((tk) => (
                      <span key={tk} style={{ width: 4.5, height: 4.5, borderRadius: "50%", background: TIPOS[tk] ? (oscuro ? TIPOS[tk].dark : TIPOS[tk].color) : "#888" }} />
                    ))}
                  </div>
                </React.Fragment>
              )}
              {info && info.tieneHorarioVacio && (
                <span
                  title="Hay un horario creado sin despachos"
                  style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--text-muted)", border: "1px solid var(--surface-2)", marginTop: info.total > 0 ? 2 : 6 }}
                />
              )}
            </button>
          );
        })}
      </div>

      <div style={{ display: "flex", gap: 14, marginTop: 16, flexWrap: "wrap" }}>
        {Object.keys(TIPOS).map((k) => (
          <div key={k} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text-secondary)" }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: oscuro ? TIPOS[k].dark : TIPOS[k].color }} />{TIPOS[k].label}
          </div>
        ))}
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text-secondary)" }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--text-muted)" }} />Horario sin despachos
        </div>
      </div>
    </div>
  );
}
