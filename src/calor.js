import { bandaDeHora, HORA_INICIO_JORNADA, HORA_FIN_JORNADA } from "./constants";

// Cálculo del mapa de calor de Reportes. Vive aparte de la vista porque
// es aritmética sobre datos: se puede probar sin montar React.
//
// Hay dos lecturas distintas del mismo tablero:
// - "salida": cuántos DESPACHOS salen en cada franja. Cada despacho cae
//   en una sola celda, así que las celdas se pueden sumar.
// - "ocupación": qué HORARIOS (carros) están trabajando en cada franja.
//   Un horario con 5 despachos ocupa el carro una vez, no 5.

// Bandas de hora que ocupa un horario completo, no solo su inicio. Si
// termina justo en punto (11:00) esa hora ya no cuenta como ocupada; si
// termina pasada en punto (11:30) sí se incluye.
export function bandasOcupadas(inicio, fin) {
  const [horaIni] = (inicio || "").split(":");
  const [horaFin, minFin] = (fin || "").split(":");
  const hi = Number(horaIni);
  const hf = Number(horaFin);
  const mf = Number(minFin);
  // Se comprueba que las partes EXISTAN, no solo que sean numéricas:
  // Number("") es 0, no NaN, así que un horario con la hora vacía se
  // colaba como si ocupara la franja de las 08:00.
  if (!horaIni || !horaFin || isNaN(hi) || isNaN(hf) || isNaN(mf)) return [];
  let ultimaHora = mf === 0 ? hf - 1 : hf;
  if (ultimaHora < hi) ultimaHora = hi;
  const desdeB = Math.max(HORA_INICIO_JORNADA, Math.min(hi, HORA_FIN_JORNADA - 1));
  const hastaB = Math.max(HORA_INICIO_JORNADA, Math.min(ultimaHora, HORA_FIN_JORNADA - 1));
  const lista = [];
  for (let h = desdeB; h <= hastaB; h++) lista.push(h);
  return lista;
}

export function calcularSalida(despachos, mapaHorarios, tipoFiltro) {
  const celdas = {};
  despachos.forEach((d) => {
    if (tipoFiltro && d.tipo !== tipoFiltro) return;
    if (!d.tienda) return;
    const bloque = mapaHorarios[d.bloqueId];
    if (!bloque) return;
    const banda = bandaDeHora(bloque.inicio);
    if (banda == null) return;
    celdas[banda + "|" + d.tienda] = (celdas[banda + "|" + d.tienda] || 0) + 1;
  });
  return celdas;
}

// Un horario que atiende a varias sedes aparece en la columna de cada
// una: para "¿está ocupada esta sede a esta hora?" es lo correcto. Pero
// entonces las celdas NO se pueden sumar para obtener un total, porque
// ese mismo carro se contaría una vez por sede. Por eso, además de las
// celdas, se devuelven los totales calculados sobre IDS DISTINTOS de
// horario.
export function calcularOcupacion(bloques, despachos, tipoFiltro) {
  const celdas = {};
  const horariosPorBanda = {};
  const horariosPorSede = {};
  const paresBandaHorario = new Set();

  bloques.forEach((b) => {
    const suyos = despachos.filter((d) => d.bloqueId === b.id && (!tipoFiltro || d.tipo === tipoFiltro));
    // Si se filtró por tipo y este horario no tiene despachos de ese
    // tipo, no aplica a la vista filtrada (aunque sí tenga otros).
    if (tipoFiltro && suyos.length === 0) return;
    const sedes = suyos.length > 0
      ? Array.from(new Set(suyos.map((d) => d.tienda).filter(Boolean)))
      : ["__vacio__"];
    const bandas = bandasOcupadas(b.inicio, b.fin);

    sedes.forEach((sede) => {
      if (!horariosPorSede[sede]) horariosPorSede[sede] = new Set();
      horariosPorSede[sede].add(b.id);
      bandas.forEach((h) => {
        celdas[h + "|" + sede] = (celdas[h + "|" + sede] || 0) + 1;
        if (!horariosPorBanda[h]) horariosPorBanda[h] = new Set();
        horariosPorBanda[h].add(b.id);
        paresBandaHorario.add(h + "|" + b.id);
      });
    });
  });

  const tamanos = (mapa) => {
    const r = {};
    Object.keys(mapa).forEach((k) => { r[k] = mapa[k].size; });
    return r;
  };
  return {
    celdas,
    porFila: tamanos(horariosPorBanda),
    porColumna: tamanos(horariosPorSede),
    general: paresBandaHorario.size,
  };
}

// Totales de la tabla. En "salida" se suman las celdas (cada despacho
// está en una sola). En "ocupación" vienen ya calculados sobre horarios
// distintos, porque sumar las celdas inflaría el total.
export function totalesDeSalida(celdas) {
  const porFila = {};
  const porColumna = {};
  let general = 0;
  Object.keys(celdas).forEach((clave) => {
    const [hora, sede] = clave.split("|");
    const v = celdas[clave];
    porFila[hora] = (porFila[hora] || 0) + v;
    porColumna[sede] = (porColumna[sede] || 0) + v;
    general += v;
  });
  return { porFila, porColumna, general };
}

// Franja horaria con más carga, para señalarla en vez de dejar que se
// busque comparando colores parecidos.
export function franjaConMasCarga(porFila) {
  const horas = Object.keys(porFila);
  if (horas.length === 0) return null;
  const mejor = horas.reduce((a, b) => (porFila[b] > porFila[a] ? b : a));
  return { hora: Number(mejor), total: porFila[mejor] };
}
