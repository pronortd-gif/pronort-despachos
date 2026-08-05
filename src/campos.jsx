import React, { useState, useEffect, useRef, useMemo } from "react";
import { uid, capitalizarPalabras, limpiarCelular } from "./constants";

export function useDeshacer() {
  const [pendiente, setPendiente] = useState(null);
  const disparar = (mensaje, deshacerFn) => setPendiente({ mensaje, deshacerFn, id: uid() });
  const limpiar = () => setPendiente(null);
  return { pendiente, disparar, limpiar };
}

// Campo de texto con sugerencias. El actualizador se llama
// "onCambiarValor" a propósito, para que nunca choque por nombre
// con variables locales ni con handlers nativos.
//
// "tipo" estandariza el valor al SALIR del campo (no mientras se
// escribe, para no interrumpir a medio tipeo): "nombre" capitaliza
// cada palabra (Juan Pérez, Av. Larco), "celular" solo limpia espacios
// de más. Así el catálogo de sugerencias no se llena de variantes del
// mismo valor por mayúsculas/minúsculas distintas.
export function CampoSugerido({ label, valor, onCambiarValor, sugerencias, placeholder, ariaLabel, ayuda, tipo }) {
  const [abierto, setAbierto] = useState(false);
  const wrapRef = useRef(null);

  const estandarizar = (texto) => {
    if (tipo === "nombre") return capitalizarPalabras(texto);
    if (tipo === "celular") return limpiarCelular(texto);
    return texto;
  };

  const filtradas = useMemo(() => {
    const q = (valor || "").toLowerCase().trim();
    const base = (sugerencias || []).filter((s) => s.toLowerCase() !== q);
    if (!q) return base.slice(0, 6);
    return base.filter((s) => s.toLowerCase().includes(q)).slice(0, 6);
  }, [valor, sugerencias]);

  useEffect(() => {
    function onDocClick(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setAbierto(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      {label ? <label className="campo-label">{label}</label> : null}
      <input
        style={{ width: "100%" }}
        value={valor}
        placeholder={placeholder}
        aria-label={ariaLabel || label}
        onChange={(e) => { onCambiarValor(e.target.value); setAbierto(true); }}
        onFocus={() => setAbierto(true)}
        onBlur={() => {
          const estandarizado = estandarizar(valor);
          if (estandarizado !== valor) onCambiarValor(estandarizado);
        }}
      />
      {ayuda && <p className="campo-ayuda">{ayuda}</p>}
      {abierto && filtradas.length > 0 && (
        <div style={{ position: "absolute", top: label ? "100%" : "calc(100% - 18px)", left: 0, right: 0, zIndex: 20, marginTop: 2, background: "var(--surface-2)", border: "0.5px solid var(--border-strong)", borderRadius: "var(--radius)", boxShadow: "0 8px 24px rgba(0,0,0,0.14)", maxHeight: 180, overflowY: "auto" }}>
          {filtradas.map((s) => (
            <div
              key={s}
              onMouseDown={(e) => { e.preventDefault(); onCambiarValor(s); setAbierto(false); }}
              style={{ padding: "8px 10px", fontSize: 13, cursor: "pointer" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-1)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              {s}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Campo de persona con su rol explicado. Se usa para que no se
// confunda "gestionado por" con "entregado por" en las compras.
// Siempre es un nombre propio, así que se capitaliza al salir del campo.
export function CampoPersona({ titulo, ayuda, icono, valor, onCambiarValor, sugerencias, color }) {
  return (
    <div className="persona-campo" style={color ? { borderLeftColor: color } : null}>
      <div className="titulo">
        <i className={"ti ti-" + icono} aria-hidden="true" style={{ color: color || "var(--brand-accent-2)" }} />
        {titulo}
      </div>
      <p className="campo-ayuda" style={{ margin: "0 0 8px" }}>{ayuda}</p>
      <CampoSugerido
        label=""
        valor={valor}
        onCambiarValor={onCambiarValor}
        sugerencias={sugerencias}
        placeholder="Nombre completo"
        ariaLabel={titulo}
        tipo="nombre"
      />
    </div>
  );
}
