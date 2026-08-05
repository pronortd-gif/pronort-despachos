import React, { useEffect, useRef } from "react";

export function Icon({ name, size }) {
  return <i className={"ti ti-" + name} style={{ fontSize: size || 16 }} aria-hidden="true" />;
}

export function Badge({ children, color, bg }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 500, padding: "2px 8px", borderRadius: 20, background: bg, color: color }}>
      {children}
    </span>
  );
}

export function LogoPronort({ alto }) {
  // El logo tiene fondo blanco propio, así que va sobre una tarjeta
  // blanca fija: se lee igual en modo claro y en oscuro.
  return (
    <div style={{ background: "#fff", borderRadius: 8, padding: "5px 10px", display: "inline-flex", alignItems: "center" }}>
      <img src="/logo-pronort.png" alt="Pronort" style={{ height: alto || 26, width: "auto", objectFit: "contain", display: "block" }} />
    </div>
  );
}

// Modal flotante: se fija sobre toda la pantalla (no empuja el
// contenido hacia abajo) y se puede desplazar internamente si el
// formulario es más alto que la pantalla.
const ESTADOS = {
  pendiente: { label: "Pendiente", icono: "clock", color: "var(--text-secondary)", bg: "var(--surface-1)" },
  entregado: { label: "Entregado", icono: "check", color: "var(--ok)", bg: "var(--ok-bg)" },
  no_entregado: { label: "No entregado", icono: "x", color: "var(--brand-accent)", bg: "var(--warn-bg)" },
};

// Selector explícito de estado (Pendiente / Entregado / No entregado).
// A propósito NO es un checkbox que alterna entre 2 valores: al ser
// una elección explícita de 3 opciones, evita que "marcar todo" o un
// clic accidental conviertan en "entregado" algo que en realidad no
// se llegó a entregar.
export function SelectorEstado({ estado, onCambiar, compacto }) {
  const actual = ESTADOS[estado] || ESTADOS.pendiente;

  if (compacto) {
    return (
      <select
        value={estado || "pendiente"}
        onChange={(e) => onCambiar(e.target.value)}
        aria-label="Estado del despacho"
        style={{ height: 30, fontSize: 12, color: actual.color, minWidth: 118 }}
      >
        {Object.keys(ESTADOS).map((k) => <option key={k} value={k}>{ESTADOS[k].label}</option>)}
      </select>
    );
  }

  return (
    <div role="radiogroup" aria-label="Estado del despacho" style={{ display: "flex", gap: 4 }}>
      {Object.keys(ESTADOS).map((k) => {
        const e = ESTADOS[k];
        const activo = (estado || "pendiente") === k;
        return (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={activo}
            title={e.label}
            onClick={() => onCambiar(k)}
            style={{
              width: 30, height: 30, padding: 0,
              borderColor: activo ? e.color : "var(--border)",
              background: activo ? e.bg : "var(--surface-2)",
              color: activo ? e.color : "var(--text-secondary)",
            }}
          >
            <Icon name={e.icono} size={14} />
          </button>
        );
      })}
    </div>
  );
}

// Banda de error. Se usa tanto para fallos de carga (con "Reintentar")
// como para fallos puntuales de guardado (con "Cerrar"). Antes estos
// errores no se mostraban en ningún lado: una consulta fallida se veía
// igual que "todavía no hay datos".
export function AvisoError({ mensaje, onReintentar, onCerrar }) {
  if (!mensaje) return null;
  return (
    <div role="alert" style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--warn-bg)", border: "1px solid var(--warn)", borderRadius: "var(--radius)", padding: "10px 12px", marginBottom: 14 }}>
      <Icon name="alert-triangle" size={16} />
      <span style={{ flex: 1, fontSize: 13, color: "var(--warn)" }}>{mensaje}</span>
      {onReintentar && (
        <button onClick={onReintentar} style={{ height: 30, fontSize: 12, padding: "0 10px" }}>
          <Icon name="refresh" size={13} /> Reintentar
        </button>
      )}
      {onCerrar && (
        <button onClick={onCerrar} aria-label="Cerrar aviso" style={{ width: 28, height: 28, padding: 0, border: "none", background: "transparent" }}>
          <Icon name="x" size={14} />
        </button>
      )}
    </div>
  );
}

