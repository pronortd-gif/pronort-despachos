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

Hace falta [Node.js](https://nodejs.org) 18 o superior.

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

La base ya está creada y migrada en Supabase — no hay ningún script que correr para que la app
funcione. Si en el futuro hace falta cambiar el esquema (una columna nueva, una tabla), se agrega
un script SQL nuevo al repositorio y se corre una sola vez en supabase.com → **SQL Editor**.

Para mirar los datos en crudo: Supabase → **Table Editor**.

---

## Acceso

La contraseña se pide **una sola vez por dispositivo**: la sesión queda guardada y se renueva sola.
Se vuelve a pedir solo si se borran los datos del navegador, se usa modo incógnito o se entra
desde otro dispositivo. Para salir a propósito está el botón de arriba a la derecha.

No hay registro abierto: las cuentas se crean a mano en Supabase → **Authentication** → **Users**.

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
