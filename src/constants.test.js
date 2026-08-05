import { describe, it, expect, vi, afterEach } from "vitest";
import {
  fechaLocalISO, hoy, diasAtras, fechaMasDias,
  a12Horas, a24Horas, horaLegible, sumarMinutos, seTraslapan,
  partirComprobante, unirComprobante, mostrarComprobante,
  capitalizarPalabras, limpiarCelular,
  bandaDeHora, ordenarDespachos,
  esLinkOCoordenadas, convertirCoordenadasALink,
} from "./constants";

afterEach(() => { vi.useRealTimers(); });

describe("fechas en hora local", () => {
  // Este es el bug que motivó las pruebas: con toISOString() (UTC), a
  // partir de las 19:00 en Perú (UTC-5) la app se adelantaba un día.
  it("a las 8 p.m. sigue siendo el mismo día, no el siguiente", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 5, 20, 30, 0)); // 5 ago 2026, 20:30 local
    expect(hoy()).toBe("2026-08-05");
  });

  it("a las 11:59 p.m. sigue siendo el mismo día", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 5, 23, 59, 0));
    expect(hoy()).toBe("2026-08-05");
  });

  it("justo pasada la medianoche ya es el día siguiente", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 6, 0, 1, 0));
    expect(hoy()).toBe("2026-08-06");
  });

  it("diasAtras respeta la hora local por la noche", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 5, 22, 0, 0));
    expect(diasAtras(0)).toBe("2026-08-05");
    expect(diasAtras(7)).toBe("2026-07-29");
  });

  it("fechaLocalISO rellena mes y día con cero", () => {
    expect(fechaLocalISO(new Date(2026, 0, 3))).toBe("2026-01-03");
  });

  it("fechaMasDias cruza fin de mes y año", () => {
    expect(fechaMasDias("2026-01-31", 1)).toBe("2026-02-01");
    expect(fechaMasDias("2026-01-01", -1)).toBe("2025-12-31");
    expect(fechaMasDias("2024-02-28", 1)).toBe("2024-02-29"); // bisiesto
  });
});

describe("conversión de horas 12h / 24h", () => {
  it("medianoche es 12 a.m., no 0", () => {
    expect(a12Horas("00:00")).toEqual({ hora12: 12, minuto: 0, ampm: "AM" });
    expect(a24Horas(12, 0, "AM")).toBe("00:00");
  });

  it("mediodía es 12 p.m., no 0 ni 24", () => {
    expect(a12Horas("12:00")).toEqual({ hora12: 12, minuto: 0, ampm: "PM" });
    expect(a24Horas(12, 0, "PM")).toBe("12:00");
  });

  it("ida y vuelta no pierde información", () => {
    ["00:00", "07:30", "12:00", "13:10", "18:50", "23:40"].forEach((h) => {
      const { hora12, minuto, ampm } = a12Horas(h);
      expect(a24Horas(hora12, minuto, ampm)).toBe(h);
    });
  });

  it("horaLegible usa el formato local con a.m./p.m.", () => {
    expect(horaLegible("13:00")).toBe("1:00 p.m.");
    expect(horaLegible("08:05")).toBe("8:05 a.m.");
    expect(horaLegible("")).toBe("");
  });
});

describe("sumarMinutos y traslapes", () => {
  it("suma cruzando la hora", () => {
    expect(sumarMinutos("08:50", 20)).toBe("09:10");
  });
  it("da la vuelta al pasar de medianoche", () => {
    expect(sumarMinutos("23:30", 60)).toBe("00:30");
  });
  it("dos horarios que se tocan en el borde no se traslapan", () => {
    expect(seTraslapan("08:00", "09:00", "09:00", "10:00")).toBe(false);
  });
  it("detecta el solapamiento real", () => {
    expect(seTraslapan("08:00", "09:00", "08:30", "10:00")).toBe(true);
  });
});

describe("comprobantes con serie y número", () => {
  it("parte por el ÚLTIMO guion: la serie puede llevar guiones", () => {
    expect(partirComprobante("F001-123")).toEqual({ serie: "F001", numero: "123" });
    expect(partirComprobante("F-001-123")).toEqual({ serie: "F-001", numero: "123" });
  });
  it("sin guion, todo es número", () => {
    expect(partirComprobante("123")).toEqual({ serie: "", numero: "123" });
  });
  it("vacío no revienta", () => {
    expect(partirComprobante("")).toEqual({ serie: "", numero: "" });
    expect(unirComprobante("", "")).toBe("");
  });
  it("al mostrar no queda un guion suelto si falta una parte", () => {
    expect(mostrarComprobante("F001-")).toBe("F001");
    expect(mostrarComprobante("-123")).toBe("123");
    expect(mostrarComprobante("F001-123")).toBe("F001-123");
  });
  it("la serie siempre se guarda en mayúsculas", () => {
    expect(unirComprobante("f001", "123")).toBe("F001-123");
  });
});

describe("estandarización de texto", () => {
  it("capitaliza sin importar cómo se escribió", () => {
    expect(capitalizarPalabras("JUAN perez")).toBe("Juan Perez");
    expect(capitalizarPalabras("  av.   larco   123 ")).toBe("Av. Larco 123");
    expect(capitalizarPalabras("")).toBe("");
  });
  it("el celular no se capitaliza, solo se limpian espacios", () => {
    expect(limpiarCelular("  987   654 321 ")).toBe("987 654 321");
  });
});

describe("bandas horarias del mapa de calor", () => {
  it("una hora dentro de la jornada cae en su propia banda", () => {
    expect(bandaDeHora("14:30")).toBe(14);
  });
  it("antes de abrir se agrupa en la primera banda", () => {
    expect(bandaDeHora("06:00")).toBe(8);
  });
  it("después de cerrar se agrupa en la última banda", () => {
    expect(bandaDeHora("21:00")).toBe(17);
  });
  it("una hora inválida devuelve null", () => {
    expect(bandaDeHora("")).toBe(null);
    expect(bandaDeHora("nada")).toBe(null);
  });
});

describe("orden de despachos dentro de un horario", () => {
  it("manda el orden manual", () => {
    const items = [{ id: "b", orden: 1 }, { id: "a", orden: 0 }];
    expect(ordenarDespachos(items).map((d) => d.id)).toEqual(["a", "b"]);
  });
  it("con el mismo orden, desempata por fecha de creación", () => {
    const items = [
      { id: "nuevo", orden: 0, creadoEn: "2026-08-05T10:00:00Z" },
      { id: "viejo", orden: 0, creadoEn: "2026-08-05T09:00:00Z" },
    ];
    expect(ordenarDespachos(items).map((d) => d.id)).toEqual(["viejo", "nuevo"]);
  });
  it("no muta el array original", () => {
    const items = [{ id: "b", orden: 1 }, { id: "a", orden: 0 }];
    ordenarDespachos(items);
    expect(items[0].id).toBe("b");
  });
});

describe("detección de direcciones y links de Maps", () => {
  it("reconoce una URL", () => {
    expect(esLinkOCoordenadas("https://maps.app.goo.gl/abc")).toBe(true);
  });
  it("reconoce un par de coordenadas", () => {
    expect(esLinkOCoordenadas("-8.1116, -79.0288")).toBe(true);
    expect(convertirCoordenadasALink("-8.1116, -79.0288")).toBe("https://maps.google.com/maps?q=-8.1116,-79.0288");
  });
  it("una dirección normal no es un link", () => {
    expect(esLinkOCoordenadas("Av. Larco 123")).toBe(false);
  });
});
