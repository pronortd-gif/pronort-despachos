import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    // La sesión queda guardada en el navegador y se renueva sola.
    // Solo se vuelve a pedir la contraseña si se borran los datos del
    // navegador, se usa modo incógnito o se cambia de dispositivo.
    persistSession: true,
    autoRefreshToken: true,
    storage: window.localStorage,
    storageKey: "pronort-sesion",
  },
});
