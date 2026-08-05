# Pronort · Programación de despachos

App interna para programar los despachos diarios: horarios de salida, qué sale en cada uno
(ventas, compras y movimientos entre sedes) y la imagen que se manda por WhatsApp.

React + Vite en el navegador, Supabase para los datos y el acceso, Vercel para publicarla.

---

## Publicar un cambio

```
git add .
git commit -m "Describe aquí qué cambiaste"
git push
```

Vercel detecta el push y actualiza el link en 1-2 minutos. No hay que tocar nada allí: las
variables de entorno ya están puestas.

**Nunca uses `git push --force`.** El historial de git es la única red de seguridad que tienes:
si una versión sale con un error, con el historial intacto vuelves a la anterior con un comando.
Con `--force` ese historial se borra en cada publicación y esa vuelta atrás deja de ser posible.

Para deshacer una versión que salió mal:

```
git revert <código-del-commit>
git push
```

`git log --oneline` te da los códigos.

---

## Trabajar en local

Hace falta [Node.js](https://nodejs.org) **20.19 o superior** (o 22.12+). Lo exige Vite 7; con
Node 18 la instalación falla.

```
npm install
npm run dev
```

Necesitas un archivo `.env` en la raíz con tus credenciales de Supabase — copia `.env.example`
y rellénalo. Ese archivo nunca se sube al repositorio.

Antes de publicar, conviene correr:

```
npm run lint
npm test
npm run build
```

Son las tres cosas que GitHub Actions comprueba en cada push. Si alguna falla ahí, el aviso
te llega al commit.

---

## La base de datos

> **Pendiente de ejecutar una vez:** `supabase_migracion_v4_restricciones.sql`.
> Añade restricciones que impiden guardar valores imposibles (un estado inventado, un monto
> negativo, un horario que termina antes de empezar). Hasta ahora el único filtro era el
> formulario del navegador, y la app escribe con la clave pública: una llamada directa a la API
> se lo saltaba. Está escrito para no poder fallar sobre los datos que ya tienes.
> Supabase → **SQL Editor** → **New query** → pegar → **Run**.

Salvo eso, la base ya está creada — **no hay ningún otro script que correr**.

`supabase_esquema.sql` es el esquema de referencia: qué tablas hay, qué columnas, las claves
foráneas y —lo más importante— las políticas de seguridad (RLS). Está versionado a propósito:
toda la app habla con Supabase desde el navegador con la clave pública, así que **lo único que
impide que cualquiera lea o borre los datos son esas políticas**. Si no están en el repositorio,
no hay forma de revisarlas ni de notar que cambiaron.

Solo se ejecuta para levantar una base nueva y vacía (un ambiente de pruebas). Nunca sobre la
base en uso.

Si alguna vez cambias el esquema desde el panel de Supabase, **actualiza ese archivo en el mismo
commit**, o dejará de reflejar la realidad.

Para mirar los datos en crudo: Supabase → **Table Editor**.

---

## Acceso

La contraseña se pide **una sola vez por dispositivo**: la sesión queda guardada y se renueva sola.
Se vuelve a pedir solo si se borran los datos del navegador, se usa modo incógnito o se entra
desde otro dispositivo. Para salir a propósito está el botón de arriba a la derecha.

Las cuentas se crean a mano en Supabase → **Authentication** → **Users**.

> **Comprueba que el registro abierto esté desactivado.** Supabase → **Authentication** →
> **Sign In / Providers** → *Allow new users to sign up* debe estar **apagado**. Las políticas
> de la base dan lectura y escritura completas a cualquier usuario autenticado, así que si el
> alta libre estuviera activa, cualquiera podría crearse una cuenta desde fuera y tendría acceso
> total a los datos. Es una opción del panel de Supabase, no del código: desde aquí no se puede
> garantizar ni comprobar.

---

## Si algo falla

| Síntoma | Dónde mirar |
|---|---|
| "Correo o contraseña incorrectos" | Supabase → Authentication → Users: que el usuario exista y esté confirmado. |
| Cambiar una contraseña | Supabase → Authentication → Users → los tres puntos → *Reset password*. |
| La app carga pero no muestra datos | Ahora sale un aviso en pantalla con el motivo. Si dice "sin conexión", es red; si habla de la sesión, vuelve a entrar. |
| Falta un despacho antiguo | Al abrir solo se cargan los últimos 90 días. En Historial y en Reportes hay un botón para traer todo el histórico. |
| La pantalla se queda en blanco | No debería: hay una pantalla de error con botón de recargar. Si pasa igual, abre la consola del navegador (F12) y mándame lo que salga en rojo. |

---

## Cómo está organizado el código

Todo vive en `src/`:

| Archivo | Qué hace |
|---|---|
| `App.jsx` | Arma la app: pestañas, navegación y qué datos recibe cada vista. |
| `hooksDB.js` | **Todo el acceso a Supabase.** Si algo se guarda mal, empieza por aquí. |
| `constants.js` | Fechas, horas, tipos de despacho y qué campos usa cada tipo (`CONFIG_TIPO`). |
| `Vista*.jsx` | Una por pestaña: Calendario, Día, Historial, Reportes, Catálogos. |
| `Form*.jsx` | Los formularios de despacho y de horario. |
| `ui.jsx` | Piezas compartidas: modal, avisos, badges, pantalla de error. |
| `VistaExportable.jsx` | La imagen que se copia para WhatsApp. |
| `*.test.js(x)` | Pruebas. `npm test` las corre todas. |

Las decisiones que no son obvias están explicadas en comentarios dentro del propio código,
junto a la línea que las necesita.
