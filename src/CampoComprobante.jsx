import React, { useState } from "react";
import { partirComprobante, unirComprobante } from "./constants";

// Serie y número se mantienen en estado PROPIO del componente.
// Si se recalcularan desde el texto guardado en cada tecla, un valor
// intermedio como "F" sería ambiguo (no se sabe si es serie o número)
// y lo escrito saltaría de un recuadro al otro.
function ParDocumento({ titulo, valor, onCambiarValor, ejemploSerie, ayuda }) {
  const inicial = partirComprobante(valor);
  const [serie, setSerie] = useState(inicial.serie);
  const [numero, setNumero] = useState(inicial.numero);

  const cambiarSerie = (v) => {
    const limpio = v.toUpperCase();
    setSerie(limpio);
    onCambiarValor(unirComprobante(limpio, numero));
  };
  const cambiarNumero = (v) => {
    setNumero(v);
    onCambiarValor(unirComprobante(serie, v));
  };

  return (
    <div>
      <label className="campo-label">{titulo}</label>
      <div className="form-grid form-grid-comprobante">
        <input
          value={serie}
          onChange={(e) => cambiarSerie(e.target.value)}
          placeholder={"Serie (ej. " + ejemploSerie + ")"}
          aria-label={"Serie de " + titulo}
          style={{ textTransform: "uppercase" }}
        />
        <input
          value={numero}
          onChange={(e) => cambiarNumero(e.target.value)}
          placeholder="Número"
          aria-label={"Número de " + titulo}
          inputMode="numeric"
        />
      </div>
      {ayuda && <p className="campo-ayuda">{ayuda}</p>}
    </div>
  );
}

export function CampoComprobante({ valorComprobante, onCambiarComprobante, valorGuia, onCambiarGuia }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <ParDocumento
        titulo="Comprobante"
        valor={valorComprobante}
        onCambiarValor={onCambiarComprobante}
        ejemploSerie="F001"
        ayuda="La serie no depende de la sede seleccionada."
      />
      <ParDocumento
        titulo="Guía (opcional)"
        valor={valorGuia}
        onCambiarValor={onCambiarGuia}
        ejemploSerie="FV01"
      />
    </div>
  );
}
