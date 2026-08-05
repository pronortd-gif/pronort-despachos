// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

// ---- Supabase simulado ----------------------------------------------
// Registra la cadena de llamadas (from → select → eq → ...) y devuelve
// las respuestas que le pongamos en cola, para poder afirmar QUÉ se le
// pidió a la base de datos, no solo qué acabó en pantalla.
const sb = vi.hoisted(() => {
  const registro = [];
  const cola = [];
  let actual = null;

  const cadena = {};
  ["select", "insert", "update", "delete", "eq", "in", "or", "gte", "lt", "lte", "order", "range", "single"].forEach((m) => {
    cadena[m] = (...args) => { actual.pasos.push({ m, args }); return cadena; };
  });
  cadena.then = (resolver, rechazar) => {
    const r = cola.length ? cola.shift() : { data: [], error: null };
    actual.resultado = r;
    return Promise.resolve(r).then(resolver, rechazar);
  };

  return {
    cliente: {
      from(tabla) { actual = { tabla, pasos: [] }; registro.push(actual); return cadena; },
      auth: { getSession: () => Promise.resolve({ data: { session: null } }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) },
    },
    registro,
    encolar: (...rs) => cola.push(...rs),
    limpiar: () => { registro.length = 0; cola.length = 0; actual = null; },
    // Devuelve los pasos de la última operación sobre una tabla.
    ultima: (tabla) => [...registro].reverse().find((r) => r.tabla === tabla),
    paso: (op, nombre) => (op ? op.pasos.find((p) => p.m === nombre) : undefined),
  };
});

vi.mock("./supabaseClient", () => ({ supabase: sb.cliente }));

const { traerTodo, despachoDbToApp, despachoAppToDb, mensajeError, useDespachosDB, useSedesDB, useMapaHorarios, DIAS_VENTANA } = await import("./hooksDB");

beforeEach(() => sb.limpiar());

const filaBase = { id: "uuid-1", fecha: "2026-08-05", tipo: "VENTA", estado: "pendiente" };

// ---------------------------------------------------------------------
describe("traerTodo: el límite de 1000 filas de PostgREST", () => {
  const consulta = () => sb.cliente.from("despachos").select("*");

  it("pide una sola página cuando caben todas las filas", async () => {
    sb.encolar({ data: [filaBase], error: null });
    const { data, error } = await traerTodo(consulta);
    expect(error).toBe(null);
    expect(data).toHaveLength(1);
    expect(sb.registro).toHaveLength(1);
  });

  it("sigue pidiendo páginas mientras vengan llenas", async () => {
    // 1000 + 1000 + 3 = 2003 filas repartidas en 3 peticiones.
    const llena = Array.from({ length: 1000 }, (_, i) => ({ ...filaBase, id: "a" + i }));
    const llena2 = Array.from({ length: 1000 }, (_, i) => ({ ...filaBase, id: "b" + i }));
    sb.encolar({ data: llena, error: null }, { data: llena2, error: null }, { data: [filaBase, filaBase, filaBase], error: null });

    const { data } = await traerTodo(consulta);
    expect(data).toHaveLength(2003);
    expect(sb.registro).toHaveLength(3);
    // Los rangos deben ser contiguos y sin solaparse.
    expect(sb.registro.map((r) => sb.paso(r, "range").args)).toEqual([[0, 999], [1000, 1999], [2000, 2999]]);
  });

  it("una página exactamente llena y luego vacía termina bien", async () => {
    const llena = Array.from({ length: 1000 }, () => filaBase);
    sb.encolar({ data: llena, error: null }, { data: [], error: null });
    const { data } = await traerTodo(consulta);
    expect(data).toHaveLength(1000);
    expect(sb.registro).toHaveLength(2);
  });

  it("un error corta el bucle y no devuelve datos a medias", async () => {
    const llena = Array.from({ length: 1000 }, () => filaBase);
    sb.encolar({ data: llena, error: null }, { data: null, error: { message: "boom" } });
    const { data, error } = await traerTodo(consulta);
    expect(data).toBe(null);
    expect(error).toEqual({ message: "boom" });
  });
});

