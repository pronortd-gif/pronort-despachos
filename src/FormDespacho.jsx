import React, { useState, useMemo } from "react";
import { TIPOS, CONFIG_TIPO, esLinkOCoordenadas, convertirCoordenadasALink, seTraslapan, sumarMinutos, capitalizarPalabras, limpiarCelular } from "./constants";
import { Icon, AvisoError } from "./ui";
import { CampoSugerido, CampoPersona } from "./campos";
import { CampoComprobante } from "./CampoComprobante";
import { SelectorTipo, SelectorHorario } from "./selectores";
import { SelectorHora12 } from "./FormBloque";

function CampoDireccion({ direccion, mapsUrl, onCambiarDireccion, onCambiarMaps, sugerencias, etiqueta }) {
  const [ultimoPegado, setUltimoPegado] = useState(Boolean(mapsUrl));

  const manejarCambio = (valorNuevo) => {
    if (esLinkOCoordenadas(valorNuevo)) {
      onCambiarMaps(convertirCoordenadasALink(valorNuevo));
      onCambiarDireccion("");
      setUltimoPegado(true);
    } else {
      onCambiarDireccion(valorNuevo);
      setUltimoPegado(false);
    }
  };

  if (mapsUrl && ultimoPegado) {
    return (
      <div>
        <label className="campo-label">{etiqueta}</label>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", background: "var(--surface-1)", borderRadius: "var(--radius)", fontSize: 13 }}>
          <Icon name="map-pin" size={15} />
          {/* En pestaña nueva a propósito: si el link navegara en la misma
              pestaña, se perdería todo el despacho a medio escribir. */}
          <a href={mapsUrl} target="_blank" rel="noopener noreferrer" style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{mapsUrl}</a>
          <button type="button" onClick={() => { onCambiarMaps(""); setUltimoPegado(false); }} aria-label="Quitar link" style={{ width: 26, height: 26, padding: 0, border: "none" }}><Icon name="x" size={13} /></button>
        </div>
        <p className="campo-ayuda">Link detectado automáticamente.</p>
        <input style={{ width: "100%", marginTop: 6 }} value={direccion} onChange={(e) => onCambiarDireccion(e.target.value)} placeholder="Referencia adicional (opcional)" />
      </div>
    );
  }

  return (
    <div>
      <CampoSugerido label={etiqueta} valor={direccion} onCambiarValor={manejarCambio} sugerencias={sugerencias} placeholder="Dirección, o pega un link de Google Maps" tipo="nombre" />
      {mapsUrl && (
        <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: "4px 0 0" }}>
          <Icon name="map-pin" size={13} /> Link guardado: <a href={mapsUrl} target="_blank" rel="noopener noreferrer">{mapsUrl}</a>
        </p>
      )}
    </div>
  );
}

