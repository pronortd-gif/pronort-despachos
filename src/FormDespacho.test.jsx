// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, act, cleanup } from "@testing-library/react";
import { FormDespacho } from "./FormDespacho";

// Sin esto, cada render() se queda montado en document.body y una
// consulta global como screen.getByLabelText encuentra el mismo campo
// repetido en el formulario de la prueba anterior.
afterEach(cleanup);

// Bugs reales encontrados al revisar los campos contra la base de datos:
// cambiar el tipo de despacho a medio llenar dejaba comprobante, cobro
// y dirección guardados en un despacho que ya no los usa ni los muestra,
// y destildar "se cobra" no borraba el monto. Ninguno de los dos se
// veía en pantalla — solo al mirar la fila cruda en Supabase.

const sedes = [
  { codigo: "P01", nombre: "Principal", linea: "DRYWALL" },
  { codigo: "P03", nombre: "Unión", linea: "DRYWALL" },
];
const bloques = [{ id: "b1", fecha: "2026-08-05", nombre: "", inicio: "08:00", fin: "09:00" }];
const catalogos = { cliente: [], proveedor: [], responsable: [], celular: [], direccion: [] };

const montar = (props) => render(
  <FormDespacho
    fecha="2026-08-05"
    bloques={bloques}
    sedes={sedes}
    catalogos={catalogos}
    todosDespachos={[]}
    conteoPorBloqueId={{}}
    oscuro={false}
    onCancelar={() => {}}
    onCrearHorario={() => {}}
    {...props}
  />
);

const elegirTipo = (nombre) => fireEvent.click(screen.getByRole("radio", { name: new RegExp(nombre, "i") }));
const tildarCobro = () => fireEvent.click(screen.getByLabelText("¿Se cobra en la entrega?"));
// Venta ahora exige sede además de cliente (ver describe de más abajo),
// así que casi toda prueba que espera un guardado exitoso necesita esto.
const elegirSede = (container, codigo) => fireEvent.change(container.querySelector("select"), { target: { value: codigo } });

describe("cambiar de tipo limpia lo que ese tipo no usa", () => {
  it("Venta → Movimiento: comprobante, cobro y dirección desaparecen del guardado", async () => {
    const onGuardar = vi.fn().mockResolvedValue("");
    const { container } = montar({ onGuardar });

    // Se llena como Venta: comprobante, cobro+monto y dirección.
    fireEvent.change(screen.getByLabelText("Cliente"), { target: { value: "Acme" } });
    fireEvent.change(container.querySelector("select"), { target: { value: "P01" } });
    tildarCobro();
    fireEvent.change(document.getElementById("input-monto"), { target: { value: "150" } });
    fireEvent.change(screen.getByLabelText("Dirección de entrega"), { target: { value: "Av. Larco 123" } });

    // Se cambia a Movimiento: no usa ninguno de esos tres campos.
    elegirTipo("Mov");
    fireEvent.change(screen.getAllByRole("combobox")[1], { target: { value: "P03" } }); // sede destino

    fireEvent.submit(container.querySelector("form"));
    await act(async () => {});

    expect(onGuardar).toHaveBeenCalledTimes(1);
    const guardado = onGuardar.mock.calls[0][0];
    expect(guardado.tipo).toBe("MOV_MERCADERIA");
    // Esto es lo que antes fallaba: quedaban guardados aunque el
    // formulario ya no los mostrara.
    expect(guardado.cobra).toBe(false);
    expect(guardado.monto).toBe("");
    expect(guardado.comprobante).toBe("");
    expect(guardado.direccion).toBe("");
  });

  it("Venta → Compra: el comprobante y la dirección se conservan (ambos los usan)", () => {
    const { container } = montar({ onGuardar: vi.fn() });
    fireEvent.change(screen.getByLabelText("Dirección de entrega"), { target: { value: "Av. Larco 123" } });
    elegirTipo("Compra");
    // Compra también usa dirección: no debería perderse solo por cambiar de tipo.
    expect(screen.getByLabelText("Dirección de recojo (opcional)").value).toBe("Av. Larco 123");
    void container;
  });

  it("Venta → Compra: el cobro sí se limpia (Compra nunca cobra en la entrega)", () => {
    montar({ onGuardar: vi.fn() });
    tildarCobro();
    fireEvent.change(document.getElementById("input-monto"), { target: { value: "80" } });
    elegirTipo("Compra");
    // El checkbox de cobro ni siquiera existe para Compra.
    expect(screen.queryByLabelText("¿Se cobra en la entrega?")).toBeNull();
    // Y si se vuelve a Venta, no debería reaparecer marcado con el monto viejo.
    elegirTipo("Venta");
    expect(screen.getByLabelText("¿Se cobra en la entrega?").checked).toBe(false);
  });
});

