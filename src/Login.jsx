import React, { useState } from "react";
import { supabase } from "./supabaseClient";
import { Icon, LogoPronort } from "./ui";

export function Login() {
  const [correo, setCorreo] = useState("");
  const [clave, setClave] = useState("");
  const [error, setError] = useState("");
  const [entrando, setEntrando] = useState(false);

  const entrar = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    setError("");
    if (!correo.trim() || !clave) { setError("Ingresa tu correo y contraseña."); return; }
    setEntrando(true);
    const { error: err } = await supabase.auth.signInWithPassword({ email: correo.trim(), password: clave });
    setEntrando(false);
    if (err) {
      setError(
        err.message && err.message.toLowerCase().includes("invalid")
          ? "Correo o contraseña incorrectos."
          : "No se pudo iniciar sesión. Revisa tu conexión."
      );
    }
  };

  return (
    <div className="login-wrap">
      {/* <form> de verdad: así Enter envía sin handlers a mano y el
          gestor de contraseñas reconoce el par usuario/clave. */}
      <form className="login-card" onSubmit={entrar} noValidate>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 18 }}>
          <LogoPronort alto={30} />
        </div>
        <h2 style={{ margin: "0 0 4px", fontSize: 18, textAlign: "center" }}>Programación de despachos</h2>
        <p style={{ margin: "0 0 20px", fontSize: 13, color: "var(--text-secondary)", textAlign: "center" }}>
          Ingresa una sola vez: la sesión queda guardada en este dispositivo.
        </p>

        <div style={{ marginBottom: 12 }}>
          <label className="campo-label" htmlFor="correo">Correo</label>
          <input
            id="correo" name="correo" type="email" autoComplete="username" style={{ width: "100%" }}
            value={correo} onChange={(e) => setCorreo(e.target.value)}
            placeholder="tucorreo@empresa.com"
          />
        </div>

        <div style={{ marginBottom: 18 }}>
          <label className="campo-label" htmlFor="clave">Contraseña</label>
          <input
            id="clave" name="clave" type="password" autoComplete="current-password" style={{ width: "100%" }}
            value={clave} onChange={(e) => setClave(e.target.value)}
          />
        </div>

        {error && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--warn-bg)", borderRadius: "var(--radius)", padding: "8px 10px", marginBottom: 14 }}>
            <Icon name="alert-triangle" size={14} />
            <span style={{ fontSize: 12, color: "var(--warn)" }}>{error}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={entrando}
          style={{ width: "100%", borderColor: "var(--brand-accent)", color: "var(--brand-accent)" }}
        >
          <Icon name="login" size={15} /> {entrando ? "Entrando..." : "Entrar"}
        </button>

        <p className="campo-ayuda" style={{ textAlign: "center", marginTop: 14 }}>
          Si olvidaste tu contraseña, pídele a quien administra la app que la restablezca.
        </p>
      </form>
    </div>
  );
}
