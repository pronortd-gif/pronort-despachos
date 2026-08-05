import { describe, it, expect, vi, afterEach } from "vitest";
import { diasAtras, hoy } from "./constants";
import { rangoDeDias, rangoAnterior, dentro } from "./rangos";

afterEach(() => { vi.useRealTimers(); });

// Hallazgo de auditoría: "Última semana" abarcaba 8 fechas (hoy + los 7
// anteriores) y "Último mes" 31, pero se comparaban contra periodos
// anteriores de 7 y 30 días exactos. Ese día de más inflaba siempre el
// porcentaje de variación.

const contarFechasEn = (rango, dias) => {
  let n = 0;
  for (let i = 0; i < dias; i++) if (dentro(diasAtras(i), rango)) n++;
  return n;
};

describe("rangoDeDias: N días contando hoy", () => {
  it("una semana son exactamente 7 fechas, no 8", () => {
    expect(contarFechasEn(rangoDeDias(7), 400)).toBe(7);
  });

  it("un mes son exactamente 30 fechas, no 31", () => {
    expect(contarFechasEn(rangoDeDias(30), 400)).toBe(30);
  });

  it("un rango de 1 día es solo hoy", () => {
    const r = rangoDeDias(1);
    expect(r.desde).toBe(hoy());
    expect(r.hasta).toBe(hoy());
    expect(contarFechasEn(r, 400)).toBe(1);
  });

  it("incluye hoy y excluye mañana", () => {
    const r = rangoDeDias(7);
    expect(dentro(hoy(), r)).toBe(true);
    // Un despacho programado para mañana no pertenece a "última semana".
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 5, 12, 0, 0));
    const r2 = rangoDeDias(7);
    expect(dentro("2026-08-06", r2)).toBe(false);
    expect(dentro("2026-08-05", r2)).toBe(true);
    expect(dentro("2026-07-30", r2)).toBe(true);
    expect(dentro("2026-07-29", r2)).toBe(false);
  });
});

describe("rangoAnterior: mismo tamaño, sin solaparse", () => {
  it("el periodo anterior tiene el mismo número de días que el actual", () => {
    [1, 7, 30].forEach((dias) => {
      expect(contarFechasEn(rangoAnterior(dias), 400)).toBe(dias);
    });
  });

  it("no comparte ninguna fecha con el rango actual", () => {
    const actual = rangoDeDias(7);
    const previo = rangoAnterior(7);
    for (let i = 0; i < 60; i++) {
      const f = diasAtras(i);
      expect(dentro(f, actual) && dentro(f, previo)).toBe(false);
    }
  });

  it("los dos periodos son contiguos: no queda ningún día en medio", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 5, 12, 0, 0));
    const actual = rangoDeDias(7);   // 30 jul – 5 ago
    const previo = rangoAnterior(7); // 23 – 29 jul
    expect(actual.desde).toBe("2026-07-30");
    expect(previo.hasta).toBe("2026-07-29");
    expect(previo.desde).toBe("2026-07-23");
  });
});

describe("dentro", () => {
  it("los bordes son inclusivos por ambos lados", () => {
    const r = { desde: "2026-08-01", hasta: "2026-08-05" };
    expect(dentro("2026-08-01", r)).toBe(true);
    expect(dentro("2026-08-05", r)).toBe(true);
    expect(dentro("2026-07-31", r)).toBe(false);
    expect(dentro("2026-08-06", r)).toBe(false);
  });
});
