export const BRAND = { rojo: "#BD0B3B", rojoOscuro: "#8A0829", azul: "#091F42", azulClaro: "#1B3A6B" };

export const TIPOS = {
  VENTA: { label: "Venta", color: BRAND.rojo, dark: "#FF6B8F", icono: "arrow-up-right" },
  COMPRA: { label: "Compra", color: BRAND.azul, dark: "#7FA8E8", icono: "arrow-down-left" },
  MOV_MERCADERIA: { label: "Mov. mercadería", color: "#854F0B", dark: "#EF9F27", icono: "arrows-exchange" },
};

// Colores por línea de negocio, para distinguir sedes de un vistazo.
export const COLOR_LINEA = {
  DRYWALL: { claro: "#091F42", oscuro: "#7FA8E8" },
  ADITIVOS: { claro: "#BD0B3B", oscuro: "#FF6B8F" },
  ALMACEN: { claro: "#854F0B", oscuro: "#EF9F27" },
  OTRO: { claro: "#5B6272", oscuro: "#A9AFC3" },
};
export function colorLinea(linea, oscuro) {
  const c = COLOR_LINEA[linea] || COLOR_LINEA.OTRO;
  return oscuro ? c.oscuro : c.claro;
}

export const DIAS_CORTOS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
export const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

export function hoy() { return new Date().toISOString().slice(0, 10); }
export function uid() { return Math.random().toString(36).slice(2, 10); }

export function formatFechaLarga(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return DIAS_CORTOS[dt.getDay()] + " " + String(d).padStart(2, "0") + " de " + MESES[m - 1];
}

export function diasAtras(n) {
  const dt = new Date();
  dt.setDate(dt.getDate() - n);
  return dt.toISOString().slice(0, 10);
}

export function fechaMasDias(iso, n) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d + n);
  return dt.getFullYear() + "-" + String(dt.getMonth() + 1).padStart(2, "0") + "-" + String(dt.getDate()).padStart(2, "0");
}

export function sumarMinutos(hora, minutos) {
  const [h, m] = hora.split(":").map(Number);
  const total = h * 60 + m + minutos;
  const hh = Math.floor((((total % 1440) + 1440) % 1440) / 60);
  const mm = ((total % 60) + 60) % 60;
  return String(hh).padStart(2, "0") + ":" + String(mm).padStart(2, "0");
}

export function seTraslapan(inicioA, finA, inicioB, finB) {
  return inicioA < finB && inicioB < finA;
}

// Etiqueta de un horario: si no tiene nombre, se identifica por su hora.
export function etiquetaBloque(bloque) {
  if (!bloque) return "—";
  return bloque.nombre ? bloque.nombre : bloque.inicio + "–" + bloque.fin;
}

// ---- Hora en formato 12h (para el selector de horario) ----
// Convierte "HH:MM" (24h, como se guarda) a { hora12, minuto, ampm }.
export function a12Horas(horaTexto) {
  const [h, m] = (horaTexto || "08:00").split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  let hora12 = h % 12;
  if (hora12 === 0) hora12 = 12;
  return { hora12, minuto: m || 0, ampm };
}
// Convierte { hora12, minuto, ampm } de vuelta a "HH:MM" (24h) para guardar.
export function a24Horas(hora12, minuto, ampm) {
  let h = Number(hora12) % 12;
  if (ampm === "PM") h += 12;
  return String(h).padStart(2, "0") + ":" + String(Number(minuto)).padStart(2, "0");
}
// Texto legible de una hora guardada, ej. "8:00 a.m."
export function horaLegible(horaTexto) {
  if (!horaTexto) return "";
  const { hora12, minuto, ampm } = a12Horas(horaTexto);
  return hora12 + ":" + String(minuto).padStart(2, "0") + " " + (ampm === "AM" ? "a.m." : "p.m.");
}

export const SEDES_DEFAULT = [
  { codigo: "P01", nombre: "DRYWALL PRINCIPAL", linea: "DRYWALL" },
  { codigo: "P03", nombre: "DRYWALL UNION", linea: "DRYWALL" },
  { codigo: "P05", nombre: "ADITIVOS PRINCIPAL", linea: "ADITIVOS" },
  { codigo: "P08", nombre: "ADITIVOS 2 TRUJILLO", linea: "ADITIVOS" },
  { codigo: "P09", nombre: "ALMACEN CJ", linea: "ALMACEN" },
];

