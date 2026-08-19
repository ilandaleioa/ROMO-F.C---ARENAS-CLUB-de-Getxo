# ROMO FC - ARENAS Club de Getxo

Web app interna para consultar las plantillas de jugadores del club, leyendo los datos desde Supabase y sincronizando con Google Sheets en ambos sentidos cuando la configuracion esta completa. La app mantiene los datos de la web y de la hoja alineados mediante el backend, con control de acceso por roles.

## Estructura del proyecto

```
backend/     API en Node.js + Express (usa la service_role key de Supabase)
frontend/    SPA en React + Vite + Tailwind
```

## Roles

| Rol            | Equipos que ve | Columnas sensibles | Gestion de usuarios |
|----------------|----------------|---------------------|----------------------|
| Administrador  | Todos          | Si                  | Si                   |
| Responsable    | Todos          | Si                  | No                   |
| Tecnico        | Solo el suyo   | No (filtradas en backend) | No             |

Columnas sensibles (nunca llegan al frontend si el rol es Tecnico): `dni_jugador`, `domicilio`, `numero`, `piso_letra`, `dni_aita`, `dni_ama`, `telefono_aita`, `telefono_ama`, `email_aita`, `email_ama`, `dni_aceptante`.

## Requisitos previos

- Node.js 18 o superior
- Un proyecto de Supabase con las tablas `jugadores`, `personal` y `usuarios` ya creadas (RLS activo, sin politicas publicas)
- La tabla `usuarios` necesita al menos: `id`, `username`, `password_hash`, `rol`, `equipo_asignado`, `apartados_visibles`, `activo` (booleano, opcional pero recomendado para poder desactivar usuarios sin borrarlos)
- Si no existe aun, crea `apartados_visibles` como `text` con valor por defecto `Todos`.
- Si la tabla ya existia antes de añadir esta funcion, ejecuta `backend/scripts/migrar-usuarios-apartados.sql` en el editor SQL de Supabase.
- Mientras esa migracion no este aplicada, la pantalla de usuarios seguira permitiendo editar el resto de campos, pero no podra guardar `apartados_visibles`.
- La tabla `personal` necesita al menos: `id`, `club`, `nombre`, `primer_apellido`, `segundo_apellido`, `telefono`, `email`, `cargo`, `equipo`, `foto_path`
- `creado_en` y `actualizado_en` son opcionales; si existen en tu tabla, se seguirán guardando, pero el backend ya no depende de ellos para crear o listar personal.

La tabla `competiciones` se crea ejecutando `backend/scripts/crear-tabla-competiciones.sql` en el editor SQL de Supabase. Contiene los datos de la competición (`nombre`, `tipo`, `partes`, `minutos_por_parte`, `total_minutos`, `equipos_anadidos`), los datos federativos (`equipo_interno`, `equipo_fed`, `etapa`, `categoria`, `url`) y el campo técnico `club` para separar ROMO y ARENAS. El apartado **Competiciones** queda disponible para administradores y directores.

## Backend

### Variables de entorno (`backend/.env`)

Copia `backend/.env.example` a `backend/.env` y rellena:

```
SUPABASE_URL=https://TU_PROYECTO.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...           # NUNCA la subas a git ni la expongas al frontend
SESSION_SECRET=una-cadena-larga-y-aleatoria
SESSION_COOKIE_NAME=romofc_session
PORT=4000
FRONTEND_ORIGIN=http://localhost:5173
NODE_ENV=development                    # "production" activa cookies "secure" (requiere HTTPS)
GOOGLE_SHEETS_SPREADSHEET_ID=...        # ROMO
GOOGLE_SHEETS_GID=...
GOOGLE_SHEETS_SPREADSHEET_ID_ARENAS=... # ARENAS
GOOGLE_SHEETS_GID_ARENAS=...
GOOGLE_SERVICE_ACCOUNT_EMAIL=...
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY=...
```

### Instalacion y arranque

```bash
cd backend
npm install
npm run dev      # o "npm start" para produccion
```

El backend queda escuchando en `http://localhost:4000` (o el puerto que definas). Ruta de comprobacion: `GET /api/health`.
Si abres `http://localhost:4000/` en el navegador, te redirige al frontend.
La sincronizacion desde Google Sheets se hace por club. Si ARENAS no muestra jugadores, revisa que `GOOGLE_SHEETS_SPREADSHEET_ID_ARENAS`, `GOOGLE_SHEETS_GID_ARENAS` y la service account esten configurados en `backend/.env`.

