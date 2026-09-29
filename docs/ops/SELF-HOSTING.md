# Autoalojado

Guía para que el equipo técnico de una universidad instale su propia copia de Trayectoria (`ARCHITECTURE.md` §5.3). La instalación tiene dos piezas en la misma máquina:

- **Supabase** (base de datos, autenticación y almacenamiento) con el `docker compose` oficial de Supabase. Este repositorio no lo duplica.
- **El sitio**: archivos estáticos de `apps/web` servidos por Caddy con `infra/docker-compose.yml`. Caddy obtiene los certificados HTTPS automáticamente y también publica la API de Supabase por HTTPS en un segundo dominio.

El documento no contiene secretos reales: todo lo que aparece entre `<...>` lo defines tú.

## Requisitos

- Una VM Linux de 64 bits (por ejemplo Ubuntu 24.04 LTS) con al menos 2 vCPU, 4 GB de RAM y 25 GB de disco.
- Docker Engine con el plugin Compose v2.24 o superior (`docker compose version`). Instalación oficial: <https://docs.docker.com/engine/install/>.
- `git`.
- Dos nombres de dominio con registro DNS `A` (y `AAAA` si hay IPv6) apuntando a la IP pública de la VM, por ejemplo:
  - `trayectoria.<universidad>.edu` para el sitio;
  - `api.trayectoria.<universidad>.edu` para la API de Supabase.
- Puertos 80 y 443 (TCP) y 443 (UDP) abiertos desde Internet hacia la VM. Caddy los necesita para emitir los certificados.
- Recomendado: un servidor SMTP institucional para los correos de registro y recuperación de contraseña.

**Cortafuegos.** El compose de Supabase publica en la VM el puerto de la API (8000), el del pooler de Postgres (5432) y otros. Los puertos publicados por Docker **no** los filtra `ufw`: limita el acceso en el cortafuegos perimetral (grupo de seguridad de la nube o cortafuegos de la universidad) a 22, 80 y 443.

## Variables de entorno

Viven en `infra/.env`, que no se versiona (`.gitignore` excluye `.env`).

| Nombre | Dónde se usa | Ejemplo |
|---|---|---|
| `PUBLIC_SUPABASE_URL` | Argumento de build de `infra/web.Dockerfile`; queda incrustada en el sitio y el navegador la usa para hablar con Supabase | `https://api.trayectoria.<universidad>.edu` |
| `PUBLIC_SUPABASE_ANON_KEY` | Argumento de build de `infra/web.Dockerfile`; clave `anon` de tu Supabase (pública por diseño, el acceso pasa por RLS) | valor de `ANON_KEY` del `.env` de Supabase |
| `SITE_ADDRESS` | `infra/Caddyfile`: dominio del sitio; Caddy obtiene su certificado | `trayectoria.<universidad>.edu` |
| `API_ADDRESS` | `infra/Caddyfile`: dominio de la API; Caddy lo reenvía a Supabase | `api.trayectoria.<universidad>.edu` |
| `SUPABASE_UPSTREAM` | `infra/Caddyfile`: dónde escucha la API del compose de Supabase, vista desde el contenedor (opcional) | `host.docker.internal:8000` (valor por defecto) |

Las dos variables `PUBLIC_*` se fijan **al construir** la imagen: si cambian, hay que reconstruir (paso 8). Nunca pongas la clave `service_role` en `infra/.env` ni en el sitio.

## Instalación paso a paso

Los comandos se ejecutan en la VM como un usuario con permiso para usar Docker. Se asume `/opt` como directorio de trabajo.

### 1. Descargar Trayectoria

```bash
cd /opt
git clone https://github.com/jams-robotics/trayectoria.git
cd trayectoria
git checkout <etiqueta-de-versión>   # o deja main para la última versión
```

### 2. Descargar el compose oficial de Supabase

```bash
cd /opt
git clone --depth 1 https://github.com/supabase/supabase
mkdir supabase-project
cp -rf supabase/docker/* supabase-project
cp supabase/docker/.env.example supabase-project/.env
```

### 3. Configurar Supabase

