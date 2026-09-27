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
| `supabase/templates/*.html` | Correos de auth en español: `confirmation.html` (registro), `magic_link.html` (entrar con enlace) y `recovery.html` (recuperar contraseña). `supabase/config.toml` los usa en local; en el proyecto alojado se pegan en el panel (paso 1.5). |

El workflow necesita un secreto y dos variables en GitHub (paso 3). Mientras falte alguno, el job `gate` deja un aviso y los jobs `deploy` y `preview` se omiten sin fallar. Los PR que vienen de forks no reciben secretos, así que tampoco generan vista previa.

Wrangler no es dependencia del monorepo: el workflow lo instala en el runner en la versión fijada en `WRANGLER_VERSION` (4.141.0). En local se ejecuta con `npx wrangler@4.141.0 ... --config apps/web/wrangler.jsonc`.

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

- **Site URL**: `https://<dominio>` (mientras no haya dominio, `https://trayectoria.<subdominio>.workers.dev`).
- **Redirect URLs**, una por línea:
  - `https://<dominio>/**`
  - `https://trayectoria.<subdominio>.workers.dev/**`
  - `https://*-trayectoria.<subdominio>.workers.dev/**` (vistas previas de PR)

Los correos llevan al usuario a `/cuenta` o `/auth/recuperar`; si la URL de destino no está en esta lista, Supabase lo envía a la Site URL.

En *Authentication → Sign In / Providers → Email* deja activado **Confirm email**: el registro exige confirmar el correo.

### 1.5 Plantillas de correo en español

En *Authentication → Emails → Templates*, pega en cada plantilla el asunto y el HTML completo del archivo correspondiente:

| Plantilla del panel | Asunto | Archivo |
|---|---|---|
| Confirm signup | `Confirma tu cuenta en Trayectoria` | `supabase/templates/confirmation.html` |
| Magic Link | `Tu enlace para entrar en Trayectoria` | `supabase/templates/magic_link.html` |
| Reset Password | `Restablece tu contraseña de Trayectoria` | `supabase/templates/recovery.html` |

Los asuntos son los mismos que declara `supabase/config.toml`. Si una plantilla cambia en el repositorio, vuelve a pegarla.

### 1.6 SMTP externo

1. Crea una cuenta en un proveedor de correo transaccional y verifica el dominio. El proveedor te da registros DNS (SPF, DKIM y, recomendado, DMARC): añádelos en *Cloudflare → DNS → Records* del dominio (paso 4) como registros **DNS only** (nube gris).
2. En Supabase, *Authentication → Emails → SMTP Settings*, activa **Enable custom SMTP** y rellena: remitente `no-responder@<dominio>`, nombre del remitente `Trayectoria`, host, puerto (normalmente 587), usuario y contraseña que da el proveedor.
3. En *Authentication → Rate Limits* sube **Rate limit for sending emails** al volumen esperado de registros por hora.

## 2. Cloudflare

### 2.1 Cuenta y subdominio `workers.dev`

1. Crea la cuenta en <https://dash.cloudflare.com> (plan gratuito).
2. Abre *Workers & Pages* una vez: Cloudflare asigna el subdominio `<subdominio>.workers.dev` de la cuenta. Hasta que el dominio esté listo, el sitio se sirve en `https://trayectoria.<subdominio>.workers.dev`.

### 2.2 Token de API para GitHub

1. *My Profile → API Tokens → Create Token*.
2. Plantilla **Edit Cloudflare Workers → Use template**.
3. *Account Resources*: `Include` → tu cuenta. *Zone Resources*: `Include` → `All zones from an account` → tu cuenta.
4. *Continue to summary → Create Token*. Copia el valor: Cloudflare solo lo muestra una vez. Va directo al secreto de GitHub (paso 3); no lo guardes en ningún archivo.

## 3. GitHub: secreto y variables

En el repositorio, *Settings → Secrets and variables → Actions*:

| Tipo | Nombre | Valor |
|---|---|---|
| Secret | `CLOUDFLARE_API_TOKEN` | token del paso 2.2 |
| Variable | `PUBLIC_SUPABASE_URL` | Project URL del paso 1.3 |
| Variable | `PUBLIC_SUPABASE_ANON_KEY` | clave `anon` del paso 1.3 |

Las dos variables se incrustan en el sitio al construirlo: si cambian, hay que volver a desplegar.

**Primer despliegue.** Mergea cualquier PR a `main` o, en *Actions → Deploy*, abre el último run de `main` y pulsa *Re-run all jobs*. El job `deploy` termina con la URL publicada. Comprueba que `https://trayectoria.<subdominio>.workers.dev` carga la portada y que una ruta inexistente muestra la página 404 del sitio.

Las vistas previas de PR suben versiones del mismo Worker, así que necesitan que exista: el primer despliegue desde `main` va antes que cualquier vista previa. Las vistas previas usan las mismas variables que producción, es decir, **el mismo proyecto de Supabase**: lo que hagas con una cuenta en una vista previa queda en la base de producción.

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

Con el dominio activo, cambia la **Site URL** de Supabase a `https://<dominio>` (paso 1.4) y, si el remitente del SMTP usaba otro dominio, pásalo a `<dominio>` (paso 1.6).