// ---------------------------------------------------------------------
describe("mapeo entre la app y las columnas de la base", () => {
  it("VENTA guarda la persona en responsable y no ensucia las otras columnas", () => {
    const fila = despachoAppToDb({ tipo: "VENTA", fecha: "2026-08-05", cliente: "Acme", persona1: "Ana", persona2: "Beto" });
    expect(fila.cliente).toBe("Acme");
    expect(fila.responsable).toBe("Ana");
    expect(fila.gestionado_por).toBe(null);
    expect(fila.trasladado_por).toBe(null);
    expect(fila.proveedor).toBe(null);
  });

  it("COMPRA usa gestionado_por / entregado_por", () => {
    const fila = despachoAppToDb({ tipo: "COMPRA", fecha: "x", proveedor: "Prov", persona1: "Ana", persona2: "Beto" });
    expect(fila.gestionado_por).toBe("Ana");
    expect(fila.entregado_por).toBe("Beto");
    expect(fila.responsable).toBe(null);
    expect(fila.cliente).toBe(null);
  });

  it("MOV_MERCADERIA usa trasladado_por / recibe_destino y sede_destino", () => {
    const fila = despachoAppToDb({ tipo: "MOV_MERCADERIA", fecha: "x", sedeDestino: "P03", persona1: "Ana", persona2: "Beto" });
    expect(fila.trasladado_por).toBe("Ana");
    expect(fila.recibe_destino).toBe("Beto");
    expect(fila.sede_destino).toBe("P03");
    expect(fila.responsable).toBe(null);
  });

  it("ida y vuelta no pierde las personas en ningún tipo", () => {
    ["VENTA", "COMPRA", "MOV_MERCADERIA"].forEach((tipo) => {
      const original = {
        tipo, fecha: "2026-08-05", tienda: "P01", sedeDestino: tipo === "MOV_MERCADERIA" ? "P03" : "",
        cliente: tipo === "VENTA" ? "Acme" : "", proveedor: tipo === "COMPRA" ? "Prov" : "",
        persona1: "Ana", persona2: tipo === "VENTA" ? "" : "Beto",
      };
      const vuelta = despachoDbToApp({ ...despachoAppToDb(original), id: "x" });
      expect(vuelta.persona1).toBe("Ana");
      expect(vuelta.tipo).toBe(tipo);
      if (tipo !== "VENTA") expect(vuelta.persona2).toBe("Beto");
    });
  });

  it("el monto vacío se guarda como NULL, no como 0", () => {
    expect(despachoAppToDb({ tipo: "VENTA", monto: "" }).monto).toBe(null);
    expect(despachoAppToDb({ tipo: "VENTA", monto: "12.5" }).monto).toBe(12.5);
  });

  it("nunca se envía el id dentro de la fila (lo pone la base)", () => {
    expect(despachoAppToDb({ tipo: "VENTA", id: "uuid-1" })).not.toHaveProperty("id");
  });
});

// ---------------------------------------------------------------------
describe("mensajeError habla en español y en concreto", () => {
  it("distingue el fallo de red", () => {
    expect(mensajeError({ message: "Failed to fetch" }, "guardar el despacho")).toMatch(/Sin conexión/);
  });
  it("distingue el duplicado por código de Postgres", () => {
    expect(mensajeError({ code: "23505", message: "" }, "guardar")).toMatch(/Ya existe/);
  });
  it("distingue la clave foránea", () => {
    expect(mensajeError({ code: "23503", message: "" }, "eliminar la sede")).toMatch(/dependen de este/);
  });
  it("distingue la sesión caducada", () => {
    expect(mensajeError({ message: "JWT expired" }, "cargar")).toMatch(/sesión expiró/);
  });
  it("sin error devuelve cadena vacía", () => {
    expect(mensajeError(null, "guardar")).toBe("");
  });
});

