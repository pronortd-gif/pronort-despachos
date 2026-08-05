import { diasAtras, hoy } from "./constants";

// Ventanas de fechas de los rangos de Reportes.
//
// Un rango de N días que INCLUYE hoy empieza en diasAtras(N-1), no en
// diasAtras(N). Antes se usaba diasAtras(N) y sin límite superior, así
// que "Última semana" abarcaba 8 fechas y "Último mes" 31 — y encima se
// comparaban contra periodos anteriores de 7 y 30 días exactos, con lo
// que el día de más inflaba siempre el porcentaje de variación.
//
// El límite superior en hoy() también importa: sin él, los despachos ya
// programados para los próximos días entraban en "Último mes", que es un
// rango retrospectivo.

export function rangoDeDias(dias) {
  return { desde: diasAtras(dias - 1), hasta: hoy() };
}

// El bloque de N días inmediatamente anterior, del mismo tamaño y sin
// solaparse con el actual.
export function rangoAnterior(dias) {
  return { desde: diasAtras(dias * 2 - 1), hasta: diasAtras(dias) };
}

export function dentro(fecha, rango) {
  return fecha >= rango.desde && fecha <= rango.hasta;
}
