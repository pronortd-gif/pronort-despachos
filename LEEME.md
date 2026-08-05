# Pronort · Programación de despachos — v2.3

Guía de actualización. Sigue los pasos en orden.

---

## Aviso importante sobre este paquete

Al armar este zip encontré que, en el proyecto que tenías guardado, los
**nombres de los archivos no coincidían con su contenido** (parece que se
mezclaron al subirlos). Reconstruí cada archivo leyendo su código real y
comparándolo con tu base de datos actual, así que este zip es funcional y
compatible con lo que ya tienes en Supabase.

`supabase_setup.sql` en este zip está **actualizado al estado actual**
(incluye ya los cambios de `supabase_migracion.sql` y de
`supabase_migracion_v2.sql`). Úsalo solo si alguna vez necesitas levantar
una base de datos nueva desde cero -- no lo corras sobre tu base actual,
porque volvería a crear las tablas desde el inicio. Como tu base ya está
migrada y con datos, lo único que necesitas correr ahora es
`supabase_migracion_v2.sql` (si no lo hiciste todavía).

---

## Paso 0 — ¿Cuál script de Supabase corro?

- **Ya tienes datos cargados (tu caso):** corre `supabase_migracion_v2.sql` y `supabase_migracion_v3.sql` (Paso 1 de abajo, en ese orden si no los corriste antes). Ignora `supabase_setup.sql`.
- **Vas a montar una base de datos nueva y vacía** (otro cliente, ambiente de pruebas, etc.): corre únicamente `supabase_setup.sql` — ya incluye todo, no hace falta correr nada más después.

---

## Paso 1 — Actualizar la base de datos

1. Entra a tu proyecto en supabase.com
2. Menú izquierdo → **SQL Editor** → **New query**
3. Abre `supabase_migracion_v2.sql`, copia todo su contenido y pégalo
4. Click en **Run**

Debe decir "Success". Es seguro correrlo más de una vez.

Qué hace: agrega dos columnas nuevas (`celular_persona1`, `celular_persona2`) a la tabla `despachos`, usadas solo en Movimiento de mercadería. No borra ni modifica nada existente.

---

## Paso 2 — Subir el código

**La primera vez** (solo una vez en la vida del proyecto), abre una terminal dentro de la carpeta y corre:

```
git init
git add .
git commit -m "Estado inicial"
git branch -M main
git remote add origin https://github.com/TU-USUARIO/pronort-despachos.git
git push -u origin main
```

Cambia `TU-USUARIO` por tu usuario real de GitHub.

**De ahí en adelante**, para publicar cualquier cambio:

```
git add .
git commit -m "Describe aquí qué cambiaste"
git push
```

No borres la carpeta ni vuelvas a hacer `git init` en cada versión, y **no uses `git push --force`**.
El historial de git es la única red de seguridad que tienes: si una versión sale con un error, con el
historial intacto puedes volver a la anterior con un comando. Con `--force` ese historial se borra en
cada publicación y esa vuelta atrás deja de ser posible.

Vercel detecta el cambio solo y actualiza el link en 1-2 minutos; no hay que tocar nada ahí, las variables de entorno siguen siendo las mismas.

### Sobre el archivo de claves

Si tienes un `.txt` con la URL y la clave de Supabase dentro de la carpeta del proyecto, **sácalo de
ahí** y guárdalo en un gestor de contraseñas. El `.gitignore` ya bloquea los `.txt` para que no se
suban, pero lo seguro es que ese archivo no viva junto al código.

---

## Novedades de esta versión (2.3)

**Reordenar despachos dentro de un horario.** Botones subir/bajar en cada tarjeta, para cuando varios despachos salen juntos en el mismo carro/horario. El orden se respeta también en la imagen que se copia/descarga.

**Tercer estado: "No entregado".** Ya no es un checkbox de sí/no — es un selector explícito de 3 estados (Pendiente / Entregado / No entregado) en cada despacho. El botón "marcar todo" de un horario ya no toca los que estén en "No entregado", para no perder ese registro por accidente.

**Imagen exportada más prolija:**
- Las horas salen en formato 12h ("1:00 p.m." en vez de "13:00").
- Nombres y direcciones largas se cortan con "..." en vez de desbordar.
- La etiqueta de tipo ("Mov. mercadería") ahora cabe en 2 líneas en vez de ensanchar toda la fila.

**Mapa de calor visible desde el primer dato.** Antes, con pocos despachos registrados, casi no se notaba el color. Ahora cualquier franja con al menos un despacho ya se ve claramente, y la franja más usada se sigue distinguiendo aunque el volumen total crezca mucho.

## Novedades de la versión 2.2

**Horario en pasos de 10 minutos**, en formato 12h (a.m./p.m.).

**Celular junto al nombre correcto:** en Venta va con "Recepcionado por", en Compra con el proveedor, en Movimiento cada persona tiene el suyo — sin desbordar con nombres largos.

**Crear horario nuevo directo desde el formulario de despacho**, sin salir a "Nuevo horario de salida" primero.

## Novedades de la versión 2.1

**Horario de salida en formato 12h.** Antes se usaba el reloj nativo del celular (que en varios equipos se veía en formato 24h, 1 a 23). Ahora es un selector propio: hora (1-12), minutos libres y a.m./p.m., igual en cualquier dispositivo.

**Corregido: el "0" en el horario sin nombre.** No era un error del nombre — era el contador de despachos de ese horario, que empezaba en 0 y quedaba pegado al lado cuando no había nombre. Ahora se muestran por separado y con la palabra "despachos" al lado, para que no se confundan.

**Venta ahora tiene dos personas.** Antes solo pedía un "Responsable / recepción". Ahora separa **Responsable** (quién gestiona la venta) de **Recepcionado por** (quién recibe el pedido), igual que Compra.

**Compra: etiquetas más claras + botón "usar el mismo responsable".** "Gestionado por" y "Entregado por" ahora se llaman **Responsable** y **Recepcionado por**. Si es la misma persona, un botón copia el valor automáticamente en vez de escribirlo dos veces.

**Movimiento de mercadería: un celular por persona.** Antes había un solo "Celular de contacto" compartido. Ahora hay dos campos: uno para quien traslada y otro para quien recibe en destino.

**Modal flotante en toda la app.** Antes las ventanas de "Nuevo despacho", "Nuevo horario", "Nueva sede", etc. se abrían empujando el contenido hacia abajo (había que bajar para verlas). Ahora aparecen flotando sobre la pantalla, como una ventana emergente normal, en cualquier parte de la app.

---

## Sobre la sesión

La contraseña se pide **una sola vez por dispositivo**. La sesión queda guardada y se renueva sola.

Solo se vuelve a pedir si:
- se borran los datos/cookies del navegador
- se usa modo incógnito
- se entra desde otro dispositivo

Para salir a propósito, está el botón de salida arriba a la derecha.

---

## Si algo falla

- **"Correo o contraseña incorrectos"**: revisa en Supabase → Authentication → Users que el usuario exista y esté confirmado.
- **La app carga pero no muestra datos**: puede que el script de migración no se haya ejecutado. Vuelve al Paso 1.
- **Los celulares de Movimiento no se guardan**: confirma que corriste `supabase_migracion_v2.sql`.
- **Quieres cambiar una contraseña**: Supabase → Authentication → Users → los tres puntos del usuario → Reset password.
- **Ver los datos crudos**: Supabase → Table Editor.