describe("Venta exige cliente y sede, igual que Compra y Movimiento", () => {
  // Antes bastaba con uno de los dos (cliente O sede), y una venta sin
  // sede quedaba fuera del reporte "Desempeño por sede" sin que nada lo
  // advirtiera al guardarla.
  it("sin sede no guarda, aunque el cliente esté puesto", async () => {
    const onGuardar = vi.fn();
    const { container } = montar({ onGuardar });
    fireEvent.change(screen.getByLabelText("Cliente"), { target: { value: "Acme" } });

    fireEvent.submit(container.querySelector("form"));
    await act(async () => {});

    expect(onGuardar).not.toHaveBeenCalled();
    expect(screen.getByText("Indica desde qué sede se despacha.")).toBeTruthy();
  });

  it("sin cliente no guarda, aunque la sede esté puesta", async () => {
    const onGuardar = vi.fn();
    const { container } = montar({ onGuardar });
    elegirSede(container, "P01");

    fireEvent.submit(container.querySelector("form"));
    await act(async () => {});

    expect(onGuardar).not.toHaveBeenCalled();
    expect(screen.getByText("Ingresa el cliente.")).toBeTruthy();
  });

  it("con ambos, guarda", async () => {
    const onGuardar = vi.fn().mockResolvedValue("");
    const { container } = montar({ onGuardar });
    fireEvent.change(screen.getByLabelText("Cliente"), { target: { value: "Acme" } });
    elegirSede(container, "P01");

    fireEvent.submit(container.querySelector("form"));
    await act(async () => {});

    expect(onGuardar).toHaveBeenCalledTimes(1);
  });
});

describe("destildar el cobro borra el monto", () => {
  it("no deja un monto guardado en un despacho que dice que no cobra", async () => {
    const onGuardar = vi.fn().mockResolvedValue("");
    const { container } = montar({ onGuardar });
    fireEvent.change(screen.getByLabelText("Cliente"), { target: { value: "Acme" } });
    elegirSede(container, "P01");

    tildarCobro();
    fireEvent.change(document.getElementById("input-monto"), { target: { value: "150" } });
    tildarCobro(); // destildar

    fireEvent.submit(container.querySelector("form"));
    await act(async () => {});

    const guardado = onGuardar.mock.calls[0][0];
    expect(guardado.cobra).toBe(false);
    expect(guardado.monto).toBe("");
  });
});

describe("validación del monto (antes noValidate la dejaba pasar)", () => {
  it("cobrar sin poner monto bloquea el guardado y avisa", async () => {
    const onGuardar = vi.fn();
    const { container } = montar({ onGuardar });
    fireEvent.change(screen.getByLabelText("Cliente"), { target: { value: "Acme" } });
    tildarCobro();
    // Monto queda vacío a propósito.

    fireEvent.submit(container.querySelector("form"));
    await act(async () => {});

    expect(onGuardar).not.toHaveBeenCalled();
    expect(screen.getByText("Ingresa cuánto se cobra.")).toBeTruthy();
  });

  it("un monto en 0 tampoco es válido cuando se marcó que sí cobra", async () => {
    const onGuardar = vi.fn();
    const { container } = montar({ onGuardar });
    fireEvent.change(screen.getByLabelText("Cliente"), { target: { value: "Acme" } });
    tildarCobro();
    fireEvent.change(document.getElementById("input-monto"), { target: { value: "0" } });

    fireEvent.submit(container.querySelector("form"));
    await act(async () => {});

    expect(onGuardar).not.toHaveBeenCalled();
  });

  it("con un monto válido sí guarda", async () => {
    const onGuardar = vi.fn().mockResolvedValue("");
    const { container } = montar({ onGuardar });
    fireEvent.change(screen.getByLabelText("Cliente"), { target: { value: "Acme" } });
    elegirSede(container, "P01");
    tildarCobro();
    fireEvent.change(document.getElementById("input-monto"), { target: { value: "45.50" } });

    fireEvent.submit(container.querySelector("form"));
    await act(async () => {});

    expect(onGuardar).toHaveBeenCalledTimes(1);
  });
});