// Mini-formulario para crear un horario nuevo sin salir del formulario
// de despacho. Reutiliza el mismo selector de hora (12h, pasos de 10
// minutos) que "Nuevo horario de salida", así que no hay dos lógicas
// distintas para lo mismo.
function CrearHorarioInline({ bloques, onCrear, onCancelar }) {
  const ultimoFin = bloques.length ? bloques[bloques.length - 1].fin : "08:00";
  const [datos, setDatos] = useState({ nombre: "", inicio: ultimoFin, fin: sumarMinutos(ultimoFin, 60) });
  const [creando, setCreando] = useState(false);
  const [error, setError] = useState("");
  const cambiar = (clave, valor) => setDatos((prev) => Object.assign({}, prev, { [clave]: valor }));

  const horaInvalida = datos.inicio && datos.fin && datos.fin <= datos.inicio;
  const traslape = (bloques || []).find((b) => seTraslapan(datos.inicio, datos.fin, b.inicio, b.fin));

  const crear = async () => {
    if (horaInvalida || traslape) return;
    setCreando(true);
    setError("");
    const { bloque, error: err } = await onCrear(datos);
    setCreando(false);
    if (err || !bloque) { setError(err || "No se pudo crear el horario. Intenta de nuevo."); return; }
    onCancelar(bloque.id);
  };

  return (
    <div style={{ background: "var(--surface-1)", borderRadius: "var(--radius)", padding: 10, marginTop: 8 }}>
      <div className="form-grid form-grid-2" style={{ marginBottom: 8 }}>
        <SelectorHora12 etiqueta="Hora inicio" valor={datos.inicio} onCambiar={(v) => cambiar("inicio", v)} error={horaInvalida || traslape} />
        <SelectorHora12 etiqueta="Hora fin" valor={datos.fin} onCambiar={(v) => cambiar("fin", v)} error={horaInvalida || traslape} />
      </div>
      {horaInvalida && <p style={{ fontSize: 12, color: "var(--brand-accent)", margin: "0 0 8px" }}>La hora de fin debe ser posterior a la de inicio.</p>}
      {!horaInvalida && traslape && <p style={{ fontSize: 12, color: "var(--brand-accent)", margin: "0 0 8px" }}>Se cruza con otro horario ya creado ({traslape.inicio}–{traslape.fin}).</p>}
      <input value={datos.nombre} onChange={(e) => cambiar("nombre", e.target.value)} placeholder="Nombre (opcional)" style={{ width: "100%", marginBottom: 8 }} />
      {error && <p style={{ fontSize: 12, color: "var(--brand-accent)", margin: "0 0 8px" }}>{error}</p>}
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button type="button" onClick={() => onCancelar(null)} style={{ fontSize: 13, height: 32, padding: "0 10px" }}>Cancelar</button>
        <button type="button" disabled={creando || horaInvalida || Boolean(traslape)} onClick={crear} style={{ fontSize: 13, height: 32, padding: "0 10px", borderColor: "var(--brand-accent)", color: "var(--brand-accent)" }}>
          <Icon name="check" size={13} /> {creando ? "Creando..." : "Crear y usar"}
        </button>
      </div>
    </div>
  );
}

export const DESPACHO_VACIO = {
  bloqueId: "", tipo: "VENTA", tienda: "",
  cliente: "", proveedor: "", sedeDestino: "",
  persona1: "", persona2: "", celular: "", celular1: "", celular2: "",
  comprobante: "", numGuia: "", cobra: false, monto: "",
  direccion: "", mapsUrl: "", estado: "pendiente",
};

