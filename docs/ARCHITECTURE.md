# Arquitectura

Fuente de verdad técnica. Cualquier cambio estructural requiere un ADR en `docs/adr/` y aprobación del humano.

## 1. Criterios de diseño

1. Que un modelo poco potente trabaje bien: stack masivo, documentado, convencional, pocas librerías.
2. Autoalojable con `docker compose`.
3. Cada librería externa vive detrás de un componente o módulo propio. Los temas y los simuladores nunca importan `three`, `uplot`, `katex` ni `@supabase/supabase-js` directamente.
4. Rendimiento en laptops y conexiones modestas.
5. Determinismo: la misma semilla y los mismos parámetros producen el mismo resultado, siempre.

## 2. Estructura del repositorio

```
trayectoria/
├── apps/
│   └── web/                 # Astro + islas React (el sitio)
├── packages/
│   ├── sim-core/            # TS puro, sin DOM: bucle, física, cinemática, URDF, ejercicios
│   ├── robot-spec/          # esquema RobotSpec (zod), ejemplos, migraciones
│   ├── widgets/             # componentes React reutilizables (WIDGETS.md)
│   ├── sims/                # simulador móvil y de brazo (componen sim-core + widgets)
│   ├── progress/            # servicio de progreso e intentos
│   ├── auth/                # cliente supabase-js, sesión, AuthGate
│   ├── db/                  # tipos generados y cliente tipado
│   └── i18n/                # i18next, locales
├── content/
│   └── es/
│       └── ruta-1/
│           ├── ruta.json    # orden de módulos y temas
│           └── m04-t02/     # un directorio por tema
│               ├── index.mdx
│               ├── ejercicios.ts
│               └── assets/
├── catalog/
│   ├── arms/{id}/           # urdf/, meshes/, ficha.json, LICENSE
│   └── mobile/{id}.json     # robots de referencia (RobotSpec)
├── supabase/                # config, migrations, seed
├── infra/                   # docker-compose, Caddyfile
├── docs/                    # este directorio
├── .github/
└── CLAUDE.md
```

Dependencias permitidas entre paquetes (flecha = "puede importar"):

```
apps/web → sims, widgets, progress, auth, db, i18n, robot-spec
sims     → sim-core, widgets, robot-spec, i18n, progress
widgets  → sim-core, robot-spec, i18n
progress → db, auth
auth     → db
sim-core → robot-spec (solo tipos)   robot-spec → (nada interno)
```

Cualquier otra importación es un error de arquitectura (regla de ESLint `import/no-restricted-paths`).

## 3. Frontend

### 3.1 Astro e islas

