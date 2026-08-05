import { describe, it, expect } from "vitest";
import { calcularMetrica, formatoMetrica } from "./metricas";

const datos = [
  { tipo: "VENTA", tienda: "P01", estado: "entregado", cobra: true, monto: "100" },
  { tipo: "VENTA", tienda: "P01", estado: "pendiente", cobra: false, monto: "" },
  { tipo: "COMPRA", tienda: "P03", estado: "no_entregado", cobra: false, monto: null },
  { tipo: "MOV_MERCADERIA", tienda: "P01", sedeDestino: "P03", estado: "entregado", cobra: true, monto: "50" },
];

describe("calcularMetrica", () => {
  it("cuenta sin filtro", () => {
    expect(calcularMetrica({ operacion: "contar" }, datos)).toBe(4);
  });

  it("cuenta con filtro por tipo", () => {
    expect(calcularMetrica({ operacion: "contar", filtroCampo: "tipo", filtroValor: "VENTA" }, datos)).toBe(2);
  });

  it("filtra por 'no entregado' (el estado que faltaba en el selector)", () => {
    expect(calcularMetrica({ operacion: "contar", filtroCampo: "estado", filtroValor: "no_entregado" }, datos)).toBe(1);
  });

  it("el filtro booleano de cobro compara como texto", () => {
    expect(calcularMetrica({ operacion: "contar", filtroCampo: "cobra", filtroValor: "true" }, datos)).toBe(2);
    expect(calcularMetrica({ operacion: "contar", filtroCampo: "cobra", filtroValor: "false" }, datos)).toBe(2);
  });

  it("suma montos tratando los vacíos como cero", () => {
    expect(calcularMetrica({ operacion: "sumar" }, datos)).toBe(150);
  });

  it("el promedio ignora los que no tienen monto, no los cuenta como cero", () => {
    // 100 y 50 -> 75. Si contara los vacíos como 0 daría 37.5.
    expect(calcularMetrica({ operacion: "promediar" }, datos)).toBe(75);
  });

  it("promedio sin ningún monto es 0 y no NaN", () => {
    expect(calcularMetrica({ operacion: "promediar" }, [{ monto: "" }])).toBe(0);
  });

  it("porcentaje sobre el total del rango", () => {
    expect(calcularMetrica({ operacion: "porcentaje", filtroCampo: "tienda", filtroValor: "P01" }, datos)).toBe(75);
  });

  it("porcentaje con lista vacía es 0, no división por cero", () => {
    expect(calcularMetrica({ operacion: "porcentaje", filtroCampo: "tipo", filtroValor: "VENTA" }, [])).toBe(0);
  });

  it("un filtro con valor vacío no filtra nada", () => {
    expect(calcularMetrica({ operacion: "contar", filtroCampo: "tipo", filtroValor: "" }, datos)).toBe(4);
  });
});

describe("formatoMetrica", () => {
  it("los montos llevan soles y 2 decimales", () => {
    expect(formatoMetrica(150, "sumar")).toBe("S/ 150.00");
    expect(formatoMetrica(75, "promediar")).toBe("S/ 75.00");
  });
  it("los porcentajes llevan 1 decimal", () => {
    expect(formatoMetrica(75, "porcentaje")).toBe("75.0%");
  });
  it("los conteos van redondeados y sin decimales", () => {
    expect(formatoMetrica(4, "contar")).toBe("4");
  });
});