// ---------------------------------------------------------------------
describe("useDespachosDB", () => {
  const montar = async () => {
    sb.encolar({ data: [], error: null });
    const r = renderHook(() => useDespachosDB());
    await waitFor(() => expect(r.result.current.cargando).toBe(false));
    sb.limpiar();
    return r;
  };

  it("al abrir solo pide la ventana de 90 días, no todo el histórico", async () => {
    sb.encolar({ data: [], error: null });
    const { result } = renderHook(() => useDespachosDB());
    await waitFor(() => expect(result.current.cargando).toBe(false));
    const gte = sb.paso(sb.ultima("despachos"), "gte");
    expect(gte).toBeDefined();
    expect(gte.args[0]).toBe("fecha");
    expect(DIAS_VENTANA).toBe(90);
  });

  it("cargarHistorico quita el filtro de fecha", async () => {
    const { result } = await montar();
    sb.encolar({ data: [], error: null });
    await act(async () => { await result.current.cargarHistorico(); });
    expect(sb.paso(sb.ultima("despachos"), "gte")).toBeUndefined();
    expect(result.current.historicoCompleto).toBe(true);
  });

  it("un fallo de carga se expone como error, no como lista vacía", async () => {
    sb.encolar({ data: null, error: { message: "Failed to fetch" } });
    const { result } = renderHook(() => useDespachosDB());
    await waitFor(() => expect(result.current.cargando).toBe(false));
    expect(result.current.error).toMatch(/Sin conexión/);
  });

  it("un despacho nuevo (sin id) se INSERTA sin id", async () => {
    const { result } = await montar();
    sb.encolar({ data: { ...filaBase, id: "generado-por-la-bd" }, error: null });
    await act(async () => { await result.current.guardar({ id: null, tipo: "VENTA", fecha: "2026-08-05" }); });

    const op = sb.ultima("despachos");
    const insert = sb.paso(op, "insert");
    expect(insert).toBeDefined();
    expect(insert.args[0]).not.toHaveProperty("id");
    expect(result.current.despachos[0].id).toBe("generado-por-la-bd");
  });

  it("un despacho que ya está en pantalla se ACTUALIZA por su id", async () => {
    sb.encolar({ data: [filaBase], error: null });
    const { result } = renderHook(() => useDespachosDB());
    await waitFor(() => expect(result.current.cargando).toBe(false));
    sb.limpiar();

    sb.encolar({ data: { ...filaBase, tienda: "P05" }, error: null });
    await act(async () => { await result.current.guardar({ id: "uuid-1", tipo: "VENTA", fecha: "2026-08-05", tienda: "P05" }); });

    const op = sb.ultima("despachos");
    expect(sb.paso(op, "update")).toBeDefined();
    expect(sb.paso(op, "insert")).toBeUndefined();
    expect(sb.paso(op, "eq").args).toEqual(["id", "uuid-1"]);
  });

  // El caso del "Deshacer": el despacho ya no está en pantalla pero
  // conserva su id. Debe reinsertarse CON ese id, no con uno nuevo.
  it("restaurar un despacho borrado reinserta con su id original", async () => {
    const { result } = await montar();
    sb.encolar({ data: { ...filaBase, id: "uuid-borrado" }, error: null });
    await act(async () => { await result.current.guardar({ id: "uuid-borrado", tipo: "VENTA", fecha: "2026-08-05" }); });

    const op = sb.ultima("despachos");
    const insert = sb.paso(op, "insert");
    expect(insert).toBeDefined();
    expect(insert.args[0].id).toBe("uuid-borrado");
  });

  it("guardar devuelve el mensaje de error y no toca la lista", async () => {
    const { result } = await montar();
    sb.encolar({ data: null, error: { message: "Failed to fetch" } });
    let err;
    await act(async () => { err = await result.current.guardar({ id: null, tipo: "VENTA", fecha: "x" }); });
    expect(err).toMatch(/Sin conexión/);
    expect(result.current.despachos).toHaveLength(0);
  });

  it("cambiarEstado revierte el cambio en pantalla si la base lo rechaza", async () => {
    sb.encolar({ data: [filaBase], error: null });
    const { result } = renderHook(() => useDespachosDB());
    await waitFor(() => expect(result.current.cargando).toBe(false));
    sb.limpiar();

    sb.encolar({ data: null, error: { message: "Failed to fetch" } });
    let err;
    await act(async () => { err = await result.current.cambiarEstado("uuid-1", "entregado"); });
    expect(err).toMatch(/Sin conexión/);
    expect(result.current.despachos[0].estado).toBe("pendiente");
  });

  it("desasignarBloque devuelve los despachos afectados para poder deshacer", async () => {
    sb.encolar({ data: [{ ...filaBase, id: "d1", bloque_id: "b1" }, { ...filaBase, id: "d2", bloque_id: "b1" }, { ...filaBase, id: "d3", bloque_id: "b2" }], error: null });
    const { result } = renderHook(() => useDespachosDB());
    await waitFor(() => expect(result.current.cargando).toBe(false));

    let afectados;
    act(() => { afectados = result.current.desasignarBloque("b1"); });
    expect(afectados).toEqual(["d1", "d2"]);
    // Es solo estado local: la base ya lo hizo con on delete set null.
    expect(result.current.despachos.filter((d) => d.bloqueId === "b1")).toHaveLength(0);
    expect(result.current.despachos.find((d) => d.id === "d3").bloqueId).toBe("b2");
  });

  it("reasignarBloque vuelve a vincular los despachos con el horario restaurado", async () => {
    sb.encolar({ data: [{ ...filaBase, id: "d1", bloque_id: null }], error: null });
    const { result } = renderHook(() => useDespachosDB());
    await waitFor(() => expect(result.current.cargando).toBe(false));
    sb.limpiar();

    sb.encolar({ data: null, error: null });
    await act(async () => { await result.current.reasignarBloque(["d1"], "b1"); });

    const op = sb.ultima("despachos");
    expect(sb.paso(op, "update").args[0]).toEqual({ bloque_id: "b1" });
    expect(sb.paso(op, "in").args).toEqual(["id", ["d1"]]);
    expect(result.current.despachos[0].bloqueId).toBe("b1");
  });

  it("reasignarBloque con lista vacía no llama a la base", async () => {
    const { result } = await montar();
    await act(async () => { await result.current.reasignarBloque([], "b1"); });
    expect(sb.registro).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------
// Hallazgo de auditoría (Alta): el calendario deja abrir cualquier fecha,
// pero al arrancar solo hay en memoria los últimos 90 días. Un día
// anterior mostraba sus horarios y CERO despachos: parecía vacío, y sobre
// eso se podían crear duplicados o reordenar con información incompleta.
describe("useDespachosDB: días fuera de la ventana de 90 días", () => {
  const montar = async () => {
    sb.encolar({ data: [], error: null });
    const r = renderHook(() => useDespachosDB());
    await waitFor(() => expect(r.result.current.cargando).toBe(false));
    sb.limpiar();
    return r;
  };
  // Un mes claramente anterior a la ventana.
  const mesViejo = "2020-03";

  it("un mes dentro de la ventana no genera ninguna consulta", async () => {
    const { result } = await montar();
    const mesActual = new Date().toISOString().slice(0, 7);
    await act(async () => { await result.current.asegurarMes(mesActual); });
    expect(sb.registro).toHaveLength(0);
    expect(result.current.mesDisponible(mesActual)).toBe(true);
  });

  it("un mes anterior sí se pide, acotado a ese mes", async () => {
    const { result } = await montar();
    sb.encolar({ data: [{ ...filaBase, id: "viejo-1", fecha: "2020-03-15" }], error: null });
    await act(async () => { await result.current.asegurarMes(mesViejo); });

    const op = sb.ultima("despachos");
    expect(sb.paso(op, "gte").args).toEqual(["fecha", "2020-03-01"]);
    // Límite superior exclusivo con el mes siguiente: "2020-03-31" fallaría
    // en meses de 30 días y en febrero.
    expect(sb.paso(op, "lt").args).toEqual(["fecha", "2020-04-01"]);
    expect(result.current.despachos.some((d) => d.id === "viejo-1")).toBe(true);
  });

  it("diciembre pide enero del año siguiente como límite", async () => {
    const { result } = await montar();
    sb.encolar({ data: [], error: null });
    await act(async () => { await result.current.asegurarMes("2020-12"); });
    expect(sb.paso(sb.ultima("despachos"), "lt").args).toEqual(["fecha", "2021-01-01"]);
  });

  // Segunda auditoría: el mes se marcaba como disponible ANTES de que
  // llegara la respuesta, y "cargandoMes" era un único booleano. Al
  // navegar rápido entre meses, la primera respuesta apagaba el
  // indicador mientras el segundo mes seguía en el aire, y ese día se
  // mostraba vacío y editable.
  it("un mes en curso NO cuenta como disponible", async () => {
    const { result } = await montar();
    let resolver;
    sb.encolar(new Promise((res) => { resolver = res; }));

    let p;
    await act(async () => {
      p = result.current.asegurarMes(mesViejo);
      await Promise.resolve();
    });
    expect(result.current.mesDisponible(mesViejo)).toBe(false);
    expect(result.current.mesCargando(mesViejo)).toBe(true);

    await act(async () => { resolver({ data: [], error: null }); await p; });
    expect(result.current.mesDisponible(mesViejo)).toBe(true);
    expect(result.current.mesCargando(mesViejo)).toBe(false);
  });

  it("dos meses a la vez: que uno termine no da por bueno el otro", async () => {
    const { result } = await montar();
    let resolverA;
    sb.encolar(new Promise((res) => { resolverA = res; }));   // 2020-03
    sb.encolar({ data: [], error: null });                     // 2020-04, responde ya

    let pA, pB;
    await act(async () => {
      pA = result.current.asegurarMes("2020-03");
      await Promise.resolve();
      pB = result.current.asegurarMes("2020-04");
      await pB;
    });

    // 2020-04 terminó, pero 2020-03 sigue en camino: no puede darse por
    // disponible solo porque el otro haya respondido.
    expect(result.current.mesDisponible("2020-04")).toBe(true);
    expect(result.current.mesDisponible("2020-03")).toBe(false);

    await act(async () => { resolverA({ data: [], error: null }); await pA; });
    expect(result.current.mesDisponible("2020-03")).toBe(true);
  });

  it("un mes que falló no queda marcado como cargado", async () => {
    const { result } = await montar();
    sb.encolar({ data: null, error: { message: "Failed to fetch" } });
    await act(async () => { await result.current.asegurarMes(mesViejo); });
    expect(result.current.mesDisponible(mesViejo)).toBe(false);
    expect(result.current.mesCargando(mesViejo)).toBe(false);
  });

  it("no se pide dos veces el mismo mes", async () => {
    const { result } = await montar();
    sb.encolar({ data: [], error: null });
    await act(async () => { await result.current.asegurarMes(mesViejo); });
    sb.limpiar();
    await act(async () => { await result.current.asegurarMes(mesViejo); });
    expect(sb.registro).toHaveLength(0);
  });

  it("volver a pedir el mes reemplaza sus despachos en vez de duplicarlos", async () => {
    const { result } = await montar();
    sb.encolar({ data: [{ ...filaBase, id: "v1", fecha: "2020-03-15" }], error: null });
    await act(async () => { await result.current.asegurarMes(mesViejo); });
    expect(result.current.despachos.filter((d) => d.fecha.startsWith("2020-03"))).toHaveLength(1);

    // Una recarga completa descarta los meses traídos aparte, así que el
    // mes vuelve a estar disponible para pedirse.
    sb.encolar({ data: [], error: null });
    await act(async () => { await result.current.recargar(); });
    expect(result.current.mesDisponible(mesViejo)).toBe(false);

    sb.encolar({ data: [{ ...filaBase, id: "v1", fecha: "2020-03-15" }], error: null });
    await act(async () => { await result.current.asegurarMes(mesViejo); });
    expect(result.current.despachos.filter((d) => d.id === "v1")).toHaveLength(1);
  });

  it("si falla, el mes queda marcado como no disponible para reintentarlo", async () => {
    const { result } = await montar();
    sb.encolar({ data: null, error: { message: "Failed to fetch" } });
    let err;
    await act(async () => { err = await result.current.asegurarMes(mesViejo); });
    expect(err).toMatch(/Sin conexión/);
    expect(result.current.mesDisponible(mesViejo)).toBe(false);
  });

  it("con el histórico completo ya no hace falta pedir meses sueltos", async () => {
    const { result } = await montar();
    sb.encolar({ data: [], error: null });
    await act(async () => { await result.current.cargarHistorico(); });
    expect(result.current.historicoCompleto).toBe(true);
    sb.limpiar();
    await act(async () => { await result.current.asegurarMes(mesViejo); });
    expect(sb.registro).toHaveLength(0);
    expect(result.current.mesDisponible(mesViejo)).toBe(true);
  });
});

// ---------------------------------------------------------------------
// Hallazgo de auditoría: varias cargas pueden solaparse (refresco al
// volver a la pestaña, botón manual, "cargar histórico"). Sin guarda, la
// que RESPONDE última gana aunque sea la más antigua.
describe("useDespachosDB: carreras entre recargas", () => {
  const montar = async () => {
    sb.encolar({ data: [], error: null });
    const r = renderHook(() => useDespachosDB());
    await waitFor(() => expect(r.result.current.cargando).toBe(false));
    sb.limpiar();
    return r;
  };

  it("una respuesta superada no pisa la lista de la más reciente", async () => {
    const { result } = await montar();
    let resolverLenta;
    const lenta = new Promise((res) => { resolverLenta = res; });
    sb.encolar(lenta);                                                     // 1ª petición
    sb.encolar({ data: [{ ...filaBase, id: "reciente" }], error: null });  // 2ª petición

    await act(async () => {
      const p1 = result.current.recargar();
      await Promise.resolve();
      const p2 = result.current.recargar();
      await p2;
      // La primera responde AHORA, tarde y con datos viejos.
      resolverLenta({ data: [{ ...filaBase, id: "vieja" }], error: null });
      await p1;
    });

    expect(result.current.despachos.map((d) => d.id)).toEqual(["reciente"]);
  });

  it("si la carga del histórico queda superada, no se marca como completo", async () => {
    const { result } = await montar();
    let resolverHistorico;
    const historico = new Promise((res) => { resolverHistorico = res; });
    sb.encolar(historico);                                                  // cargarHistorico
    sb.encolar({ data: [{ ...filaBase, id: "de-90-dias" }], error: null }); // recarga posterior

    await act(async () => {
      const pHist = result.current.cargarHistorico();
      await Promise.resolve();
      const pRec = result.current.recargar();
      await pRec;
      resolverHistorico({ data: [{ ...filaBase, id: "de-todo" }], error: null });
      await pHist;
    });

    // Lo que quedó en memoria son 90 días, así que el botón de "cargar
    // todo el histórico" tiene que seguir disponible.
    expect(result.current.despachos.map((d) => d.id)).toEqual(["de-90-dias"]);
    expect(result.current.historicoCompleto).toBe(false);
  });
});

// ---------------------------------------------------------------------
// Segunda auditoría (Alta): las dos claves foráneas de sede son
// "on delete set null". Borrar una sede en uso ponía en NULL la sede de
// todos sus despachos históricos, y el "deshacer" solo recreaba la fila
// de la sede: los despachos ya habían perdido a qué sede pertenecían.
// Encima el contador de uso miraba solo la memoria (90 días), así que
// una sede con años de historia podía parecer sin usar.
describe("useSedesDB: no se puede borrar una sede en uso", () => {
  const montar = async () => {
    sb.encolar({ data: [{ codigo: "P01", nombre: "Principal", linea: "DRYWALL" }], error: null });
    const r = renderHook(() => useSedesDB());
    await waitFor(() => expect(r.result.current.cargando).toBe(false));
    sb.limpiar();
    return r;
  };

  it("el uso se cuenta contra la base, mirando origen y destino", async () => {
    const { result } = await montar();
    sb.encolar({ data: null, error: null, count: 137 });
    let r;
    await act(async () => { r = await result.current.contarUso("P01"); });

    expect(r.total).toBe(137);
    const op = sb.ultima("despachos");
    // "or" para cubrir las dos columnas que referencian la sede.
    expect(sb.paso(op, "or").args[0]).toBe("tienda.eq.P01,sede_destino.eq.P01");
    // head:true -> solo cuenta, no se trae las filas.
    expect(sb.paso(op, "select").args[1]).toEqual({ count: "exact", head: true });
  });

  it("con despachos asociados NO se borra, y se dice cuántos son", async () => {
    const { result } = await montar();
    sb.encolar({ data: null, error: null, count: 137 });
    let err;
    await act(async () => { err = await result.current.eliminar("P01"); });

    expect(err).toMatch(/137 despacho/);
    // Lo esencial: nunca llegó a ejecutarse el delete.
    expect(sb.registro.some((r) => r.pasos.some((p) => p.m === "delete"))).toBe(false);
    expect(result.current.sedes).toHaveLength(1);
  });

  it("sin despachos asociados sí se borra", async () => {
    const { result } = await montar();
    sb.encolar({ data: null, error: null, count: 0 });
    sb.encolar({ data: null, error: null });
    let err;
    await act(async () => { err = await result.current.eliminar("P01"); });

    expect(err).toBe("");
    expect(sb.registro.some((r) => r.pasos.some((p) => p.m === "delete"))).toBe(true);
    expect(result.current.sedes).toHaveLength(0);
  });

  it("si no se puede comprobar el uso, tampoco se borra", async () => {
    const { result } = await montar();
    sb.encolar({ data: null, error: { message: "Failed to fetch" }, count: null });
    let err;
    await act(async () => { err = await result.current.eliminar("P01"); });

    expect(err).toMatch(/Sin conexión/);
    expect(sb.registro.some((r) => r.pasos.some((p) => p.m === "delete"))).toBe(false);
  });
});

// ---------------------------------------------------------------------
// Segunda auditoría: el mapa de horarios arrastraba la misma carrera
// que ya se había corregido para los despachos.
describe("useMapaHorarios: carreras entre recargas", () => {
  const montar = async () => {
    sb.encolar({ data: [], error: null });
    const r = renderHook(() => useMapaHorarios());
    await waitFor(() => expect(r.result.current.cargando).toBe(false));
    sb.limpiar();
    return r;
  };

  it("una respuesta de 90 días que llega tarde no pisa el mapa completo", async () => {
    const { result } = await montar();
    let resolverLenta;
    sb.encolar(new Promise((res) => { resolverLenta = res; }));            // 1ª: 90 días
    sb.encolar({ data: [{ id: "b-historico", fecha: "2020-01-05" }], error: null }); // 2ª: histórico

    await act(async () => {
      const p1 = result.current.recargar(false);
      await Promise.resolve();
      const p2 = result.current.recargar(true);
      await p2;
      resolverLenta({ data: [{ id: "b-reciente", fecha: "2026-08-05" }], error: null });
      await p1;
    });

    // Si ganara la respuesta vieja, los reportes de fechas antiguas se
    // quedarían sin horarios y sus despachos desaparecerían del mapa.
    expect(Object.keys(result.current.mapa)).toEqual(["b-historico"]);
  });

  it("una vez completo, las recargas siguientes siguen pidiendo todo", async () => {
    const { result } = await montar();
    sb.encolar({ data: [], error: null });
    await act(async () => { await result.current.recargar(true); });
    sb.limpiar();

    sb.encolar({ data: [], error: null });
    await act(async () => { await result.current.recargar(); });
    // Sin filtro de fecha: se sigue pidiendo el histórico entero.
    expect(sb.paso(sb.ultima("bloques"), "gte")).toBeUndefined();
  });

  it("si la carga completa falla, no se recuerda como completa", async () => {
    const { result } = await montar();
    sb.encolar({ data: null, error: { message: "Failed to fetch" } });
    await act(async () => { await result.current.recargar(true); });
    sb.limpiar();

    sb.encolar({ data: [], error: null });
    await act(async () => { await result.current.recargar(); });
    // Vuelve a la ventana de 90 días en vez de dar por hecho que ya
    // tiene todo el histórico.
    expect(sb.paso(sb.ultima("bloques"), "gte")).toBeDefined();
  });
});