Edita `/opt/supabase-project/.env` siguiendo la guía oficial (<https://supabase.com/docs/guides/self-hosting/docker>, sección de seguridad). Como mínimo:

- Genera secretos nuevos para `POSTGRES_PASSWORD`, `JWT_SECRET`, `DASHBOARD_PASSWORD` y el resto de claves que la guía indique. **No uses los valores de ejemplo.**
- Genera `ANON_KEY` y `SERVICE_ROLE_KEY` firmadas con tu `JWT_SECRET` como indica la guía oficial. `ANON_KEY` es la clave `anon` que usará el sitio; `SERVICE_ROLE_KEY` no sale nunca de este archivo.
- Ajusta las URLs públicas:

  ```
  SITE_URL=https://trayectoria.<universidad>.edu
  ADDITIONAL_REDIRECT_URLS=https://trayectoria.<universidad>.edu/**
  API_EXTERNAL_URL=https://api.trayectoria.<universidad>.edu
  SUPABASE_PUBLIC_URL=https://api.trayectoria.<universidad>.edu
  ```

- Correo: rellena `SMTP_ADMIN_EMAIL`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` y `SMTP_SENDER_NAME` con tu servidor SMTP. Si todavía no tienes SMTP, `ENABLE_EMAIL_AUTOCONFIRM=true` permite registrarse sin confirmar el correo (es la configuración del entorno local, `supabase/config.toml`); vuelve a `false` cuando el SMTP funcione.
- Deja `KONG_HTTP_PORT=8000` salvo que cambies también `SUPABASE_UPSTREAM`.

### 4. Arrancar Supabase

```bash
cd /opt/supabase-project
docker compose pull
docker compose up -d
docker compose ps        # todos los servicios en "running (healthy)" tras uno o dos minutos
```

### 5. Aplicar el esquema de Trayectoria

Las tablas, políticas RLS, funciones y el bucket están en `supabase/migrations/` del repositorio (`docs/ops/SUPABASE.md`). Se aplican con la CLI de Supabase en la versión fijada (2.117.0), ejecutada dentro de un contenedor de Node para no instalar nada en la VM. `db push` se conecta al pooler de Postgres del compose de Supabase (puerto 5432, usuario `postgres.<POOLER_TENANT_ID>`); `<POOLER_TENANT_ID>` y `<POSTGRES_PASSWORD>` son los de `/opt/supabase-project/.env`:

```bash
cd /opt/trayectoria
docker run --rm --network host -v "$PWD":/repo -w /repo -e COREPACK_ENABLE_DOWNLOAD_PROMPT=0 \
  node:24.18.0-alpine sh -c 'corepack enable && pnpm dlx supabase@2.117.0 db push --yes \
  --db-url "postgresql://postgres.<POOLER_TENANT_ID>:<POSTGRES_PASSWORD>@127.0.0.1:5432/postgres?sslmode=disable"'
```

La salida lista las migraciones `0001_schema.sql` … aplicadas. Si la contraseña contiene caracteres especiales (`@`, `:`, `/`, `#`), escríbelos codificados para URL (por ejemplo `@` como `%40`). Añade `--dry-run` antes de `--yes` para ver qué se aplicaría sin tocar la base.

### 6. Obtener la clave `anon`

Es el valor de `ANON_KEY` en `/opt/supabase-project/.env`:

```bash
grep '^ANON_KEY=' /opt/supabase-project/.env
```

### 7. Configurar el sitio

Crea `/opt/trayectoria/infra/.env` con este contenido, sustituyendo los valores:

```
PUBLIC_SUPABASE_URL=https://api.trayectoria.<universidad>.edu
PUBLIC_SUPABASE_ANON_KEY=<valor de ANON_KEY>
SITE_ADDRESS=trayectoria.<universidad>.edu
API_ADDRESS=api.trayectoria.<universidad>.edu
```

### 8. Construir y arrancar el sitio

```bash
cd /opt/trayectoria
docker compose -f infra/docker-compose.yml build
docker compose -f infra/docker-compose.yml up -d
docker compose -f infra/docker-compose.yml logs -f web   # Ctrl+C para salir
```

La construcción (`infra/web.Dockerfile`) instala las dependencias con `pnpm install --frozen-lockfile`, ejecuta `pnpm build` y copia `apps/web/dist` a una imagen de Caddy (`infra/Caddyfile`). Caddy envía en cada página las mismas cabeceras de seguridad que la instancia pública (CSP, HSTS, `X-Frame-Options` y demás, `docs/ops/DEPLOY.md` "Cabeceras de seguridad"); la CSP solo deja conectar con la `PUBLIC_SUPABASE_URL` con la que se construyó la imagen, así que si cambia hay que reconstruir. Tarda unos minutos la primera vez. En los registros debe aparecer `certificate obtained successfully` para los dos dominios.

### 9. Verificación final

1. `https://trayectoria.<universidad>.edu/` muestra la página de inicio con candado válido.
2. `https://trayectoria.<universidad>.edu/ruta/ruta-1/m00/t01/` muestra el primer tema.
3. Una ruta inexistente (`/no-existe/`) muestra la página «Página no encontrada».
4. Registra un usuario de prueba desde «Entrar» en el sitio. Con SMTP, llega el correo de confirmación; con `ENABLE_EMAIL_AUTOCONFIRM=true`, la sesión se abre directamente.
5. En el Studio de Supabase (`https://api.trayectoria.<universidad>.edu`, usuario y contraseña del dashboard) aparece el usuario en _Authentication_ y su fila en la tabla `profiles`.
6. Borra el usuario de prueba desde la página de cuenta del sitio o desde el Studio.

## Prueba local

Para probar la imagen en un equipo con Docker Desktop, contra el Supabase local de `docs/ops/SUPABASE.md`, sin dominios ni puertos 80/443:

```bash
cp .env.example infra/.env
printf 'SITE_ADDRESS=:80\nAPI_ADDRESS=:8000\n' >> infra/.env
docker compose -f infra/docker-compose.yml -f infra/docker-compose.override.example.yml build
docker compose -f infra/docker-compose.yml -f infra/docker-compose.override.example.yml up -d
```

`infra/docker-compose.override.example.yml` sirve el sitio por HTTP en `http://localhost:8080` en lugar de los puertos 80/443. Se puede copiar como `infra/docker-compose.override.yml` y adaptarlo. Para parar y limpiar:

```bash
docker compose -f infra/docker-compose.yml -f infra/docker-compose.override.example.yml down -v --rmi all
```

## Actualizar a una versión nueva

1. Haz una copia de seguridad (sección siguiente).
2. Descarga la versión:

   ```bash
   cd /opt/trayectoria
   git fetch --tags
   git checkout <etiqueta-nueva>
   ```

3. Aplica las migraciones nuevas repitiendo el paso 5 (`db push` solo aplica las que faltan).
4. Reconstruye y reinicia el sitio:

   ```bash
   docker compose -f infra/docker-compose.yml build
   docker compose -f infra/docker-compose.yml up -d
   ```

Para actualizar Supabase sigue la guía oficial: `git pull` en el repositorio de Supabase, compara `docker/.env.example` con tu `.env`, copia el nuevo `docker-compose.yml` y ejecuta `docker compose pull && docker compose up -d` en `/opt/supabase-project`.

## Copia de seguridad de Postgres

Toda la información de los estudiantes (cuentas, progreso, intentos, grupos, robots) está en Postgres. El sitio no guarda datos. Copia completa en formato comprimido:

```bash
cd /opt/supabase-project
mkdir -p /opt/backups
docker compose exec -T db pg_dump -U supabase_admin -d postgres -Fc > /opt/backups/trayectoria-$(date +%F).dump
```

Programa el comando a diario (por ejemplo con `cron`) y guarda las copias fuera de la VM. Los ficheros URDF subidos por los estudiantes están en el volumen de almacenamiento de Supabase (`volumes/storage` en `/opt/supabase-project`): inclúyelo en la copia de ficheros.

Restauración en una instancia **nueva y vacía** (pruébala antes de necesitarla):

```bash
cd /opt/supabase-project
docker compose exec -T db pg_restore -U supabase_admin -d postgres --clean --if-exists < /opt/backups/trayectoria-<fecha>.dump
```

## Solución de problemas

| Síntoma | Causa probable | Qué hacer |
|---|---|---|
| `docker compose ... build` falla con `define PUBLIC_SUPABASE_URL in infra/.env` (u otra variable) | Falta la variable en `infra/.env` | Completa el archivo (paso 7) |
| `ports: !override` da error de sintaxis | Docker Compose anterior a v2.24 | Actualiza Docker Compose |
| Caddy no obtiene certificados (`challenge failed`, `timeout`) | El DNS no apunta a la VM o los puertos 80/443 están cerrados | Comprueba con `dig +short <dominio>` y el cortafuegos; revisa `docker compose -f infra/docker-compose.yml logs web` |
| Error `bind: address already in use` en 80/443 | Otro servidor web (Apache, nginx) ocupa los puertos | Detén ese servicio |
| El sitio carga pero no se puede entrar ni registrarse; la consola del navegador muestra errores de red o CORS | `PUBLIC_SUPABASE_URL` incorrecta, o la imagen se construyó antes de cambiarla | Corrige `infra/.env` y reconstruye (paso 8) |
| `https://api...` responde `502 Bad Gateway` | Supabase no está arrancado o Kong no escucha en `SUPABASE_UPSTREAM` | `docker compose ps` en `/opt/supabase-project`; revisa `KONG_HTTP_PORT` |
| `Invalid API key` al registrarse | `PUBLIC_SUPABASE_ANON_KEY` no corresponde al `JWT_SECRET` de Supabase | Vuelve a copiar `ANON_KEY` (paso 6) y reconstruye |
| El correo de confirmación no llega | SMTP sin configurar o rechazado | Revisa `SMTP_*` en el `.env` de Supabase y `docker compose logs auth` |
| El enlace del correo lleva a otra dirección | `SITE_URL` o `ADDITIONAL_REDIRECT_URLS` sin actualizar | Corrígelos y ejecuta `docker compose up -d` en `/opt/supabase-project` |
| `db push` falla con `tls error` | Falta `?sslmode=disable` en la URL | Copia el comando del paso 5 tal cual |
| `db push` falla con `password authentication failed` o `tenant not found` | Usuario sin el sufijo `.<POOLER_TENANT_ID>` o contraseña sin codificar | Revisa el formato del paso 5 |
| Tras actualizar, el sitio muestra la versión anterior | La imagen no se reconstruyó | Ejecuta `build` antes de `up -d` |