export function sedeLabel(codigo, sedes) {
  if (!codigo) return "—";
  const s = (sedes || SEDES_DEFAULT).find((x) => x.codigo === codigo);
  return s ? s.codigo + " · " + s.nombre : codigo;
}
export function sedeLinea(codigo, sedes) {
  const s = (sedes || SEDES_DEFAULT).find((x) => x.codigo === codigo);
  return s ? s.linea : "OTRO";
}

export const CAMPOS_CATALOGO = ["cliente", "proveedor", "responsable", "celular", "direccion"];

// ---- Dirección / Google Maps ----
export function esLinkOCoordenadas(texto) {
  const t = (texto || "").trim();
  if (!t) return false;
  if (/^https?:\/\//i.test(t)) return true;
  if (/^-?\d{1,2}\.\d+\s*,\s*-?\d{1,3}\.\d+$/.test(t)) return true;
  return false;
}
export function convertirCoordenadasALink(texto) {
  const m = texto.trim().match(/^(-?\d{1,2}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)$/);
  if (m) return "https://maps.google.com/maps?q=" + m[1] + "," + m[2];
  return texto.trim();
}

// ---- Comprobante y guía: se guardan como "SERIE-NUMERO" ----
export function unirComprobante(serie, numero) {
  const s = (serie || "").trim().toUpperCase();
  const n = (numero || "").trim();
  if (!s && !n) return "";
  return s + "-" + n; // el guion se conserva siempre para no perder qué es qué
}
export function partirComprobante(texto) {
  const t = (texto || "").trim();
  if (!t) return { serie: "", numero: "" };
  const corte = t.lastIndexOf("-");
  if (corte === -1) return { serie: "", numero: t };
  return { serie: t.slice(0, corte).trim().toUpperCase(), numero: t.slice(corte + 1).trim() };
}
// Para mostrar: quita el guion suelto si falta una de las dos partes.
export function mostrarComprobante(texto) {
  const c = partirComprobante(texto);
  if (c.serie && c.numero) return c.serie + "-" + c.numero;
  return c.serie || c.numero || "";
}

export const CAPACIDAD_BLOQUE = 5;

// ---- Estandarización de texto al salir de un campo ----
// Nombres, direcciones: cada palabra capitalizada, sin importar cómo
// se haya escrito (mayúsculas, minúsculas, mezclado), para que el
// catálogo de sugerencias no se fragmente en variantes distintas de lo
// mismo (ej. "juan perez" y "Juan Perez" quedando como 2 entradas).
export function capitalizarPalabras(texto) {
  const limpio = (texto || "").trim().replace(/\s+/g, " ");
  if (!limpio) return "";
  return limpio
    .toLowerCase()
    .split(" ")
    .map((palabra) => (palabra ? palabra.charAt(0).toUpperCase() + palabra.slice(1) : palabra))
    .join(" ");
}

// Celular: no se capitaliza (es un número), solo se limpian espacios
// de más para que "987 654 321" y "987654321" no cuenten como
// sugerencias distintas por un espacio de sobra.
export function limpiarCelular(texto) {
  return (texto || "").trim().replace(/\s+/g, " ");
}

// ---- Bandas horarias fijas para el mapa de calor (08:00 a 18:00) ----
// Así el análisis no depende de que todos los días tengan los mismos
// horarios exactos: cada despacho cae en la banda de su hora de salida.
export const HORA_INICIO_JORNADA = 8;
export const HORA_FIN_JORNADA = 18;

export function bandasHorarias() {
  const bandas = [];
  for (let h = HORA_INICIO_JORNADA; h < HORA_FIN_JORNADA; h++) {
    bandas.push({
      hora: h,
      label: String(h).padStart(2, "0") + ":00–" + String(h + 1).padStart(2, "0") + ":00",
    });
  }
  return bandas;
}

// Devuelve la hora (entera) de la banda a la que pertenece un horario.
export function bandaDeHora(horaTexto) {
  if (!horaTexto) return null;
  const h = Number(String(horaTexto).split(":")[0]);
  if (isNaN(h)) return null;
  if (h < HORA_INICIO_JORNADA) return HORA_INICIO_JORNADA;
  if (h >= HORA_FIN_JORNADA) return HORA_FIN_JORNADA - 1;
  return h;
}

// ============================================
// Configuración de campos según el tipo de despacho.
// Venta, Compra y Movimiento no comparten la misma lógica:
// cambian los campos, sus nombres y qué es obligatorio.
// ============================================
export const CONFIG_TIPO = {
  VENTA: {
    sedeLabel: "Sede que despacha",
    sedeAyuda: "Desde qué sede sale la mercadería",
    usaCliente: true,
    usaProveedor: false,
    usaDestino: false,
    usaComprobante: true,
    usaCobro: true,
    usaDireccion: true,
    usaCelularPorPersona: false,
    celularJuntoA: "persona2", // el celular de contacto es del cliente/quien recepciona, no del responsable
    permiteCopiarPersona: true,
    persona1: { label: "Responsable", ayuda: "Quién gestiona la venta", icono: "user-check", catalogo: "responsable" },
    persona2: { label: "Recepcionado por", ayuda: "Quién recibe el pedido en destino (puede ser el mismo responsable)", icono: "truck-delivery", catalogo: "responsable" },
  },
  COMPRA: {
    sedeLabel: "Sede que recibe",
    sedeAyuda: "A qué sede llega la mercadería comprada",
    usaCliente: false,
    usaProveedor: true,
    usaDestino: false,
    usaComprobante: true,
    usaCobro: false,
    usaDireccion: true,
    usaCelularPorPersona: false,
    celularJuntoA: "titulo", // el celular de contacto es del proveedor (que ya es el título de la tarjeta)
    permiteCopiarPersona: true,
    persona1: { label: "Responsable", ayuda: "Quién hizo o autorizó este pedido de compra", icono: "user-check", catalogo: "responsable" },
    persona2: { label: "Recepcionado por", ayuda: "Quién trae o entrega la mercadería en la sede (puede ser el mismo responsable)", icono: "truck-delivery", catalogo: "responsable" },
  },
  MOV_MERCADERIA: {
    sedeLabel: "Sede origen",
    sedeAyuda: "Desde qué sede sale la mercadería",
    usaCliente: false,
    usaProveedor: false,
    usaDestino: true,
    usaComprobante: false,
    usaCobro: false,
    usaDireccion: false,
    usaCelularPorPersona: true,
    celularJuntoA: null,
    permiteCopiarPersona: false,
    persona1: { label: "Trasladado por", ayuda: "Quién lleva la mercadería", icono: "truck", catalogo: "responsable" },
    persona2: { label: "Recibe en destino", ayuda: "Quién la recibe en la sede de destino (opcional)", icono: "user-check", catalogo: "responsable" },
  },
};

// Texto principal que identifica a un despacho, según su tipo.
export function tituloDespacho(d, sedes) {
  if (d.tipo === "COMPRA") return d.proveedor || "Compra sin proveedor";
  if (d.tipo === "MOV_MERCADERIA") {
    const destino = d.sedeDestino ? sedeLabel(d.sedeDestino, sedes) : "destino sin definir";
    return "Hacia " + destino;
  }
  return d.cliente || "Venta sin cliente";
}

// Personas asociadas al despacho, con su etiqueta correcta según el tipo.
export function personasDespacho(d) {
  const cfg = CONFIG_TIPO[d.tipo] || CONFIG_TIPO.VENTA;
  const lista = [];
  if (cfg.persona1 && d.persona1) lista.push({ label: cfg.persona1.label, valor: d.persona1 });
  if (cfg.persona2 && d.persona2) lista.push({ label: cfg.persona2.label, valor: d.persona2 });
  return lista;
}

// Igual que personasDespacho, pero agrega el celular junto al nombre
// de la persona (o del título) a la que le corresponde según el tipo:
// - Venta: el celular es de "Recepcionado por" (el cliente lo contesta)
// - Compra: el celular va con el título (el proveedor)
// - Movimiento: cada persona ya tiene su propio celular (celular1/celular2)
export function personasConCelular(d) {
  const cfg = CONFIG_TIPO[d.tipo] || CONFIG_TIPO.VENTA;
  const lista = [];
  if (cfg.persona1 && d.persona1) {
    let texto = d.persona1;
    if (cfg.usaCelularPorPersona && d.celular1) texto += " · " + d.celular1;
    lista.push({ label: cfg.persona1.label, texto });
  }
  if (cfg.persona2 && d.persona2) {
    let texto = d.persona2;
    if (cfg.usaCelularPorPersona && d.celular2) texto += " · " + d.celular2;
    else if (cfg.celularJuntoA === "persona2" && d.celular) texto += " · " + d.celular;
    lista.push({ label: cfg.persona2.label, texto });
  }
  return lista;
}

// Título del despacho con el celular pegado, solo cuando ese tipo
// define que el celular va junto al título (hoy: Compra, con el proveedor).
export function tituloConCelular(d, sedes) {
  const cfg = CONFIG_TIPO[d.tipo] || CONFIG_TIPO.VENTA;
  const titulo = tituloDespacho(d, sedes);
  if (cfg.celularJuntoA === "titulo" && d.celular) return titulo + " · " + d.celular;
  return titulo;
}
