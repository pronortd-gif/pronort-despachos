import React, { useState, useEffect, useCallback } from "react";
import { hoy } from "./constants";
import { Icon, LogoPronort, AvisoError } from "./ui";
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

const ORDEN_TABS = TABS.map((t) => t.id);

function AppInterna({ cerrarSesion, correo }) {
  const [tab, setTab] = useState("calendario");
  const [mesActual, setMesActual] = useState(hoy().slice(0, 7));
  const [diaSeleccionado, setDiaSeleccionado] = useState(null);
  const [tema, setTema] = useTemaLocal();
  const oscuro = tema === "dark";

  // Hacia dónde se mueve el usuario: +1 avanza (pestaña de la derecha, o
  // entrar al detalle de un día), -1 retrocede. La vista entra desde ese
  // lado, para que el movimiento diga dónde estás en vez de que todo
  // aparezca siempre igual.
  const [direccion, setDireccion] = useState(1);

  const irATab = (id) => {
    setDireccion(ORDEN_TABS.indexOf(id) >= ORDEN_TABS.indexOf(tab) ? 1 : -1);
    setTab(id);
    if (id === "calendario") setDiaSeleccionado(null);
  };
  const abrirDia = (fecha) => { setDireccion(1); setDiaSeleccionado(fecha); };
  const volverAlCalendario = () => { setDireccion(-1); setDiaSeleccionado(null); };

  const sedesDB = useSedesDB();
  const bloquesDB = useBloquesDB();
  const despachosDB = useDespachosDB();
  const catalogosDB = useCatalogosDB();
  const metricasDB = useMetricasDB();
  const horariosDB = useMapaHorarios();

  const cargarFecha = bloquesDB.cargarFecha;
  const recargarHorarios = horariosDB.recargar;
  const recargarDespachos = despachosDB.recargar;
  const asegurarMes = despachosDB.asegurarMes;

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", tema);
  }, [tema]);

  // Los horarios se cargan por fecha, solo cuando se abre ese día.
  useEffect(() => {
    if (diaSeleccionado) cargarFecha(diaSeleccionado);
  }, [diaSeleccionado, cargarFecha]);

  // Los despachos solo están en memoria para los últimos 90 días, pero
  // el calendario deja abrir cualquier fecha. Al mirar un mes anterior
  // (o abrir un día de ese mes) hay que traerlo, o la pantalla mostraría
  // el día vacío aunque tenga despachos — y se podrían duplicar.
  useEffect(() => { asegurarMes(mesActual); }, [mesActual, asegurarMes]);
  useEffect(() => {
    if (diaSeleccionado) asegurarMes(diaSeleccionado.slice(0, 7));
  }, [diaSeleccionado, asegurarMes]);

  // Reportes usa un mapa aparte de todos los horarios (para no tener
  // que cargar fecha por fecha). Se refresca al abrir Reportes o el
  // Calendario, para que un horario recién creado en la sesión actual
  // siempre se vea reflejado ahí (mapa de calor y el puntito de
  // "horario vacío" en el calendario).
  useEffect(() => {
    if (tab === "reportes" || (tab === "calendario" && !diaSeleccionado)) recargarHorarios();
  }, [tab, diaSeleccionado, recargarHorarios]);

  // Los datos se cargan una sola vez al abrir. Si alguien más registró
  // despachos mientras esta pestaña estaba en segundo plano, al volver a
  // ella se traen los cambios: es la forma más barata de que dos
  // personas trabajando a la vez no se pisen sin enterarse.
  const [refrescando, setRefrescando] = useState(false);
  const refrescar = useCallback(async () => {
    setRefrescando(true);
    await Promise.all([recargarDespachos(), recargarHorarios()]);
    // Una recarga completa reemplaza la lista y descarta los meses
    // traídos aparte: hay que volver a pedir el que se está mirando, o
    // el día abierto quedaría vacío después de refrescar.
    await asegurarMes((diaSeleccionado || mesActual + "-01").slice(0, 7));
    if (diaSeleccionado) await cargarFecha(diaSeleccionado, true);
    setRefrescando(false);
  }, [recargarDespachos, recargarHorarios, cargarFecha, asegurarMes, diaSeleccionado, mesActual]);

  useEffect(() => {
    const alVolver = () => { if (document.visibilityState === "visible") refrescar(); };
    document.addEventListener("visibilitychange", alVolver);
    return () => document.removeEventListener("visibilitychange", alVolver);
  }, [refrescar]);

  const cargando = sedesDB.cargando || despachosDB.cargando || catalogosDB.cargando || metricasDB.cargando || horariosDB.cargando;

  // Un error de carga no puede quedarse callado: sin esto, una consulta
  // fallida se veía igual que "no hay datos todavía".
  const errorCarga = sedesDB.error || despachosDB.error || catalogosDB.error || metricasDB.error || horariosDB.error || bloquesDB.error;
  const [aviso, setAviso] = useState("");
  const mostrarSiFalla = (mensaje) => { if (mensaje) setAviso(mensaje); return mensaje; };

  // Cada despacho guardado nutre los catálogos de sugerencias.
  const guardarDespachoYAprender = async (despacho) => {
    const error = await despachosDB.guardar(despacho);
    if (error) return mostrarSiFalla(error);
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
    // Las sugerencias son un extra: si alguna falla no se le arruina el
    // guardado al usuario, que es lo que de verdad importa.
    aprender.forEach(([campo, valor]) => {
      if (valor && valor.trim()) catalogosDB.agregarSiNoExiste(campo, valor.trim());
    });
    return "";
  };

  const guardarBloqueDelDia = async (bloque) => {
    if (!diaSeleccionado) return "Selecciona un día antes de crear un horario.";
    const existentes = bloquesDB.bloquesDe(diaSeleccionado);
    const yaEsta = bloque.id && existentes.some((b) => b.id === bloque.id);
    const { error } = yaEsta
      ? await bloquesDB.actualizar(diaSeleccionado, bloque.id, bloque)
      : await bloquesDB.crear(diaSeleccionado, bloque);
    return mostrarSiFalla(error);
  };

  // Borrar un horario deja sus despachos sin horario asignado (la base de
  // datos les pone bloque_id en NULL). Se devuelven los ids afectados
  // para poder volver a vincularlos si el usuario pulsa "Deshacer".
  const eliminarBloqueDelDia = async (id) => {
    const afectados = despachosDB.despachos.filter((d) => d.bloqueId === id).map((d) => d.id);
    const error = await bloquesDB.eliminar(diaSeleccionado, id);
    if (error) { setAviso(error); return { error, afectados: [] }; }
    despachosDB.desasignarBloque(id);
    return { error: "", afectados };
  };

  // Deshacer de verdad: el horario se recrea con SU MISMO id y los
  // despachos que lo usaban vuelven a apuntarle. Recrearlo con un id
  // nuevo (como se hacía antes) dejaba el horario vacío y sus despachos
  // huérfanos en "Sin horario asignado".
  const restaurarBloque = async (bloque, idsDespachos) => {
    const { bloque: creado, error } = await bloquesDB.crear(diaSeleccionado, bloque);
    if (error) return mostrarSiFalla(error);
    return mostrarSiFalla(await despachosDB.reasignarBloque(idsDespachos, creado.id));
  };

  const guardarSede = async (codigoViejo, sedeNueva) => {
    const error = codigoViejo
      ? await sedesDB.actualizar(codigoViejo, sedeNueva)
      : await sedesDB.agregar(sedeNueva);
    return mostrarSiFalla(error);
  };

  const editarDesdeHistorial = (d) => { setDireccion(1); setDiaSeleccionado(d.fecha); setTab("calendario"); };

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
          <button onClick={refrescar} disabled={refrescando} aria-label="Refrescar datos" title="Traer los cambios que hayan hecho otros" style={{ width: 38, height: 38, padding: 0 }}>
            <Icon name="refresh" size={17} girando={refrescando} />
          </button>
          <button key={tema} onClick={() => setTema(oscuro ? "light" : "dark")} aria-label="Cambiar tema" style={{ width: 38, height: 38, padding: 0, animation: "spinIn 0.3s cubic-bezier(0.16,1,0.3,1)" }}>
            <Icon name={oscuro ? "sun" : "moon"} size={17} />
          </button>
          <button onClick={cerrarSesion} aria-label="Cerrar sesión" title={correo ? "Cerrar sesión (" + correo + ")" : "Cerrar sesión"} style={{ width: 38, height: 38, padding: 0 }}>
            <Icon name="logout" size={17} />
          </button>
        </div>
      </div>

      {errorCarga && <AvisoError mensaje={errorCarga} onReintentar={refrescar} />}
      {aviso && <AvisoError mensaje={aviso} onCerrar={() => setAviso("")} />}

      {cargando ? (
        <PantallaCarga texto="Cargando datos de Pronort..." />
      ) : (
        <React.Fragment>
          <div className="tabs-bar">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => irATab(t.id)}
                style={{ borderBottomColor: tab === t.id ? "var(--brand-accent)" : "transparent", color: tab === t.id ? "var(--text-primary)" : "var(--text-secondary)" }}
              >
                <Icon name={t.icon} size={16} /> {t.label}
              </button>
            ))}
          </div>

          {/* La "key" fuerza que la vista se vuelva a montar al cambiar de
              pestaña o de día, que es lo que dispara la animación de
              entrada. La clase decide desde qué lado llega. */}
          <div key={tab + "/" + (diaSeleccionado || "")} className={direccion >= 0 ? "vista-der" : "vista-izq"}>

          {tab === "calendario" && !diaSeleccionado && (
            <VistaCalendario
              mesActual={mesActual}
              onCambiarMes={setMesActual}
              despachos={despachosDB.despachos}
              mapaHorarios={horariosDB.mapa}
              onSeleccionarDia={abrirDia}
              oscuro={oscuro}
              cargandoMes={despachosDB.mesCargando(mesActual)}
            />
          )}

          {tab === "calendario" && diaSeleccionado && (
            <VistaDia
              fecha={diaSeleccionado}
              onVolver={volverAlCalendario}
              bloques={bloquesDB.bloquesDe(diaSeleccionado)}
              cargandoBloques={bloquesDB.cargandoDe(diaSeleccionado)}
              cargandoDespachos={!despachosDB.mesDisponible(diaSeleccionado.slice(0, 7))}
              onGuardarBloque={guardarBloqueDelDia}
              onEliminarBloque={eliminarBloqueDelDia}
              onRestaurarBloque={restaurarBloque}
              onCopiarHorarios={bloquesDB.copiarDesde}
              onCrearHorarioRapido={(datos) => bloquesDB.crear(diaSeleccionado, datos)}
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
              onRestaurar={guardarDespachoYAprender}
              onCambiarEstado={despachosDB.cambiarEstado}
              sedes={sedesDB.sedes}
              oscuro={oscuro}
              historicoCompleto={despachosDB.historicoCompleto}
              cargandoHistorico={despachosDB.cargandoHistorico}
              onCargarHistorico={() => { despachosDB.cargarHistorico(); recargarHorarios(true); }}
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
              historicoCompleto={despachosDB.historicoCompleto}
              cargandoHistorico={despachosDB.cargandoHistorico}
              onCargarHistorico={() => { despachosDB.cargarHistorico(); recargarHorarios(true); }}
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
              onContarUsoSede={sedesDB.contarUso}
              despachos={despachosDB.despachos}
              oscuro={oscuro}
            />
          )}

          </div>
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