- Astro renderiza páginas y MDX de forma estática en build (`output: 'static'`).
- Todo componente interactivo es una isla React. Directiva por defecto: `client:visible`. `client:load` solo para `AuthGate` y el store de sesión. `client:only="react"` para escenas 3D.
- Regla para agentes: **no hay estado compartido entre islas excepto a través de nanostores** (`packages/*/src/stores/`). Prohibido prop drilling entre islas, eventos DOM globales o `window.*`.
- Stores existentes: `$session` (auth), `$myRobot` (perfil activo), `$theme`, `$progress`.
- Quien necesite la sesión una sola vez (no reaccionar a sus cambios) espera a `ensureSessionReady(): Promise<Session | null>` de `packages/auth`, que activa el store y resuelve con la sesión actual en cuanto está lista, en lugar de montar su propia suscripción manual (#184).
- Todo paquete con UI debe figurar en los `@source` de `apps/web/src/styles/global.css`: Tailwind solo escanea lo que ahí se declara, así que un paquete que falte se queda sin sus clases en producción aunque funcione en desarrollo (#167).

### 3.2 Rutas

| Ruta | Página |
|---|---|
| `/` | Inicio |
| `/ruta/[ruta]` | Índice de la ruta con progreso |
| `/ruta/[ruta]/[modulo]/[tema]` | Tema (MDX) |
| `/simuladores/movil` | Simulador móvil 2D |
| `/simuladores/brazo` | Simulador de brazo 3D |
| `/brazos`, `/brazos/[id]` | Catálogo |
| `/cuenta`, `/cuenta/robots` | Cuenta y robots guardados |
| `/aula`, `/aula?grupo=<id>` | Docente. Ruta canónica del detalle: la de query string, no `/aula/[groupId]`, mientras el sitio sea estático (`output: 'static'` no puede prerenderizar un parámetro no enumerable; F3-02a) |
| `/unirse` | Estudiante se une a un grupo |
| `/auth/login`, `/auth/registro`, `/auth/recuperar` | Auth |
| `/docentes`, `/contribuir`, `/acerca` | Públicas |
| `/dev/widgets` | Playground de widgets (solo en dev) |
| `/dev/sims` | Playground de `packages/sims` (solo en dev) |

### 3.3 Contenido como código

- Un tema = un directorio `content/es/ruta-1/mNN-tNN/` con `index.mdx`, `ejercicios.ts` y `assets/`.
- Frontmatter validado por zod en `apps/web/src/content.config.ts` (campos en `CONTENT-STANDARDS.md`).
- Orden y agrupación en `ruta.json`. La URL se deriva del directorio: `m04-t02` → `/ruta/ruta-1/m04/t02`.
- Los temas solo pueden importar componentes del mapa MDX (F2-13) y widgets del catálogo. Cualquier `import` de otra cosa rompe `pnpm content:check`.
- i18n del contenido: por carpeta de idioma (`content/en/` en el futuro). Los textos de widgets van por claves.

### 3.4 Librerías fijas

| Necesidad | Librería | Envoltorio propio |
|---|---|---|
| Framework de páginas | Astro, con sus integraciones oficiales `@astrojs/mdx` (temas) y `@astrojs/react` (islas); `@astrojs/check` como comprobador de tipos | — |
| UI interactiva | React | — |
| Estilos | Tailwind + tokens CSS | `apps/web/src/styles/tokens.css` |
| Estado entre islas | nanostores | `packages/*/src/stores` |
| 3D | three, @react-three/fiber, @react-three/drei | `widgets/Scene3D` |
| URDF en 3D | urdf-loader | `sims/arm/UrdfModel` |
| Gráficas | uPlot | `widgets/Plot` |
| Fórmulas | KaTeX | `widgets/Formula` |
| Validación | zod | — |
| i18n | i18next | `packages/i18n` |
| Backend | @supabase/supabase-js | `packages/auth`, `packages/db` |
| Tests | Vitest, @testing-library/react, Playwright | — |
| Lint y formato de `.astro` | eslint-plugin-astro, prettier-plugin-astro (ADR-0007) | — |
| Zip (subida de URDF) | fflate (ADR-0008) | `sims/urdf/zip` |

Añadir una librería requiere un ADR. Versiones fijadas sin `^`.

El envoltorio `sims/urdf` (ADR-0008, #124) es el único punto que toca `fflate`: lee y valida el zip antes de descomprimir nada. Sus textos van en el namespace i18n `urdf` (`locales/es/urdf.json`, `ops/I18N.md` §1).

## 4. sim-core

TypeScript puro, sin DOM, sin React. Funciones puras y modelos con la interfaz:

```ts
interface Model<S, I> {
  init(seed: number): S;
  step(state: S, input: I, dt_s: number): S;
}
```

`Simulation<S, I>` envuelve un `Model` con acumulador de tiempo fijo, controles y suscriptores. El render lo maneja `useSimulationDriver` en `widgets`.

### 4.1 Modelo diferencial

Entradas: `omegaL_radps`, `omegaR_radps`. Parámetros desde `RobotSpec.mobile`.

```
omegaMax = rpmToRadps(maxMotorSpeed_rpm) / gearRatio
ωL, ωR   = clamp(cmd, −omegaMax, omegaMax), con rampa maxAccel_radps2 si está definida
vL = ωL · r          vR = ωR · r
v  = (vR + vL) / 2   ω  = (vR − vL) / L
```

Integración exacta de arco por paso:

```
si |ω| < 1e-9:  x += v·cos θ·dt ;  y += v·sin θ·dt
si no:          R = v/ω ; θ' = θ + ω·dt
                x += R·(sin θ' − sin θ) ;  y −= R·(cos θ' − cos θ) ;  θ = wrapPi(θ')
```

Convenciones: marco global con X a la derecha, Y hacia arriba, θ medido desde +X en sentido antihorario. Marco del robot: X hacia adelante, Y hacia la izquierda. Rueda izquierda en `(0, +L/2)`, derecha en `(0, −L/2)`.

Cinemática inversa: `vR = v + ω·L/2`, `vL = v − ω·L/2`, `ω_rueda = v_rueda / r`.

Encoders: `ticks = floor(wheelAngle_rad / (2π) · encoderTicksPerRev)`. Odometría: desde `Δticks` se estima `ΔsL, ΔsR` y se integra con las mismas ecuaciones (`Δs = (ΔsR + ΔsL)/2`, `Δθ = (ΔsR − ΔsL)/L`).

### 4.2 Pista

Segmentos `line | arc` con `lineWidth_m`. `reflectance(p, footprint_m)`:

```
d = distanciaAlEjeCentral(p)
if d ≤ w/2:            1
if d ≥ w/2 + footprint: 0
else:                   1 − (d − w/2) / footprint
```

Se asume línea oscura sobre fondo claro; 1 = "veo línea".

### 4.3 Sensores de línea

`N` sensores, índice 0 el más a la izquierda, en `(forwardOffset_m, spacing_m·((N−1)/2 − k))` en el marco del robot. Lectura analógica `[0,1]` con ruido gaussiano opcional (σ, RNG con semilla). Binaria con umbral.

```
linePosition = Σ(k·v_k) / Σ v_k, normalizado a [−1, 1]   (negativo = línea a la izquierda)
lineLost     = Σ v_k < lostThreshold  → se mantiene el último signo
```

### 4.4 Controlador

```ts
interface Controller<P> {
  params: P;
  reset(): void;
  update(reading: LineReading, state: DiffDriveState, dt_s: number): WheelCommand;
}
```

Las implementaciones leen `params` en **cada** `update()`, no lo copian al construirse: el consumidor cambia una ganancia reemplazando el objeto `params`, y el efecto se ve en el paso siguiente sin reiniciar la carrera (#163).

PID: `u = Kp·e + Ki·∫e·dt + Kd·de/dt`, `ωL = ωbase + u`, `ωR = ωbase − u`. Anti-windup por saturación del integrador en `±iMax`. Esta interfaz es la que en v2 implementará el código del estudiante; no se cambia.

### 4.5 Brazo serial

Convención URDF. `rpy` = roll (X), pitch (Y), yaw (Z) sobre ejes fijos: `R = Rz(yaw)·Ry(pitch)·Rx(roll)`.

```
T_child = T_parent · T_origin(xyz, rpy) · T_joint(q)
revolute/continuous: T_joint = Rot(axis, q)
prismatic:           T_joint = Trans(axis · q)
fixed:               T_joint = I
```

`forwardKinematics(spec, q) → Map<linkName, mat4>`. El visor 3D usa `urdf-loader` para mallas y jerarquía, pero **todo número que se muestra al usuario sale de sim-core**; un test verifica que ambos coinciden.

### 4.6 Ejercicios

`defineExercise` produce un objeto puro: generador con RNG, enunciado con claves i18n, respuesta y tolerancia. `check()` es pura. La UI (`ExerciseWidget`) y la persistencia (`progress`) viven fuera de sim-core.

## 5. Datos (Supabase)

### 5.1 Tablas

```sql
profiles      (id uuid pk → auth.users, display_name text, role text check (role in ('student','teacher')), created_at)
groups        (id uuid pk, owner_id uuid → profiles, name text, invite_code text unique, created_at)
group_members (group_id uuid → groups, user_id uuid → profiles, joined_at, pk (group_id, user_id))
robots        (id uuid pk, owner_id uuid → profiles, name text, kind text check (kind in ('mobile-diff','arm-serial')),
               spec jsonb, spec_version int, urdf_path text null, is_default bool default false, created_at, updated_at)
progress      (user_id uuid → profiles, topic_id text, status text check (status in ('in_progress','completed')),
               best_score numeric, attempts int, completed_at timestamptz null, updated_at, pk (user_id, topic_id))
attempts      (id uuid pk, user_id uuid → profiles, topic_id text, exercise_id text, seed int,
               response jsonb, correct bool, created_at)
```

`topic_id` = `ruta-1/m04-t02`. `exercise_id` = `ruta-1/m04-t02/e1`.

`robots.spec.simConfigs` lo escribe el cliente (F4-05, #131): cada configuración guardada lleva el `spec` completo del robot, no una referencia, para que abrirla no dependa de que ese robot siga existiendo. La tabla `robots` no cambia; es una clave más dentro del `jsonb` de `spec`.

### 5.2 Políticas RLS (resumen; el SQL completo es el entregable de F0-07)

| Tabla | Estudiante | Docente |
|---|---|---|
| profiles | lee el propio y edita su `display_name` | además lee perfiles de miembros de sus grupos |
| groups | lee los grupos donde es miembro (sin `invite_code`) | CRUD de los propios |
| group_members | inserta solo vía `join_group()`; lee sus membresías | lee y borra en sus grupos |
| robots | CRUD propios | igual |
| progress, attempts | CRUD propios | además lee los de miembros de sus grupos |
| storage `urdf` | lee y escribe `urdf/{uid}/*` | igual |

`join_group(invite_code text)` es `security definer`: busca el grupo y crea la membresía sin exponer códigos. Ningún dato es público. Nunca se usa la `service_role` desde el cliente.

### 5.3 Instancia pública y autoalojado

**Pública (F7-05b):** sitio estático en Cloudflare Workers con static assets, desplegado por GitHub Action en cada merge a `main`; dominio registrado en Namecheap con nameservers en Cloudflare (DNS, SSL y CDN gestionados ahí); Supabase alojado en plan Pro desde el lanzamiento (el plan gratuito pausa proyectos inactivos) con SMTP externo para correos de auth. Costo esperado: dominio anual + Supabase Pro mensual; Cloudflare gratis.

**Autoalojado (F7-03):** sitio estático servido por Caddy + Supabase autoalojado con su `docker compose` oficial. Variables: `PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_ANON_KEY`. Documento paso a paso en `docs/ops/SELF-HOSTING.md`.

## 6. Seguridad

- RLS en todas las tablas; tests de políticas con dos usuarios.
- Subidas: tamaño ≤ 20 MB, extensiones permitidas, rechazo de `..` y rutas absolutas, parseo del URDF antes de guardar, mallas cargadas solo desde el propio bucket.
- Un brazo importado se dibuja sin red: las mallas del zip se resuelven a Blob URL creadas en el propio navegador, nunca a URLs externas, y se revocan al cambiar de fuente y al desmontar (#137).
- Enlace compartido del simulador móvil: el texto del enlace no pasa de 8 000 caracteres y lo que lleva dentro no pasa de 64 KiB descomprimidos; si la configuración no cabe, «Copiar enlace» avisa al usuario y no copia nada, en vez de generar un enlace que no se pueda abrir (#182). Un enlace `?c=` con controlador `manual` abre con PID: el modo manual no viaja en el enlace (#131).
- Sin `dangerouslySetInnerHTML` salvo en `Formula` (salida de KaTeX, con `trust: false`).
- Dependencias auditadas en CI (`pnpm audit --audit-level=high`).
- Sin analytics de terceros en v1.

## 7. Calidad

- **sim-core:** Vitest con valores dorados analíticos (los de `PLAN.md` y `CURRICULUM.md`). Cobertura mínima 90 % en `sim-core` y `robot-spec`.
- **widgets:** Testing Library para comportamiento; Playwright para capturas de regresión visual en `/dev/widgets`.
- **e2e:** Playwright: auth, progreso, aula, simuladores. Corre en CI contra Supabase local.
- **Contenido:** `pnpm content:check` valida frontmatter, secciones obligatorias, imports permitidos, existencia de widgets y claves i18n.
- **Determinismo:** todo `Math.random` está prohibido; se usa `SeededRng`.

## 8. Rendimiento

- Presupuesto por página de tema: ≤ 250 kB JS comprimido (sin three).
- three solo en páginas 3D, con `client:only` y `import()` dinámico.
- `Simulation` corre en el hilo principal en v1 con `dt = 1 ms` y render a 60 Hz; `sim-core` sin DOM para migrar a Web Worker en v2 sin cambios de API.
- Canvas hi-DPI limitado a `devicePixelRatio ≤ 2`.

## 9. Referencias a decisiones

- ADR-0001 Astro con islas React
- ADR-0002 Supabase como backend
- ADR-0003 RobotSpec y URDF como único estándar de robot
- ADR-0004 Sin motor de física en v1
- ADR-0005 Currículo como código
- ADR-0006 Controlador intercambiable
- ADR-0007 ESLint y Prettier para archivos `.astro`
- ADR-0008 fflate para leer zips en el navegador
