# Despliegue público

Guía para poner en marcha y operar la instancia pública de Trayectoria (`ARCHITECTURE.md` §5.3, F7-05b). Para instalar una copia propia en una universidad, ver [SELF-HOSTING.md](SELF-HOSTING.md); para el ciclo de Supabase en local, [SUPABASE.md](SUPABASE.md).

La instancia pública tiene cuatro piezas:

- **Sitio**: la salida estática de `apps/web` servida por Cloudflare Workers con static assets. Cloudflare también gestiona el DNS, el certificado y la CDN del dominio.
- **Dominio**: registrado en Namecheap, con los nameservers apuntando a Cloudflare.
- **Supabase** alojado (base de datos, autenticación y almacenamiento), en plan **Pro** desde el lanzamiento público: el plan gratuito pausa los proyectos con poca actividad a los 7 días. Mientras se prepara el lanzamiento puede usarse el plan gratuito.
- **SMTP externo** para los correos de registro, entrada por enlace y recuperación. El SMTP integrado de Supabase es solo para desarrollo.

El documento no contiene secretos: todo lo que aparece entre `<...>` lo defines tú.

## Qué hay en el repositorio

| Archivo | Qué hace |
|---|---|
| `apps/web/wrangler.jsonc` | Worker `trayectoria` sin script: sirve `apps/web/dist` y responde con `404.html` a las rutas que no existen. Sin `routes`: el dominio se asocia desde el panel (paso 4). |
| `.github/workflows/deploy.yml` | En cada push a `main`: build y `wrangler deploy` (producción). En cada PR: build, `wrangler versions upload` (versión sin publicar con URL propia) y un comentario en el PR con la URL de vista previa. |
| `apps/web/public/_headers` | Cabeceras de seguridad de todas las respuestas (#507): CSP, HSTS, `X-Frame-Options`, `Referrer-Policy`, `X-Content-Type-Options` y `Permissions-Policy`. Ver "Cabeceras de seguridad". |
| `supabase/templates/*.html` | Correos de auth en español: `confirmation.html` (registro), `magic_link.html` (entrar con enlace), `recovery.html` (recuperar contraseña) y `reauthentication.html` (código para eliminar la cuenta o cambiar la contraseña). `supabase/config.toml` los usa en local; en el proyecto alojado se pegan en el panel (paso 1.5). |

El workflow necesita un secreto en dos entornos de GitHub y dos variables (paso 3). Mientras falte alguno, los jobs `deploy` y `preview` avisan y no hacen nada, sin fallar. Los PR que vienen de forks no reciben secretos, así que tampoco generan vista previa.

Wrangler es una devDependency exacta de `apps/web` (4.141.0, #511): se instala con el resto del monorepo desde `pnpm-lock.yaml`, con su `integrity`, y el workflow usa esa copia a través de pnpm. En local se ejecuta desde `apps/web` con `pnpm exec wrangler ...`, que lee `wrangler.jsonc` de esa carpeta.

## 1. Supabase

### 1.1 Crear el proyecto

1. En <https://supabase.com/dashboard> crea una organización y, dentro, **New project**: nombre `trayectoria`, la región más cercana a los estudiantes y una contraseña de base de datos generada. Guarda la contraseña en tu gestor de contraseñas.
2. Antes del lanzamiento público, cambia la organización a **Pro** en *Organization settings → Billing*.

### 1.2 Aplicar el esquema

Desde la raíz del repositorio, con la CLI en la versión fijada (`<project-ref>` es el identificador que aparece en la URL del panel, `https://supabase.com/dashboard/project/<project-ref>`):

```bash
pnpm dlx supabase@2.117.0 login
pnpm dlx supabase@2.117.0 link --project-ref <project-ref>
pnpm dlx supabase@2.117.0 db push --dry-run
pnpm dlx supabase@2.117.0 db push
```

`link` pide la contraseña de la base de datos. `db push --dry-run` lista las migraciones de `supabase/migrations/` que se aplicarían; `db push` las aplica. Repite los dos últimos comandos cada vez que se mergee una migración nueva, **antes** de que el sitio que la necesita llegue a producción.

### 1.3 URL y clave pública

En *Project Settings → API Keys* (pestaña de claves `anon`/`service_role`) copia la clave **`anon`**, y en *Project Settings → Data API* la **Project URL** (`https://<project-ref>.supabase.co`). Son los valores de `PUBLIC_SUPABASE_URL` y `PUBLIC_SUPABASE_ANON_KEY` del paso 3. La clave `anon` es pública por diseño (el acceso pasa por RLS). La clave `service_role` no se usa nunca en el sitio ni en GitHub.

### 1.4 URLs de autenticación

En *Authentication → URL Configuration*:

- **Site URL**: `https://<dominio>`.
- **Redirect URLs**: solo `https://<dominio>/**`. Las URL de vista previa de los PR (`https://*-trayectoria.<subdominio>.workers.dev`) **no** van en la lista (#516): el código de un PR sin revisar no puede recibir los enlaces de registro, entrada ni recuperación de las cuentas reales.

Los correos llevan al usuario a `/cuenta` o `/auth/recuperar`; si la URL de destino no está en esta lista, Supabase lo envía a la Site URL.

En *Authentication → Sign In / Providers → Email*:

- Deja activado **Confirm email**: el registro exige confirmar el correo. Con esta opción, registrarse con un correo que ya tiene cuenta recibe la misma respuesta que un registro nuevo, así que el formulario no revela qué correos están registrados (#520).
- Activa **Secure password change**: cambiar la contraseña desde una sesión de más de 24 horas exige el código de reautenticación (#521). Es el `secure_password_change = true` de `supabase/config.toml`.
- Deja **Email OTP Expiration** en `3600` segundos. La migración `0011_reauthentication.sql` acepta el código de reautenticación durante una hora: si cambias este valor, el panel y la base de datos dejan de coincidir.
- **Minimum password length**: `10`, y **Password Requirements**: *Letters and digits* (#512). Son los `minimum_password_length = 10` y `password_requirements = "letters_digits"` de `supabase/config.toml`, y lo que comprueba el formulario de registro antes de enviar.

En *Authentication → Sessions* (#512), para que una sesión robada no se renueve indefinidamente:

- **Time-box user sessions**: `24` horas (`timebox = "24h"` en `supabase/config.toml`).
- **Inactivity timeout**: `8` horas (`inactivity_timeout = "8h"`).

Estos dos ajustes solo están disponibles en el plan **Pro**; en el plan gratuito quedan pendientes hasta el cambio de plan (paso 1.1). El captcha del registro (Turnstile) queda para v2: mientras tanto frenan el abuso los límites de *Authentication → Rate Limits*.

### 1.5 Plantillas de correo en español

En *Authentication → Emails → Templates*, pega en cada plantilla el asunto y el HTML completo del archivo correspondiente:

| Plantilla del panel | Asunto | Archivo |
|---|---|---|
| Confirm signup | `Confirma tu cuenta en Trayectoria` | `supabase/templates/confirmation.html` |
| Magic Link | `Tu enlace para entrar en Trayectoria` | `supabase/templates/magic_link.html` |
| Reset Password | `Restablece tu contraseña de Trayectoria` | `supabase/templates/recovery.html` |
| Reauthentication | `Tu código de confirmación de Trayectoria` | `supabase/templates/reauthentication.html` |

Los asuntos son los mismos que declara `supabase/config.toml`. Si una plantilla cambia en el repositorio, vuelve a pegarla.

### 1.6 SMTP externo

1. Crea una cuenta en un proveedor de correo transaccional y verifica el dominio. El proveedor te da registros DNS (SPF, DKIM y, recomendado, DMARC): añádelos en *Cloudflare → DNS → Records* del dominio (paso 4) como registros **DNS only** (nube gris).
2. En Supabase, *Authentication → Emails → SMTP Settings*, activa **Enable custom SMTP** y rellena: remitente `no-responder@<dominio>`, nombre del remitente `Trayectoria`, host, puerto (normalmente 587), usuario y contraseña que da el proveedor.
3. En *Authentication → Rate Limits* sube **Rate limit for sending emails** al volumen esperado de registros por hora.

## 2. Cloudflare

### 2.1 Cuenta y subdominio `workers.dev`

1. Crea la cuenta en <https://dash.cloudflare.com> (plan gratuito).
2. Abre *Workers & Pages* una vez: Cloudflare asigna el subdominio `<subdominio>.workers.dev` de la cuenta, que usan las URL de vista previa de los PR. El sitio **no** se publica en `https://trayectoria.<subdominio>.workers.dev` (`"workers_dev": false` en `apps/web/wrangler.jsonc`, #526): solo se sirve en el dominio del paso 4, para que no haya una segunda copia «oficial» del sitio ni una segunda dirección aceptada por Supabase.

### 2.2 Token de API para GitHub

1. *My Profile → API Tokens → Create Token*.
2. Plantilla **Edit Cloudflare Workers → Use template**.
3. *Account Resources*: `Include` → tu cuenta. *Zone Resources*: `Include` → `Specific zone` → `<dominio>` (#517). El token solo puede tocar la zona del sitio, no las demás de la cuenta. La zona tiene que existir: si el dominio aún no está en Cloudflare, haz antes el paso 4.1.
4. *Continue to summary → Create Token*. Copia el valor: Cloudflare solo lo muestra una vez. Va directo a los entornos de GitHub (paso 3); no lo guardes en ningún archivo.

## 3. GitHub: entornos, secreto y variables

El token vive en dos **entornos** de GitHub (#517): `production`, que usa el job `deploy`, y `preview`, que usa el job `preview`. Un secreto de entorno solo lo leen los jobs de ese entorno.

1. *Settings → Environments*: abre `production` (el primer run de *Deploy* lo crea; si no existe, *New environment*). En *Deployment branches and tags* elige **Selected branches and tags** y añade `main`: ningún otro branch puede usar el token de producción. No actives *Required reviewers*: quien mergea a `main` ya aprueba el despliegue.
2. En `production`, *Environment secrets → Add secret*: `CLOUDFLARE_API_TOKEN` con el token del paso 2.2.
3. Repite el secreto en el entorno `preview` (sin restricciones de branch), que usan las vistas previas de los PR.
4. Si el secreto `CLOUDFLARE_API_TOKEN` existía a nivel de repositorio (*Settings → Secrets and variables → Actions → Repository secrets*), bórralo: así el token solo está en los entornos.
5. En *Settings → Secrets and variables → Actions → Variables*, las variables del repositorio:

| Tipo | Nombre | Valor |
|---|---|---|
| Variable | `PUBLIC_SUPABASE_URL` | Project URL del paso 1.3 |
| Variable | `PUBLIC_SUPABASE_ANON_KEY` | clave `anon` del paso 1.3 |

Las dos variables se incrustan en el sitio al construirlo: si cambian, hay que volver a desplegar. Si falta alguna, el job `gate` deja un aviso; si falta el token en un entorno, su job (`deploy` o `preview`) lo avisa y no hace nada, sin fallar.

**Primer despliegue.** Mergea cualquier PR a `main` o, en *Actions → Deploy*, abre el último run de `main` y pulsa *Re-run all jobs*. El job `deploy` termina en verde y crea el Worker, que todavía no tiene dirección pública: la recibe al asociar el dominio (paso 4.2). Después de 4.2, comprueba que `https://<dominio>` carga la portada y que una ruta inexistente muestra la página 404 del sitio.

Las vistas previas de PR suben versiones del mismo Worker, así que necesitan que exista: el primer despliegue desde `main` va antes que cualquier vista previa. Las vistas previas usan las mismas variables que producción, es decir, **el mismo proyecto de Supabase** (no hay un segundo proyecto para ellas, #516).

**En las vistas previas no se inicia sesión.** Su dirección no está en las Redirect URLs, así que los enlaces de los correos (confirmar el registro, entrar con enlace, recuperar la contraseña) llevan al dominio y no a la vista previa. Entrar con contraseña sí llega a Supabase, pero opera sobre la base de producción: una vista previa sirve para revisar páginas, temas y simuladores sin cuenta. Lo que necesita cuenta se prueba en local (`docs/ops/SUPABASE.md`) o en producción tras el merge.

## 4. Dominio: Namecheap y Cloudflare

### 4.1 Llevar el DNS a Cloudflare

1. En Cloudflare, *Account Home → Onboard a domain*: escribe `<dominio>`, elige el plan **Free** y continúa. Cloudflare importa los registros DNS que encuentre y muestra **dos nameservers** (`<nombre>.ns.cloudflare.com`).
2. En Namecheap, *Domain List → Manage* junto al dominio. Si *Advanced DNS → DNSSEC* está activado, desactívalo primero.
3. En la pestaña *Domain*, sección *Nameservers*, elige **Custom DNS**, pega los dos nameservers de Cloudflare y guarda con el botón de confirmación.
4. Vuelve a Cloudflare y pulsa *Check nameservers*. El cambio tarda de minutos a 24 horas; Cloudflare envía un correo cuando el dominio queda **Active**.

### 4.2 Asociar el dominio al Worker

1. *Workers & Pages → trayectoria → Settings → Domains & Routes → Add → Custom domain*.
2. Escribe `<dominio>` y confirma. Cloudflare crea el registro DNS y emite el certificado (unos minutos).

### 4.3 `www` redirige al dominio raíz

1. *DNS → Records → Add record*: tipo `AAAA`, nombre `www`, contenido `100::`, **Proxied** (nube naranja). Es un destino ficticio: la regla del paso siguiente responde antes de llegar a él.
2. *Rules → Overview → Templates → Redirect from WWW to root*: redirección `301` de `https://www.<dominio>/*` a `https://<dominio>/${1}`, con **Preserve query string**. Despliega la regla.

### 4.4 SSL

1. *SSL/TLS → Overview → Configure*: modo **Full (strict)**.
2. *SSL/TLS → Edge Certificates*: activa **Always Use HTTPS**.

Con el dominio activo, comprueba que la **Site URL** de Supabase es `https://<dominio>` (paso 1.4) y, si el remitente del SMTP usaba otro dominio, pásalo a `<dominio>` (paso 1.6). Si en algún momento añadiste `https://trayectoria.<subdominio>.workers.dev/**` a las Redirect URLs, quítala: esa dirección ya no sirve el sitio (#526).

## Cabeceras de seguridad

`apps/web/public/_headers` fija las cabeceras de todas las respuestas del sitio, incluida la 404 (#507). La CSP solo permite:

| Directiva | Fuentes | Por qué |
|---|---|---|
| `default-src` | `'self'` | Todo lo demás sale del propio dominio |
| `script-src` | `'self'`, siete hashes `sha256`, `https://static.cloudflareinsights.com` | Los scripts en línea del build (tema claro u oscuro de `Base.astro`, runtime de las islas de Astro y sus directivas `client:load`, `client:visible` y `client:only`, y los scripts de `Nav.astro` y `Outline.astro`), y la baliza de Cloudflare Web Analytics. Sin `'unsafe-inline'` ni `'unsafe-eval'` |
| `style-src` | `'self' 'unsafe-inline'` | KaTeX escribe atributos `style` en cada fórmula y Astro inserta estilos de las islas |
| `img-src` | `'self'` | Solo imágenes propias |
| `font-src` | `'self' data:` | KaTeX incrusta sus fuentes más pequeñas como `data:` |
| `connect-src` | `'self'`, el proyecto de Supabase (`https://` y `wss://`), `blob:`, `https://cloudflareinsights.com` | Datos y sesión; el simulador de brazo lee las mallas de un zip importado desde URL `blob:`; la baliza envía las visitas |
| `object-src` | `'none'` | Sin plugins |
| `base-uri`, `form-action` | `'self'` | |
| `frame-ancestors` | `'none'` | Ninguna web puede enmarcar el sitio (junto con `X-Frame-Options: DENY`) |

El archivo lleva `__SUPABASE_ORIGINS__` en lugar del proyecto: tras el build, el workflow ejecuta `infra/csp-origins.sh`, que lo sustituye por el origen de `PUBLIC_SUPABASE_URL` y su forma `wss://`. Si despliegas a mano, ejecútalo tú antes de `wrangler deploy`:

```bash
PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co sh infra/csp-origins.sh apps/web/dist/_headers
```

**Si cambia un script en línea** (un `<script>` de `Base.astro`, `Nav.astro` u `Outline.astro`, o una versión nueva de Astro), su hash cambia y el navegador lo bloquea. El e2e `apps/web/e2e/csp.spec.ts` falla e imprime el hash nuevo: sustitúyelo en `apps/web/public/_headers` y en `infra/Caddyfile`, que llevan la misma política. En local se comprueba con `CI=1 pnpm e2e`, que construye el sitio; `pnpm dev` no sirve `_headers`.

Para probar las cabeceras reales en local, con el build hecho y el Supabase local en marcha:

```bash
PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 sh infra/csp-origins.sh apps/web/dist/_headers
cd apps/web
pnpm exec wrangler dev --port 4399
```

Sirve el sitio en `http://127.0.0.1:4399` con las cabeceras de `_headers`. Al terminar, borra `apps/web/.wrangler/`, la carpeta temporal que deja `wrangler dev`: git la ignora, pero ESLint la revisaría en `pnpm lint`.

## Rotar el token de Cloudflare

Una vez al año, cuando alguien con acceso deja el proyecto o ante cualquier sospecha de filtración:

1. Crea un token nuevo con los pasos de 2.2.
2. En GitHub sustituye el valor del secreto `CLOUDFLARE_API_TOKEN` en los entornos `production` y `preview` (*Settings → Environments → <entorno> → Environment secrets*, lápiz de la fila).
3. Relanza el último run de *Actions → Deploy* en `main` y comprueba que `deploy` termina en verde.
4. En *My Profile → API Tokens*, borra el token anterior (menú de la fila → *Delete*).

Si el token se ha filtrado, borra primero el anterior (paso 4) y después haz los pasos 1 a 3: el sitio sigue sirviéndose mientras tanto, solo se detienen los despliegues.

## Rollback

Un rollback cambia el código del sitio, **no** la base de datos: si el despliegue malo venía con una migración, revísala antes de volver atrás. El siguiente push a `main` vuelve a desplegar lo que haya en `main`, así que tras un rollback hay que corregir `main` (opción C).

**A. Panel de Cloudflare (lo más rápido).** *Workers & Pages → trayectoria → Deployments*: en la versión buena, menú de la fila → *Rollback*, escribe el motivo y confirma. El cambio es inmediato.

**B. CLI.** Desde `apps/web`, con un token válido en la variable de entorno `CLOUDFLARE_API_TOKEN` de tu terminal (o tras `pnpm exec wrangler login`):

```bash
cd apps/web
pnpm exec wrangler deployments list
pnpm exec wrangler rollback <version-id> --message "<motivo>"
```

Sin `<version-id>`, `rollback` vuelve a la versión anterior a la actual. Cada despliegue lleva como mensaje el commit que lo generó, lo que permite localizar la versión buena en la lista.

**C. Revertir en `main`.** `git revert <commit>` en una rama, PR y merge: el workflow despliega el resultado. Es la corrección definitiva después de A o B.

## Checklist de lanzamiento

- [ ] Supabase en plan Pro; `db push --dry-run` no lista migraciones pendientes.
- [ ] SMTP externo configurado, dominio del remitente verificado y límite de envío ajustado.
- [ ] Las cuatro plantillas en español pegadas en el panel.
- [ ] Site URL y Redirect URLs de Supabase con el dominio definitivo; **Confirm email** y **Secure password change** activados; **Email OTP Expiration** en 3600 s.
- [ ] Contraseña mínima de 10 caracteres con letras y números; sesiones con límite de 24 h y 8 h de inactividad (plan Pro).
- [ ] Token de Cloudflare limitado a la zona `<dominio>`; secreto `CLOUDFLARE_API_TOKEN` en los entornos `production` (solo `main`) y `preview`, y no a nivel de repositorio; variables `PUBLIC_SUPABASE_URL` y `PUBLIC_SUPABASE_ANON_KEY` en GitHub.
- [ ] Un push a `main` despliega en menos de 5 minutos (duración del run *Deploy* en *Actions*).
- [ ] Un PR recibe el comentario con la URL de vista previa y esa URL carga el sitio.
- [ ] `https://<dominio>` carga con candado válido; `http://<dominio>` y `https://www.<dominio>` redirigen a `https://<dominio>`.
- [ ] Una ruta inexistente muestra la página 404 del sitio.
- [ ] `https://<dominio>/dev/widgets` también muestra la 404: las páginas `/dev/*` solo existen en `astro dev` y en los builds con `DEV_PAGES=1` de los e2e (#519).
- [ ] Prueba de registro real superada (sección siguiente).
- [ ] Rollback probado: opción A a la versión anterior, comprobación en el navegador y vuelta a la última versión con otro rollback.

## Prueba de registro real

1. En `https://<dominio>/auth/registro` crea una cuenta con un correo real que no exista en el proyecto.
2. El correo **Confirma tu cuenta** llega en menos de un minuto, en español y desde el remitente de `<dominio>`. Si no llega, mira la carpeta de spam y *Supabase → Logs → Auth*.
3. El botón del correo abre `https://<dominio>/cuenta` con la sesión iniciada.
4. Cierra sesión y pide un enlace desde `/auth/login` (entrar con enlace): llega **Tu enlace para entrar** y abre la sesión.
5. Desde `/auth/recuperar` pide recuperar la contraseña: llega **Restablece tu contraseña** y el enlace permite elegir una nueva tras pedir el código, que llega en **Tu código de confirmación**; con la nueva contraseña se entra.
6. Vuelve a `/auth/registro` con el mismo correo: el formulario responde lo mismo que en el paso 1 («Revisa tu correo…») y no llega ningún correo de confirmación nuevo a una cuenta ya confirmada.
7. Borra la cuenta de prueba desde `/cuenta`: pide el código, llega **Tu código de confirmación** y, con el código y `ELIMINAR`, la cuenta se elimina.

## Solución de problemas

| Síntoma | Causa probable | Qué hacer |
|---|---|---|
| El run muestra *Deploy skipped* y `deploy`/`preview` no despliegan | Falta alguna variable, falta el secreto en el entorno del job, o el PR viene de un fork | Revisa el paso 3; los forks no generan vista previa por diseño |
| `deploy` falla con `Authentication error [code: 10000]` | Token borrado, caducado o sin permisos | Crea un token nuevo (sección "Rotar el token de Cloudflare") |
| `preview` falla con *Wrangler returned no preview URL* | Las URL de vista previa están desactivadas en el Worker | *Workers & Pages → trayectoria → Settings → Domains & Routes*: activa **Preview URLs** |
| `preview` falla porque el Worker no existe | Aún no hubo un despliegue desde `main` | Haz el primer despliegue (paso 3) |
| Los enlaces de los correos llevan a `localhost` o a `workers.dev` | Site URL o Redirect URLs sin actualizar | Paso 1.4: solo `https://<dominio>` |
| El sitio carga pero no se puede entrar ni guardar | Variables `PUBLIC_*` de otro proyecto o vacías en el build | Corrige las variables y vuelve a desplegar |
| `ERR_TOO_MANY_REDIRECTS` en el dominio | Modo SSL distinto de Full (strict) | Paso 4.4 |
