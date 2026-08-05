import { describe, it, expect } from "vitest";
import { bandasOcupadas, calcularSalida, calcularOcupacion, totalesDeSalida, franjaConMasCarga } from "./calor";

const bloque = (id, inicio, fin) => ({ id, fecha: "2026-08-05", nombre: "", inicio, fin });
const desp = (id, bloqueId, tienda, tipo) => ({ id, bloqueId, tienda, tipo: tipo || "VENTA", fecha: "2026-08-05" });

describe("bandasOcupadas", () => {
  it("un horario dentro de una sola hora ocupa una banda", () => {
    expect(bandasOcupadas("09:00", "09:30")).toEqual([9]);
  });
  it("terminar justo en punto no ocupa esa hora", () => {
    expect(bandasOcupadas("09:00", "11:00")).toEqual([9, 10]);
  });
  it("terminar pasada la hora sí la ocupa", () => {
    expect(bandasOcupadas("09:00", "11:30")).toEqual([9, 10, 11]);
  });
  it("se recorta a la jornada (08:00–18:00)", () => {
    expect(bandasOcupadas("05:00", "07:00")).toEqual([8]);
    expect(bandasOcupadas("20:00", "22:00")).toEqual([17]);
  });
  it("una hora inválida no revienta", () => {
    expect(bandasOcupadas("", "")).toEqual([]);
    expect(bandasOcupadas("nada", "10:00")).toEqual([]);
  });
});

describe("vista salida: cada despacho cuenta una vez", () => {
  const mapa = { b1: bloque("b1", "09:00", "10:00"), b2: bloque("b2", "14:00", "15:00") };

  it("agrupa por banda y sede", () => {
    const celdas = calcularSalida([desp("d1", "b1", "P01"), desp("d2", "b1", "P01"), desp("d3", "b2", "P03")], mapa, "");
    expect(celdas["9|P01"]).toBe(2);
    expect(celdas["14|P03"]).toBe(1);
  });

  it("los totales cuadran: filas, columnas y total suman lo mismo", () => {
    const celdas = calcularSalida([desp("d1", "b1", "P01"), desp("d2", "b1", "P03"), desp("d3", "b2", "P01")], mapa, "");
    const t = totalesDeSalida(celdas);
    const sumaFilas = Object.values(t.porFila).reduce((a, b) => a + b, 0);
    const sumaColumnas = Object.values(t.porColumna).reduce((a, b) => a + b, 0);
    expect(t.general).toBe(3);
    expect(sumaFilas).toBe(3);
    expect(sumaColumnas).toBe(3);
  });

  it("ignora despachos sin sede o sin horario válido", () => {
    const celdas = calcularSalida([desp("d1", "b1", ""), desp("d2", "inexistente", "P01")], mapa, "");
    expect(Object.keys(celdas)).toHaveLength(0);
  });

  it("respeta el filtro por tipo", () => {
    const celdas = calcularSalida([desp("d1", "b1", "P01", "VENTA"), desp("d2", "b1", "P01", "COMPRA")], mapa, "COMPRA");
    expect(celdas["9|P01"]).toBe(1);
  });
});

// El hallazgo de auditoría: un horario que atiende a varias sedes
// incrementaba una celda por cada sede, y el total —que sumaba celdas—
// contaba ese mismo carro dos veces.
describe("vista ocupación: un horario es un carro, aunque toque varias sedes", () => {
  it("un horario con despachos de dos sedes aparece en ambas columnas", () => {
    const r = calcularOcupacion(
      [bloque("b1", "09:00", "10:00")],
      [desp("d1", "b1", "P01"), desp("d2", "b1", "P03")],
      ""
    );
    // Correcto: las dos sedes están ocupadas a esa hora.
    expect(r.celdas["9|P01"]).toBe(1);
    expect(r.celdas["9|P03"]).toBe(1);
    // Pero sigue siendo UN carro, no dos.
    expect(r.porFila[9]).toBe(1);
    expect(r.general).toBe(1);
  });

  it("sumar las celdas daría el doble: por eso los totales no las suman", () => {
    const r = calcularOcupacion(
      [bloque("b1", "09:00", "10:00")],
      [desp("d1", "b1", "P01"), desp("d2", "b1", "P03")],
      ""
    );
    const sumaCeldas = Object.values(r.celdas).reduce((a, b) => a + b, 0);
    expect(sumaCeldas).toBe(2);   // lo que se contaba antes
    expect(r.general).toBe(1);    // lo que de verdad hay
  });

  it("dos carros distintos a la misma hora sí son dos", () => {
    const r = calcularOcupacion(
      [bloque("b1", "09:00", "10:00"), bloque("b2", "09:00", "10:00")],
      [desp("d1", "b1", "P01"), desp("d2", "b2", "P01")],
      ""
    );
    expect(r.porFila[9]).toBe(2);
    expect(r.general).toBe(2);
  });

  it("un horario largo ocupa varias franjas y cuenta en cada una", () => {
    const r = calcularOcupacion([bloque("b1", "09:00", "12:00")], [desp("d1", "b1", "P01")], "");
    expect(r.porFila[9]).toBe(1);
    expect(r.porFila[10]).toBe(1);
    expect(r.porFila[11]).toBe(1);
    // El total son "carro-horas": 1 carro × 3 franjas.
    expect(r.general).toBe(3);
    // Y las filas sí suman al total.
    expect(Object.values(r.porFila).reduce((a, b) => a + b, 0)).toBe(3);
  });

  it("un horario vacío también ocupa el carro", () => {
    const r = calcularOcupacion([bloque("b1", "09:00", "10:00")], [], "");
    expect(r.celdas["9|__vacio__"]).toBe(1);
    expect(r.general).toBe(1);
  });

  it("con filtro por tipo, un horario sin despachos de ese tipo no cuenta", () => {
    const r = calcularOcupacion(
      [bloque("b1", "09:00", "10:00")],
      [desp("d1", "b1", "P01", "VENTA")],
      "COMPRA"
    );
    expect(r.general).toBe(0);
  });

  it("la columna cuenta horarios distintos por sede, no celdas", () => {
    const r = calcularOcupacion(
      [bloque("b1", "09:00", "12:00")],   // 3 franjas
      [desp("d1", "b1", "P01")],
      ""
    );
    // Un solo horario tocó P01, aunque ocupe 3 franjas.
    expect(r.porColumna.P01).toBe(1);
  });
});

describe("franjaConMasCarga", () => {
  it("devuelve la franja con el total más alto", () => {
    expect(franjaConMasCarga({ 9: 2, 14: 7, 16: 3 })).toEqual({ hora: 14, total: 7 });
  });
  it("sin datos devuelve null en vez de reventar", () => {
    expect(franjaConMasCarga({})).toBe(null);
  });
});
