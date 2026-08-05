// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, act } from "@testing-library/react";
import { TarjetaDespacho } from "./TarjetaDespacho";

// Las animaciones son CSS, pero QUÉ animación se aplica y CUÁNDO lo
// decide React. Eso es lo que se comprueba aquí: que el escalonado use
// el índice, que esté topado, y que el halo de confirmación aparezca al
// cambiar de estado y se apague solo.

const base = {
  id: "d1", tipo: "VENTA", fecha: "2026-08-05", tienda: "P01",
  cliente: "Acme", persona1: "Ana", persona2: "", estado: "pendiente",
  orden: 0, celular: "", comprobante: "", numGuia: "", direccion: "", mapsUrl: "",
};
const props = {
  onEditar: () => {}, onEliminar: () => {}, onCambiarEstado: () => {},
  onSubir: () => {}, onBajar: () => {}, sedes: [{ codigo: "P01", nombre: "Principal", linea: "DRYWALL" }],
};

const tarjeta = (c) => c.querySelector(".card-in");
const estilo = (c) => tarjeta(c).getAttribute("style") || "";

afterEach(() => { vi.useRealTimers(); });

describe("entrada escalonada de las tarjetas", () => {
  it("la primera tarjeta no espera", () => {
    const { container } = render(<TarjetaDespacho despacho={base} indice={0} {...props} />);
    expect(estilo(container)).toMatch(/animation-delay:\s*0ms/);
  });

  it("cada tarjeta entra un poco después de la anterior", () => {
    const { container } = render(<TarjetaDespacho despacho={base} indice={3} {...props} />);
    expect(estilo(container)).toMatch(/animation-delay:\s*84ms/); // 3 × 28
  });

  it("el retardo está topado: un horario largo no tarda una eternidad", () => {
    const { container } = render(<TarjetaDespacho despacho={base} indice={40} {...props} />);
    // Tope en 8 escalones = 224ms, no 40 × 28 = 1120ms.
    expect(estilo(container)).toMatch(/animation-delay:\s*224ms/);
  });

  it("sin índice no revienta", () => {
    const { container } = render(<TarjetaDespacho despacho={base} {...props} />);
    expect(estilo(container)).toMatch(/animation-delay:\s*0ms/);
  });
});

describe("confirmación visual al cambiar de estado", () => {
  it("al montarse no destella: solo confirma cambios reales", () => {
    const { container } = render(<TarjetaDespacho despacho={base} indice={0} {...props} />);
    expect(estilo(container)).toContain("transparent");
  });

  it("marcar como entregado enciende el halo verde y luego se apaga solo", () => {
    vi.useFakeTimers();
    const { container, rerender } = render(<TarjetaDespacho despacho={base} indice={0} {...props} />);
    expect(estilo(container)).toContain("transparent");

    act(() => {
      rerender(<TarjetaDespacho despacho={{ ...base, estado: "entregado" }} indice={0} {...props} />);
    });
    expect(estilo(container)).toContain("--ok");
    expect(estilo(container)).not.toContain("transparent");

    act(() => { vi.advanceTimersByTime(600); });
    expect(estilo(container)).toContain("transparent");
  });

  it("marcar como no entregado usa el color de alerta, no el verde", () => {
    vi.useFakeTimers();
    const { container, rerender } = render(<TarjetaDespacho despacho={base} indice={0} {...props} />);
    act(() => {
      rerender(<TarjetaDespacho despacho={{ ...base, estado: "no_entregado" }} indice={0} {...props} />);
    });
    expect(estilo(container)).toContain("--brand-accent");
    expect(estilo(container)).not.toContain("--ok");
  });

  it("volver a renderizar sin cambiar el estado no vuelve a destellar", () => {
    vi.useFakeTimers();
    const { container, rerender } = render(<TarjetaDespacho despacho={base} indice={0} {...props} />);
    act(() => {
      rerender(<TarjetaDespacho despacho={{ ...base, tienda: "P05" }} indice={0} {...props} />);
    });
    expect(estilo(container)).toContain("transparent");
  });

  // React avisaba de que mezclar el atajo "border" con "borderLeft"
  // puede hacer que el atajo pise al borde izquierdo al re-renderizar.
  // Ese borde es el que lleva el color del tipo de despacho, así que
  // perderlo se nota: la tarjeta deja de decir de un vistazo si es
  // venta, compra o movimiento.
  it("el borde de color del tipo sobrevive a un re-render", () => {
    const { container, rerender } = render(<TarjetaDespacho despacho={base} indice={0} {...props} />);
    rerender(<TarjetaDespacho despacho={{ ...base, estado: "entregado" }} indice={0} {...props} />);
    const el = tarjeta(container);
    expect(el.style.borderLeftWidth).toBe("3px");
    expect(el.getAttribute("style")).not.toMatch(/(^|;)\s*border:/);
  });

  it("el halo no pisa la animación de entrada: usa outline, no animation", () => {
    vi.useFakeTimers();
    const { container, rerender } = render(<TarjetaDespacho despacho={base} indice={2} {...props} />);
    act(() => {
      rerender(<TarjetaDespacho despacho={{ ...base, estado: "entregado" }} indice={2} {...props} />);
    });
    // El retardo de entrada sigue intacto mientras el halo está encendido.
    expect(estilo(container)).toMatch(/animation-delay:\s*56ms/);
    expect(estilo(container)).toContain("outline");
  });
});