## Rotar el token de Cloudflare

Una vez al año, cuando alguien con acceso deja el proyecto o ante cualquier sospecha de filtración:

1. Crea un token nuevo con los pasos de 2.2.
2. En GitHub sustituye el valor del secreto `CLOUDFLARE_API_TOKEN` (*Update secret*).
3. Relanza el último run de *Actions → Deploy* en `main` y comprueba que `deploy` termina en verde.
4. En *My Profile → API Tokens*, borra el token anterior (menú de la fila → *Delete*).

Si el token se ha filtrado, borra primero el anterior (paso 4) y después haz los pasos 1 a 3: el sitio sigue sirviéndose mientras tanto, solo se detienen los despliegues.

## Rollback

Un rollback cambia el código del sitio, **no** la base de datos: si el despliegue malo venía con una migración, revísala antes de volver atrás. El siguiente push a `main` vuelve a desplegar lo que haya en `main`, así que tras un rollback hay que corregir `main` (opción C).

**A. Panel de Cloudflare (lo más rápido).** *Workers & Pages → trayectoria → Deployments*: en la versión buena, menú de la fila → *Rollback*, escribe el motivo y confirma. El cambio es inmediato.

**B. CLI.** Con un token válido en la variable de entorno `CLOUDFLARE_API_TOKEN` de tu terminal (o tras `npx wrangler@4.141.0 login`):

```bash
npx wrangler@4.141.0 deployments list --config apps/web/wrangler.jsonc
npx wrangler@4.141.0 rollback <version-id> --config apps/web/wrangler.jsonc --message "<motivo>"
```

Sin `<version-id>`, `rollback` vuelve a la versión anterior a la actual. Cada despliegue lleva como mensaje el commit que lo generó, lo que permite localizar la versión buena en la lista.

**C. Revertir en `main`.** `git revert <commit>` en una rama, PR y merge: el workflow despliega el resultado. Es la corrección definitiva después de A o B.

## Checklist de lanzamiento

- [ ] Supabase en plan Pro; `db push --dry-run` no lista migraciones pendientes.
- [ ] SMTP externo configurado, dominio del remitente verificado y límite de envío ajustado.
- [ ] Las tres plantillas en español pegadas en el panel.
- [ ] Site URL y Redirect URLs de Supabase con el dominio definitivo; **Confirm email** activado.
- [ ] Secreto `CLOUDFLARE_API_TOKEN` y variables `PUBLIC_SUPABASE_URL` y `PUBLIC_SUPABASE_ANON_KEY` en GitHub.
- [ ] Un push a `main` despliega en menos de 5 minutos (duración del run *Deploy* en *Actions*).
- [ ] Un PR recibe el comentario con la URL de vista previa y esa URL carga el sitio.
- [ ] `https://<dominio>` carga con candado válido; `http://<dominio>` y `https://www.<dominio>` redirigen a `https://<dominio>`.
- [ ] Una ruta inexistente muestra la página 404 del sitio.
- [ ] Prueba de registro real superada (sección siguiente).
- [ ] Rollback probado: opción A a la versión anterior, comprobación en el navegador y vuelta a la última versión con otro rollback.

## Prueba de registro real

1. En `https://<dominio>/auth/registro` crea una cuenta con un correo real que no exista en el proyecto.
2. El correo **Confirma tu cuenta** llega en menos de un minuto, en español y desde el remitente de `<dominio>`. Si no llega, mira la carpeta de spam y *Supabase → Logs → Auth*.
3. El botón del correo abre `https://<dominio>/cuenta` con la sesión iniciada.
4. Cierra sesión y pide un enlace desde `/auth/login` (entrar con enlace): llega **Tu enlace para entrar** y abre la sesión.
5. Desde `/auth/recuperar` pide recuperar la contraseña: llega **Restablece tu contraseña**, el enlace permite elegir una nueva y con ella se entra.
6. Borra la cuenta de prueba desde `/cuenta`.

## Solución de problemas

| Síntoma | Causa probable | Qué hacer |
|---|---|---|
| El run muestra *Deploy skipped* y `deploy`/`preview` aparecen omitidos | Falta el secreto o alguna variable, o el PR viene de un fork | Revisa el paso 3; los forks no generan vista previa por diseño |
| `deploy` falla con `Authentication error [code: 10000]` | Token borrado, caducado o sin permisos | Crea un token nuevo (sección "Rotar el token de Cloudflare") |
| `preview` falla con *Wrangler returned no preview URL* | Las URL de vista previa están desactivadas en el Worker | *Workers & Pages → trayectoria → Settings → Domains & Routes*: activa **Preview URLs** |
| `preview` falla porque el Worker no existe | Aún no hubo un despliegue desde `main` | Haz el primer despliegue (paso 3) |
| Los enlaces de los correos llevan a `localhost` o a `workers.dev` | Site URL o Redirect URLs sin actualizar | Paso 1.4 |
| El sitio carga pero no se puede entrar ni guardar | Variables `PUBLIC_*` de otro proyecto o vacías en el build | Corrige las variables y vuelve a desplegar |
| `ERR_TOO_MANY_REDIRECTS` en el dominio | Modo SSL distinto de Full (strict) | Paso 4.4 |