### Despliegue en Vercel

Si el frontend y el backend se despliegan en Vercel, configura estas variables en el proyecto que ejecuta el backend:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SESSION_SECRET`
- `FRONTEND_ORIGIN` con la URL publica del frontend

Si falta `FRONTEND_ORIGIN`, el backend acepta orígenes de `*.vercel.app` y `localhost`, pero es mejor dejarlo fijado para evitar bloqueos de CORS en producción.

### Crear el primer usuario Administrador

La tabla `usuarios` no se rellena automaticamente: usa el script incluido para dar de alta (o resetear la contrasena de) un usuario:

```bash
cd backend
node scripts/crear-usuario.js <username> <password> administrador
node scripts/crear-usuario.js <username> <password> responsable
node scripts/crear-usuario.js <username> <password> tecnico "NOMBRE EXACTO DEL EQUIPO"
```

La contrasena se guarda siempre hasheada con bcrypt, nunca en texto plano.

El campo `apartados_visibles` usa el mismo formato que `equipo_asignado`: guarda `Todos` para dar acceso completo o una lista separada por `||` con apartados como `inicio`, `graficas`, `campogramas`, `captacion`, `personal`, `usuarios`, `listas`, `clubes_maestros` y `hojas_calculo`.

### Crear el bucket de fotos del personal

```bash
cd backend
node scripts/crear-bucket-personal-fotos.js
```

Las fotos del personal se guardan en el bucket privado `personal-fotos` y se sirven mediante URLs firmadas temporales, igual que las de jugadores.

### Crear la tabla de personal

Ejecuta el SQL incluido en `backend/scripts/crear-tabla-personal.sql` en el editor SQL de Supabase para crear la tabla `personal` con sus indices básicos.

## Frontend

### Variables de entorno (`frontend/.env`)

Copia `frontend/.env.example` a `frontend/.env`:

```
VITE_API_URL=/api
```

En desarrollo, `frontend/vite.config.js` reenvia `/api` al backend en `http://localhost:4000`.

### Instalacion y arranque

```bash
cd frontend
npm install
npm run dev
```

La app queda disponible en `http://localhost:5173`. En local, esa es la URL que debes abrir para ver la interfaz.

### Escudo del club

Sube tu escudo real a `frontend/public/assets/escudo.png` o sustituye los archivos `escudo-romo.png` y `escudo-arenas.png` por los logos oficiales; el hueco ya esta reservado en la cabecera y en la pantalla de login.

## Seguridad

- La `service_role key` de Supabase vive solo en `backend/.env` y solo se usa en el backend. Nunca llega al bundle del frontend.
- La sesion es un JWT propio (no Supabase Auth) firmado con `SESSION_SECRET`, guardado en una cookie `httpOnly`, `sameSite=lax` y `secure` en produccion.
- Todos los endpoints revalidan el rol en el backend (`requireAuth` + `requireRole`), sin confiar en lo que oculte el frontend.
- El filtrado de columnas sensibles para el rol Tecnico se hace en el backend antes de responder (whitelist explicita de columnas + saneado de cada fila), nunca solo oculto en la interfaz.
- Las contrasenas se hashean con bcrypt (coste 12).
- Si compartes credenciales de Supabase o de la app en un chat, canal o repositorio, rotalas: se deben tratar como secretos.

## Notas

- El boton "Actualizar datos" de la pantalla Plantillas solo vuelve a consultar Supabase.
- El boton "Sincronizar Google Sheets" de Plantillas y el boton "Sincronizar ahora" de Hojas de calculo lanzan la sincronizacion bidireccional entre Supabase y Google Sheets.
- La sincronizacion calcula una huella de todos los campos de la fila, no solo del nombre y el equipo. Los cambios hechos en Google Sheets se aplican a Supabase y los cambios hechos en la web/Supabase se devuelven a la hoja.
- Si se edita el mismo jugador en los dos sitios antes de pulsar el boton, Google Sheets es la fuente elegida para resolver el conflicto y despues se vuelve a escribir la fila final en ambos sitios.
- Los roles validos en la base de datos son exactamente: `administrador`, `responsable`, `tecnico`.
