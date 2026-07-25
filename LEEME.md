# Pronort · Programación de despachos — Guía de instalación

Sigue estos pasos en orden. No te saltes ninguno.

## Paso 1 — Crear las tablas en Supabase

1. Entra a tu proyecto en supabase.com
2. En el menú izquierdo, click en **SQL Editor**
3. Click en **New query**
4. Abre el archivo `supabase_setup.sql` (está junto a esta guía), copia TODO su contenido, y pégalo ahí
5. Click en **Run** (o Ctrl+Enter)
6. Debe decir "Success. No rows returned" — eso significa que las tablas ya existen

## Paso 2 — Conseguir tus claves de Supabase

1. En Supabase, ve a **Project Settings** (ícono de engranaje) → **API**
2. Copia dos valores, los vas a necesitar en el Paso 4:
   - **Project URL** (algo como `https://abcxyz.supabase.co`)
   - **anon public** key (una clave larga de letras y números)

## Paso 3 — Subir el proyecto a GitHub

Necesitas tener [Git instalado](https://git-scm.com/downloads) y una cuenta en [github.com](https://github.com).

1. Crea un repositorio nuevo en GitHub (botón verde "New"), llámalo `pronort-despachos`, y déjalo **vacío** (sin README, sin .gitignore)
2. Abre una terminal en la carpeta de este proyecto (`pronort-app`) y corre, uno por uno:

```bash
git init
git add .
git commit -m "Primera version"
git branch -M main
git remote add origin https://github.com/TU-USUARIO/pronort-despachos.git
git push -u origin main
```

(Cambia `TU-USUARIO` por tu usuario real de GitHub — Git te pedirá iniciar sesión la primera vez)

## Paso 4 — Desplegar en Vercel

1. Entra a vercel.com y click en **Add New → Project**
2. Elige **Import** junto al repositorio `pronort-despachos` que acabas de subir
3. Antes de darle a "Deploy", abre la sección **Environment Variables** y agrega dos:

| Name | Value |
|---|---|
| `VITE_SUPABASE_URL` | (la Project URL que copiaste en el Paso 2) |
| `VITE_SUPABASE_ANON_KEY` | (la clave anon public que copiaste en el Paso 2) |

4. Click en **Deploy**
5. Espera 1-2 minutos. Al terminar, Vercel te da un link tipo `pronort-despachos.vercel.app` — ese es tu link final

## Paso 5 — Usarlo

- Abre ese link en tu celular y en tu PC
- En el celular: en el navegador, busca la opción "Agregar a pantalla de inicio" (Chrome: menú de 3 puntos → "Agregar a pantalla principal") para que quede como ícono de app
- Comparte el mismo link con tu compañero — ambos van a ver y editar los mismos datos en tiempo real, porque todo vive en Supabase

## Si algo falla

- **La app carga pero no muestra nada / error de conexión**: revisa que las dos variables de entorno en Vercel estén escritas exactamente como en la tabla de arriba, sin espacios de más. Después de corregir, en Vercel ve a **Deployments** → los tres puntos del último deploy → **Redeploy**.
- **Quieres cambiar algo del código**: edítalo en tu computadora, luego `git add .`, `git commit -m "cambio"`, `git push` — Vercel actualiza el link solo, automáticamente, en un par de minutos.
- **Quieres ver los datos crudos**: en Supabase, click en **Table Editor** en el menú izquierdo — ahí ves y puedes editar directamente cada tabla si alguna vez lo necesitas.
