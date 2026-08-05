// Cálculo de las métricas personalizadas de Reportes.
// Vive aparte de la vista a propósito: es lógica pura sobre datos, así
// que se puede probar sin montar React ni tocar la base de datos.

export const OPERACIONES = {
  contar: "Contar registros",
  sumar: "Sumar monto",
  promediar: "Promediar monto",
  porcentaje: "% del total filtrado",
};

export const CAMPOS_FILTRO = {
  tipo: "Tipo",
  tienda: "Sede origen",
  sedeDestino: "Sede destino",
  cobra: "¿Se cobra?",
  estado: "Estado",
};

export function calcularMetrica(m, despachos) {
  let base = despachos;
  if (m.filtroCampo && m.filtroValor !== "" && m.filtroValor != null) {
    base = base.filter((d) => {
      if (m.filtroCampo === "cobra") return String(Boolean(d.cobra)) === m.filtroValor;
      return String(d[m.filtroCampo] || "") === m.filtroValor;
    });
  }
  if (m.operacion === "contar") return base.length;
  if (m.operacion === "sumar") return base.reduce((acc, d) => acc + (Number(d.monto) || 0), 0);
  if (m.operacion === "promediar") {
    const conMonto = base.filter((d) => d.monto !== "" && d.monto != null && !isNaN(Number(d.monto)));
    if (conMonto.length === 0) return 0;
    return conMonto.reduce((acc, d) => acc + Number(d.monto), 0) / conMonto.length;
  }
  if (m.operacion === "porcentaje") {
    if (despachos.length === 0) return 0;
    return (base.length / despachos.length) * 100;
  }
  return 0;
}

export function formatoMetrica(valor, operacion) {
  if (operacion === "sumar" || operacion === "promediar") return "S/ " + valor.toFixed(2);
  if (operacion === "porcentaje") return valor.toFixed(1) + "%";
  return String(Math.round(valor));
}