export function FormDespacho({ inicial, bloqueIdInicial, bloques, fecha, onGuardar, onCancelar, catalogos, sedes, todosDespachos, oscuro, conteoPorBloqueId, onCrearHorario }) {
  const [creandoHorario, setCreandoHorario] = useState(false);
  // Si viene un horario preseleccionado (porque se pulsó "Agregar
  // despacho" dentro de ese horario), se respeta. Antes se perdía y
  // el formulario caía siempre al primer horario del día.
  const [datos, setDatos] = useState(() => {
    if (inicial) return inicial;
    const idPorDefecto = bloqueIdInicial || (bloques[0] ? bloques[0].id : "");
    return Object.assign({}, DESPACHO_VACIO, { bloqueId: idPorDefecto });
  });
  const [intentoGuardar, setIntentoGuardar] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [errorGuardado, setErrorGuardado] = useState("");

  const cambiarCampo = (clave, valorNuevo) => setDatos((prev) => Object.assign({}, prev, { [clave]: valorNuevo }));

  const cfg = CONFIG_TIPO[datos.tipo] || CONFIG_TIPO.VENTA;
  const row = { marginBottom: 14 };

  // Al cambiar de tipo se limpian los campos que no aplican, para no
  // arrastrar datos de una lógica a otra. Persona1/persona2 y celular
  // también se limpian: aunque el campo se llame igual entre tipos, su
  // significado cambia (ej. "Trasladado por" en Movimiento no es lo
  // mismo que "Responsable" en Venta), así que dejar el valor puesto
  // podría verse como si se hubiera llenado a propósito para el tipo nuevo.
  //
  // Comprobante, cobro y dirección se limpian con el mismo criterio
  // (según lo que el tipo NUEVO usa, CONFIG_TIPO.usaX): antes solo se
  // limpiaban persona y celular, así que un monto o un comprobante
  // escritos antes de cambiar a Movimiento (que no usa ninguno de los
  // dos) se guardaban igual en el despacho nuevo, invisibles en el
  // formulario pero presentes en la base de datos.
  const cambiarTipo = (tipoNuevo) => {
    const cfgNuevo = CONFIG_TIPO[tipoNuevo];
    setDatos((prev) => Object.assign({}, prev, {
      tipo: tipoNuevo,
      cliente: tipoNuevo === "VENTA" ? prev.cliente : "",
      proveedor: tipoNuevo === "COMPRA" ? prev.proveedor : "",
      sedeDestino: tipoNuevo === "MOV_MERCADERIA" ? prev.sedeDestino : "",
      persona1: "", persona2: "",
      celular: "", celular1: "", celular2: "",
      comprobante: cfgNuevo.usaComprobante ? prev.comprobante : "",
      numGuia: cfgNuevo.usaComprobante ? prev.numGuia : "",
      cobra: cfgNuevo.usaCobro ? prev.cobra : false,
      monto: cfgNuevo.usaCobro ? prev.monto : "",
      direccion: cfgNuevo.usaDireccion ? prev.direccion : "",
      mapsUrl: cfgNuevo.usaDireccion ? prev.mapsUrl : "",
    }));
  };

  const sedesDestino = sedes.filter((s) => s.codigo !== datos.tienda);

  // Cada tipo tiene sus propios requisitos mínimos.
  const errores = useMemo(() => {
    const e = {};
    if (datos.tipo === "VENTA") {
      // Antes bastaba con cliente O sede (cualquiera de los dos). Compra
      // y Movimiento siempre exigen su sede; una Venta sin sede quedaba
      // fuera del reporte "Desempeño por sede" y del mapa de calor por
      // sede sin que nada lo advirtiera. Ahora se exigen ambos, igual
      // que en los otros dos tipos.
      if (!datos.cliente.trim()) e.general = "Ingresa el cliente.";
      if (!datos.tienda) e.tienda = "Indica desde qué sede se despacha.";
      // El campo tenía min="0" en el input, pero el <form> entero lleva
      // noValidate (para controlar los mensajes de error a mano), así que
      // ese límite nunca se aplicaba: se podía marcar "se cobra" y
      // guardar con el monto vacío o negativo, sin ningún aviso.
      if (datos.cobra && (!datos.monto || Number(datos.monto) <= 0)) e.monto = "Ingresa cuánto se cobra.";
    }
    if (datos.tipo === "COMPRA") {
      if (!datos.tienda) e.tienda = "Indica a qué sede llega la mercadería.";
    }
    if (datos.tipo === "MOV_MERCADERIA") {
      if (!datos.tienda) e.tienda = "Indica la sede de origen.";
      if (!datos.sedeDestino) e.destino = "Indica la sede de destino.";
      if (datos.tienda && datos.sedeDestino && datos.tienda === datos.sedeDestino) e.destino = "El origen y el destino no pueden ser la misma sede.";
    }
    if (!datos.bloqueId) e.bloque = "Selecciona un horario de salida.";
    return e;
  }, [datos]);

  const hayErrores = Object.keys(errores).length > 0;

  const posibleDuplicado = useMemo(() => {
    if (!todosDespachos) return false;
    const clave = (datos.cliente || datos.proveedor || datos.sedeDestino || "").trim().toLowerCase();
    if (!clave) return false;
    return todosDespachos.some((d) => {
      if (d.id === (inicial ? inicial.id : null)) return false;
      if (d.fecha !== fecha || d.bloqueId !== datos.bloqueId || d.tipo !== datos.tipo) return false;
      const claveOtro = (d.cliente || d.proveedor || d.sedeDestino || "").trim().toLowerCase();
      return claveOtro === clave;
    });
  }, [datos, fecha, todosDespachos, inicial]);

  const confirmarGuardado = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (guardando) return;
    if (hayErrores) { setIntentoGuardar(true); return; }
    setErrorGuardado("");
    // Un despacho nuevo va al final del horario al que pertenece, no
    // con "orden" en 0 por defecto: si ese horario ya se había
    // reordenado antes, un valor 0 lo hacía saltar al inicio de la
    // lista en vez de agregarse al final, como se espera de algo recién
    // creado. Un despacho que se está EDITANDO conserva su orden actual.
    let ordenFinal = datos.orden || 0;
    if (!inicial) {
      const despachosDelBloque = (todosDespachos || []).filter((d) => d.bloqueId === datos.bloqueId);
      ordenFinal = despachosDelBloque.length ? Math.max(...despachosDelBloque.map((d) => d.orden || 0)) + 1 : 0;
    }
    // Estandarización de respaldo: los campos ya se limpian al salir de
    // cada uno (onBlur), pero si se hizo clic en "Guardar" tan rápido
    // que el campo no alcanzó a perder el foco antes, esto asegura que
    // quede igual de estandarizado en la base de datos.
    const datosEstandarizados = Object.assign({}, datos, {
      cliente: capitalizarPalabras(datos.cliente),
      proveedor: capitalizarPalabras(datos.proveedor),
      persona1: capitalizarPalabras(datos.persona1),
      persona2: capitalizarPalabras(datos.persona2),
      direccion: capitalizarPalabras(datos.direccion),
      celular: limpiarCelular(datos.celular),
      celular1: limpiarCelular(datos.celular1),
      celular2: limpiarCelular(datos.celular2),
    });
    // Sin id cuando es nuevo: el UUID lo genera la base de datos. Antes
    // se inventaba uno con uid() que la base descartaba igual.
    setGuardando(true);
    const err = await onGuardar(Object.assign({}, datosEstandarizados, { fecha: fecha, id: inicial ? inicial.id : null, orden: ordenFinal }));
    setGuardando(false);
    // Si falló, el modal sigue abierto con todo lo escrito: lo peor que
    // podía pasar era cerrarlo y perder el despacho sin decir nada.
    if (err) setErrorGuardado(err);
  };

  const borde = (hayError) => (intentoGuardar && hayError ? { borderColor: "var(--brand-accent)" } : null);

  return (
    <form onSubmit={confirmarGuardado} noValidate>
      <div style={row}>
        <label className="campo-label">Tipo de despacho</label>
        <SelectorTipo tipoSeleccionado={datos.tipo} onSeleccionarTipo={cambiarTipo} oscuro={oscuro} />
      </div>

      <div style={row}>
        <label className="campo-label">Horario de salida</label>
        <SelectorHorario
          bloques={bloques}
          bloqueIdSeleccionado={datos.bloqueId}
          onSeleccionarBloque={(id) => cambiarCampo("bloqueId", id)}
          conteoPorBloqueId={conteoPorBloqueId}
        />
        {intentoGuardar && errores.bloque && <p style={{ fontSize: 12, color: "var(--brand-accent)", margin: "6px 0 0" }}>{errores.bloque}</p>}

        {!creandoHorario ? (
          <button type="button" onClick={() => setCreandoHorario(true)} style={{ fontSize: 12, height: 28, padding: "0 10px", marginTop: 8 }}>
            <Icon name="clock-plus" size={13} /> Crear un horario nuevo aquí
          </button>
        ) : (
          <CrearHorarioInline
            bloques={bloques}
            onCrear={onCrearHorario}
            onCancelar={(nuevoBloqueId) => {
              setCreandoHorario(false);
              if (nuevoBloqueId) cambiarCampo("bloqueId", nuevoBloqueId);
            }}
          />
        )}
      </div>

      {/* --- Sede: su significado cambia según el tipo --- */}
      <div style={row}>
        <label className="campo-label">{cfg.sedeLabel}</label>
        <select
          style={Object.assign({ width: "100%" }, borde(errores.tienda))}
          value={datos.tienda}
          onChange={(e) => cambiarCampo("tienda", e.target.value)}
        >
          <option value="">Selecciona una sede...</option>
          {sedes.map((s) => <option key={s.codigo} value={s.codigo}>{s.codigo} · {s.nombre}</option>)}
        </select>
        <p className="campo-ayuda">{cfg.sedeAyuda}</p>
        {intentoGuardar && errores.tienda && <p style={{ fontSize: 12, color: "var(--brand-accent)", margin: "4px 0 0" }}>{errores.tienda}</p>}
      </div>

      {/* --- Movimiento: sede de destino --- */}
      {cfg.usaDestino && (
        <div style={row}>
          <label className="campo-label">Sede destino</label>
          <select
            style={Object.assign({ width: "100%" }, borde(errores.destino))}
            value={datos.sedeDestino}
            onChange={(e) => cambiarCampo("sedeDestino", e.target.value)}
          >
            <option value="">Selecciona la sede que recibe...</option>
            {sedesDestino.map((s) => <option key={s.codigo} value={s.codigo}>{s.codigo} · {s.nombre}</option>)}
          </select>
          <p className="campo-ayuda">A qué sede se traslada la mercadería</p>
          {intentoGuardar && errores.destino && <p style={{ fontSize: 12, color: "var(--brand-accent)", margin: "4px 0 0" }}>{errores.destino}</p>}
        </div>
      )}

      {/* --- Venta: cliente --- */}
      {cfg.usaCliente && (
        <div style={row}>
          <CampoSugerido
            label="Cliente"
            valor={datos.cliente}
            onCambiarValor={(v) => cambiarCampo("cliente", v)}
            sugerencias={catalogos.cliente}
            placeholder="Nombre o razón social del cliente"
            ayuda="A quién se le vende la mercadería"
            tipo="nombre"
          />
        </div>
      )}

      {/* --- Compra: proveedor --- */}
      {cfg.usaProveedor && (
        <div style={row}>
          <CampoSugerido
            label="Proveedor"
            valor={datos.proveedor}
            onCambiarValor={(v) => cambiarCampo("proveedor", v)}
            sugerencias={catalogos.proveedor}
            placeholder="Nombre o razón social del proveedor"
            ayuda="A quién se le compra la mercadería"
            tipo="nombre"
          />
        </div>
      )}

      {intentoGuardar && errores.general && (
        <p style={{ fontSize: 12, color: "var(--brand-accent)", margin: "-8px 0 12px" }}>{errores.general}</p>
      )}

      {posibleDuplicado && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--warn-bg)", borderRadius: "var(--radius)", padding: "8px 10px", marginBottom: 14 }}>
          <Icon name="alert-triangle" size={14} />
          <span style={{ fontSize: 12, color: "var(--warn)" }}>Ya existe un despacho parecido en este mismo horario. Revisa que no sea duplicado.</span>
        </div>
      )}

      {/* --- Personas: cada rol con su explicación --- */}
      <div style={row}>
        <CampoPersona
          titulo={cfg.persona1.label}
          ayuda={cfg.persona1.ayuda}
          icono={cfg.persona1.icono}
          valor={datos.persona1}
          onCambiarValor={(v) => cambiarCampo("persona1", v)}
          sugerencias={catalogos.responsable}
          color={oscuro ? TIPOS[datos.tipo].dark : TIPOS[datos.tipo].color}
        />
        {cfg.persona2 && (
          <div>
            <CampoPersona
              titulo={cfg.persona2.label}
              ayuda={cfg.persona2.ayuda}
              icono={cfg.persona2.icono}
              valor={datos.persona2}
              onCambiarValor={(v) => cambiarCampo("persona2", v)}
              sugerencias={catalogos.responsable}
              color={oscuro ? TIPOS[datos.tipo].dark : TIPOS[datos.tipo].color}
            />
            {cfg.permiteCopiarPersona && datos.persona1 && (
              <button
                type="button"
                onClick={() => cambiarCampo("persona2", datos.persona1)}
                style={{ fontSize: 12, height: 28, padding: "0 10px", marginTop: 6 }}
              >
                <Icon name="copy" size={12} /> Usar el mismo responsable
              </button>
            )}
          </div>
        )}
      </div>

      {/* --- Celular: uno solo, o uno por persona si el tipo lo requiere --- */}
      {cfg.usaCelularPorPersona ? (
        <div className="form-grid form-grid-2" style={row}>
          <CampoSugerido
            label={"Celular de " + cfg.persona1.label.toLowerCase()}
            valor={datos.celular1}
            onCambiarValor={(v) => cambiarCampo("celular1", v)}
            sugerencias={catalogos.celular}
            placeholder="Número de contacto"
            tipo="celular"
          />
          <CampoSugerido
            label={"Celular de " + cfg.persona2.label.toLowerCase()}
            valor={datos.celular2}
            onCambiarValor={(v) => cambiarCampo("celular2", v)}
            sugerencias={catalogos.celular}
            placeholder="Número de contacto"
            tipo="celular"
          />
        </div>
      ) : (
        <div style={row}>
          <CampoSugerido
            label="Celular de contacto"
            valor={datos.celular}
            onCambiarValor={(v) => cambiarCampo("celular", v)}
            sugerencias={catalogos.celular}
            placeholder="Número de contacto"
            tipo="celular"
          />
        </div>
      )}

      {/* --- Documentos: solo donde la operación los usa --- */}
      {cfg.usaComprobante && (
        <div style={row}>
          <CampoComprobante
            valorComprobante={datos.comprobante}
            onCambiarComprobante={(v) => cambiarCampo("comprobante", v)}
            valorGuia={datos.numGuia}
            onCambiarGuia={(v) => cambiarCampo("numGuia", v)}
          />
        </div>
      )}

      {/* --- Cobro: propio de la venta --- */}
      {cfg.usaCobro && (
        <div className="form-grid form-grid-2" style={{ marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, paddingTop: 20 }}>
            <input
              type="checkbox" id="chk-cobra" checked={datos.cobra}
              onChange={(e) => {
                // Al destildar se borra el monto también: si no, quedaba
                // guardado en memoria y viajaba igual a la base de datos
                // (cobra: false, monto: 150), un dato contradictorio que
                // ningún reporte muestra pero que ahí se queda.
                const marcado = e.target.checked;
                setDatos((prev) => Object.assign({}, prev, { cobra: marcado, monto: marcado ? prev.monto : "" }));
              }}
            />
            <label htmlFor="chk-cobra" style={{ fontSize: 14 }}>¿Se cobra en la entrega?</label>
          </div>
          {datos.cobra && (
            <div>
              <label className="campo-label" htmlFor="input-monto">Monto (S/)</label>
              <input id="input-monto" type="number" min="0" step="0.1" value={datos.monto} onChange={(e) => cambiarCampo("monto", e.target.value)} style={Object.assign({ width: "100%" }, borde(errores.monto))} />
              {intentoGuardar && errores.monto && <p style={{ fontSize: 12, color: "var(--brand-accent)", margin: "4px 0 0" }}>{errores.monto}</p>}
            </div>
          )}
        </div>
      )}

      {cfg.usaDireccion && (
        <div style={{ marginBottom: 20 }}>
          <CampoDireccion
            etiqueta={datos.tipo === "COMPRA" ? "Dirección de recojo (opcional)" : "Dirección de entrega"}
            direccion={datos.direccion}
            mapsUrl={datos.mapsUrl}
            onCambiarDireccion={(v) => cambiarCampo("direccion", v)}
            onCambiarMaps={(v) => cambiarCampo("mapsUrl", v)}
            sugerencias={catalogos.direccion}
          />
        </div>
      )}

      <AvisoError mensaje={errorGuardado} onCerrar={() => setErrorGuardado("")} />

      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button type="button" onClick={onCancelar}>Cancelar</button>
        <button type="submit" disabled={guardando} style={{ borderColor: "var(--brand-accent)", color: "var(--brand-accent)" }}>
          <Icon name="check" /> {guardando ? "Guardando..." : "Guardar despacho"}
        </button>
      </div>
    </form>
  );
}