const FOCALIZABLES = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Modal({ onClose, children, title, wide }) {
  const cajaRef = useRef(null);
  const tituloId = "modal-titulo";

  useEffect(() => {
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = original; };
  }, []);

  // Escape para cerrar y Tab que no se escapa del modal: sin esto, con
  // teclado se podía seguir tabulando hacia los controles de atrás,
  // que están tapados por el fondo oscuro y no se ven.
  useEffect(() => {
    const previo = document.activeElement;
    const primero = cajaRef.current && cajaRef.current.querySelector(FOCALIZABLES);
    if (primero) primero.focus();

    const alPulsar = (e) => {
      if (e.key === "Escape") { e.stopPropagation(); onClose(); return; }
      if (e.key !== "Tab" || !cajaRef.current) return;
      const focos = Array.prototype.slice.call(cajaRef.current.querySelectorAll(FOCALIZABLES));
      if (focos.length === 0) return;
      const ini = focos[0];
      const fin = focos[focos.length - 1];
      if (e.shiftKey && document.activeElement === ini) { e.preventDefault(); fin.focus(); }
      else if (!e.shiftKey && document.activeElement === fin) { e.preventDefault(); ini.focus(); }
    };

    document.addEventListener("keydown", alPulsar);
    return () => {
      document.removeEventListener("keydown", alPulsar);
      if (previo && previo.focus) previo.focus();
    };
  }, [onClose]);

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(0,0,0,0.5)",
        display: "flex", alignItems: "flex-start", justifyContent: "center",
        padding: "2rem 1rem", overflowY: "auto",
        animation: "modalFade 0.15s ease",
      }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        ref={cajaRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloId}
        style={{ background: "var(--surface-2)", borderRadius: 12, width: "100%", maxWidth: wide ? 620 : 500, border: "0.5px solid var(--border)", padding: "1.25rem", margin: "auto 0", animation: "modalPop 0.18s cubic-bezier(0.16, 1, 0.3, 1)" }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h3 id={tituloId} style={{ margin: 0 }}>{title}</h3>
          <button onClick={onClose} aria-label="Cerrar" style={{ width: 32, height: 32, padding: 0 }}><Icon name="x" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

// Una excepción de render dejaba la pantalla completamente en blanco,
// sin pista de qué pasó ni forma de salir salvo recargar a ciegas.
export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { fallo: null };
  }
  static getDerivedStateFromError(fallo) {
    return { fallo };
  }
  componentDidCatch(fallo, info) {
    console.error("[Pronort] Error no controlado:", fallo, info);
  }
  render() {
    if (!this.state.fallo) return this.props.children;
    return (
      <div className="app-shell" style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, textAlign: "center" }}>
        <LogoPronort alto={30} />
        <h2 style={{ margin: 0, fontSize: 18 }}>Algo se rompió en la aplicación</h2>
        <p style={{ margin: 0, fontSize: 13, color: "var(--text-secondary)", maxWidth: 420 }}>
          Tus datos están a salvo en el servidor: esto es un fallo de la pantalla, no de la información.
          Recarga para volver a entrar.
        </p>
        <button onClick={() => window.location.reload()} style={{ borderColor: "var(--brand-accent)", color: "var(--brand-accent)" }}>
          <Icon name="refresh" size={15} /> Recargar
        </button>
        <details style={{ fontSize: 11, color: "var(--text-muted)", maxWidth: 520 }}>
          <summary style={{ cursor: "pointer" }}>Detalle técnico</summary>
          <pre style={{ textAlign: "left", whiteSpace: "pre-wrap", overflowX: "auto" }}>{String(this.state.fallo && this.state.fallo.stack || this.state.fallo)}</pre>
        </details>
      </div>
    );
  }
}

export function ConfirmarEliminar({ titulo, detalle, onConfirm, onCancel }) {
  return (
    <div>
      <div style={{ background: "var(--surface-1)", borderRadius: "var(--radius)", padding: "0.75rem 1rem", marginBottom: 16, borderLeft: "3px solid var(--brand-accent)" }}>
        <p style={{ margin: 0, fontWeight: 500, fontSize: 14 }}>{titulo}</p>
        {detalle && <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--text-secondary)" }}>{detalle}</p>}
      </div>
      <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 16 }}>Esta acción se puede deshacer por unos segundos después de confirmar.</p>
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button onClick={onCancel}>Cancelar</button>
        <button style={{ borderColor: "var(--brand-accent)", color: "var(--brand-accent)" }} onClick={onConfirm}><Icon name="trash" size={14} /> Eliminar</button>
      </div>
    </div>
  );
}

export function ToastDeshacer({ mensaje, onDeshacer, onExpirar }) {
  useEffect(() => {
    const t = setTimeout(onExpirar, 6000);
    return () => clearTimeout(t);
  }, [onExpirar]);
  return (
    <div style={{ position: "sticky", bottom: 0, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, background: "var(--text-primary)", color: "var(--surface-0)", borderRadius: "var(--radius)", padding: "10px 14px", marginTop: 12, animation: "toastIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)" }}>
      <span style={{ fontSize: 13 }}>{mensaje}</span>
      <button onClick={onDeshacer} style={{ background: "transparent", border: "0.5px solid rgba(255,255,255,0.3)", color: "var(--surface-0)", height: 28, padding: "0 12px", fontSize: 13 }}>
        <Icon name="rotate" size={13} /> Deshacer
      </button>
    </div>
  );
}
