import React, { useState, useEffect } from "react";
import { hoy } from "./constants";
import { Icon, LogoPronort } from "./ui";
import { Login } from "./Login";
import {
  useSedesDB, useBloquesDB, useDespachosDB, useCatalogosDB,
  useMetricasDB, useMapaHorarios, useTemaLocal, useSesion,
} from "./hooksDB";
import { VistaCalendario } from "./VistaCalendario";
import { VistaDia } from "./VistaDia";
import { VistaHistorial } from "./VistaHistorial";
import { VistaReportes } from "./VistaReportes";
import { VistaCatalogos } from "./VistaCatalogos";

function PantallaCarga({ texto }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 300, gap: 12 }}>
      <LogoPronort alto={30} />
      <p style={{ fontSize: 13, margin: 0, color: "var(--text-secondary)" }}>{texto || "Cargando..."}</p>
    </div>
  );
}

const TABS = [
  { id: "calendario", label: "Calendario", icon: "calendar" },
  { id: "historial", label: "Historial", icon: "list" },
  { id: "reportes", label: "Reportes", icon: "chart-bar" },
  { id: "catalogos", label: "Catálogos", icon: "database" },
];

function AppInterna({ cerrarSesion, correo }) {
  const [tab, setTab] = useState("calendario");
  const [mesActual, setMesActual] = useState(hoy().slice(0, 7));
  const [diaSeleccionado, setDiaSeleccionado] = useState(null);
  const [tema, setTema] = useTemaLocal();
  const oscuro = tema === "dark";

  const sedesDB = useSedesDB();
  const bloquesDB = useBloquesDB();
  const despachosDB = useDespachosDB();
  const catalogosDB = useCatalogosDB();
  const metricasDB = useMetricasDB();
  const horariosDB = useMapaHorarios();

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", tema);
  }, [tema]);

  // Los horarios se cargan por fecha, solo cuando se abre ese día.
  useEffect(() => {
    if (diaSeleccionado) bloquesDB.cargarFecha(diaSeleccionado);
  }, [diaSeleccionado, bloquesDB]);

  // Reportes usa un mapa aparte de todos los horarios (para no tener
  // que cargar fecha por fecha). Se refresca al abrir Reportes o el
  // Calendario, para que un horario recién creado en la sesión actual
  // siempre se vea reflejado ahí (mapa de calor y el puntito de
  // "horario vacío" en el calendario).
  useEffect(() => {
    if (tab === "reportes" || (tab === "calendario" && !diaSeleccionado)) horariosDB.recargar();
  }, [tab, diaSeleccionado]);

  const cargando = sedesDB.cargando || despachosDB.cargando || catalogosDB.cargando || metricasDB.cargando || horariosDB.cargando;

  // Cada despacho guardado nutre los catálogos de sugerencias.
  const guardarDespachoYAprender = async (despacho) => {
    await despachosDB.guardar(despacho);
    const aprender = [
      ["cliente", despacho.cliente],
      ["proveedor", despacho.proveedor],
      ["responsable", despacho.persona1],
      ["responsable", despacho.persona2],
      ["celular", despacho.celular],
      ["celular", despacho.celular1],
      ["celular", despacho.celular2],
      ["direccion", despacho.direccion],
    ];
    aprender.forEach(([campo, valor]) => {
      if (valor && valor.trim()) catalogosDB.agregarSiNoExiste(campo, valor.trim());
    });
  };

  const guardarBloqueDelDia = (bloque) => {
    if (!diaSeleccionado) return;
    const existentes = bloquesDB.bloquesDe(diaSeleccionado);
    const yaEsta = existentes.some((b) => b.id === bloque.id);
    if (yaEsta) bloquesDB.actualizar(diaSeleccionado, bloque.id, bloque);
    else bloquesDB.agregar(diaSeleccionado, bloque);
  };

  const guardarSede = async (codigoViejo, sedeNueva) => {
    if (codigoViejo) await sedesDB.actualizar(codigoViejo, sedeNueva);
    else await sedesDB.agregar(sedeNueva);
  };

  const editarDesdeHistorial = (d) => { setDiaSeleccionado(d.fecha); setTab("calendario"); };

  const totalHoy = despachosDB.despachos.filter((d) => d.fecha === hoy()).length;

  return (
    <div className="app-shell" style={{ background: "var(--surface-0)", minHeight: "100vh" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <LogoPronort alto={26} />
          <div style={{ borderLeft: "1px solid var(--border)", paddingLeft: 10, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <p style={{ margin: 0, fontSize: 12, color: "var(--text-secondary)" }}>Programación de despachos</p>
              {totalHoy > 0 && (
                <span style={{ fontSize: 11, fontWeight: 500, color: "var(--brand-accent)", background: oscuro ? "rgba(255,107,143,0.12)" : "rgba(189,11,59,0.08)", borderRadius: 20, padding: "1px 8px" }}>
                  {totalHoy} hoy
                </span>
              )}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <button key={tema} onClick={() => setTema(oscuro ? "light" : "dark")} aria-label="Cambiar tema" style={{ width: 38, height: 38, padding: 0, animation: "spinIn 0.3s cubic-bezier(0.16,1,0.3,1)" }}>
            <Icon name={oscuro ? "sun" : "moon"} size={17} />
          </button>
          <button onClick={cerrarSesion} aria-label="Cerrar sesión" title={correo ? "Cerrar sesión (" + correo + ")" : "Cerrar sesión"} style={{ width: 38, height: 38, padding: 0 }}>
            <Icon name="logout" size={17} />
          </button>
        </div>
      </div>

      {cargando ? (
        <PantallaCarga texto="Cargando datos de Pronort..." />
      ) : (
        <React.Fragment>
          <div className="tabs-bar">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => { setTab(t.id); if (t.id === "calendario") setDiaSeleccionado(null); }}
                style={{ borderBottomColor: tab === t.id ? "var(--brand-accent)" : "transparent", color: tab === t.id ? "var(--text-primary)" : "var(--text-secondary)" }}
              >
                <Icon name={t.icon} size={16} /> {t.label}
              </button>
            ))}
          </div>

          {tab === "calendario" && !diaSeleccionado && (
            <VistaCalendario
              mesActual={mesActual}
              onCambiarMes={setMesActual}
              despachos={despachosDB.despachos}
              mapaHorarios={horariosDB.mapa}
              onSeleccionarDia={setDiaSeleccionado}
              oscuro={oscuro}
            />
          )}

          {tab === "calendario" && diaSeleccionado && (
            <VistaDia
              fecha={diaSeleccionado}
              onVolver={() => setDiaSeleccionado(null)}
              bloques={bloquesDB.bloquesDe(diaSeleccionado)}
              cargandoBloques={bloquesDB.cargandoDe(diaSeleccionado)}
              onGuardarBloque={guardarBloqueDelDia}
              onEliminarBloque={(id) => bloquesDB.eliminar(diaSeleccionado, id)}
              onCopiarHorarios={bloquesDB.copiarDesde}
              onCrearHorarioRapido={bloquesDB.crearRapido}
              despachos={despachosDB.despachos}
              onGuardarDespacho={guardarDespachoYAprender}
              onEliminarDespacho={despachosDB.eliminar}
              onCambiarEstado={despachosDB.cambiarEstado}
              onActualizarOrden={despachosDB.actualizarOrden}
              oscuro={oscuro}
              catalogos={catalogosDB.catalogos}
              sedes={sedesDB.sedes}
            />
          )}

          {tab === "historial" && (
            <VistaHistorial
              despachos={despachosDB.despachos}
              onEditar={editarDesdeHistorial}
              onEliminar={despachosDB.eliminar}
              onCambiarEstado={despachosDB.cambiarEstado}
              sedes={sedesDB.sedes}
              oscuro={oscuro}
            />
          )}

          {tab === "reportes" && (
            <VistaReportes
              despachos={despachosDB.despachos}
              metricas={metricasDB.metricas}
              onAgregarMetrica={metricasDB.agregar}
              onEliminarMetrica={metricasDB.eliminar}
              sedes={sedesDB.sedes}
              mapaHorarios={horariosDB.mapa}
              oscuro={oscuro}
            />
          )}

          {tab === "catalogos" && (
            <VistaCatalogos
              catalogos={catalogosDB.catalogos}
              onAgregarValor={catalogosDB.agregarSiNoExiste}
              onEditarValor={catalogosDB.editar}
              onEliminarValor={catalogosDB.eliminar}
              sedes={sedesDB.sedes}
              onGuardarSede={guardarSede}
              onEliminarSede={sedesDB.eliminar}
              despachos={despachosDB.despachos}
              oscuro={oscuro}
            />
          )}
        </React.Fragment>
      )}
    </div>
  );
}

export default function App() {
  const { sesion, cargando, cerrarSesion } = useSesion();
  const [tema] = useTemaLocal();

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", tema);
  }, [tema]);

  if (cargando) {
    return (
      <div className="app-shell" style={{ minHeight: "100vh" }}>
        <PantallaCarga texto="Verificando sesión..." />
      </div>
    );
  }

  if (!sesion) return <Login />;

  return <AppInterna cerrarSesion={cerrarSesion} correo={sesion.user && sesion.user.email} />;
}
