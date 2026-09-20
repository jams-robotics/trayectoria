# Trayectoria — Plan de acción v1

> Nombre de trabajo: **Trayectoria** (una trayectoria es a la vez el camino de aprendizaje y el objeto de estudio). Cambiar cuando se decida el nombre final.
>
> Estado: aprobado en sesión de diseño del 2026-09-13. Este documento es la fuente de verdad del alcance. Cualquier cambio de alcance se hace aquí primero, nunca en el código.

## 0. Cómo usar este documento

- **Humanos:** sección 1 a 5 explica qué se construye y por qué. Sección 6 es el backlog: cada tarea es un ticket listo para asignar.
- **Orquestador (agente):** convierte cada tarea de la sección 6 en un issue de GitHub usando `docs/templates/TASK.md`, respetando dependencias y orden de fases. No inventa tareas nuevas: si falta algo, lo propone al humano como cambio de plan.
- **Desarrollador (agente):** no lee este documento completo. Lee `CLAUDE.md`, su ticket y los documentos que el ticket referencia.
- Los 27 temas de contenido están especificados en `docs/CURRICULUM.md`. Cada uno es un ticket `T-m.n`.

Documentos relacionados: `ARCHITECTURE.md`, `STANDARDS.md`, `CONTENT-STANDARDS.md`, `GLOSSARY.md`, `ROBOT-SPEC.md`, `WIDGETS.md`, `DESIGN-BRIEF.md` (y `DESIGN.md` cuando D-01 esté hecho), `DEFINITION-OF-DONE.md`, `CURRICULUM.md`, `adr/`, `templates/`.

## 1. Visión y alcance

**Visión.** Plataforma web open source, en español, donde estudiantes de ingeniería aprenden matemática, física y mecánica manipulando cada concepto, y donde cada tema termina aplicado a un robot que pueden simular y, si quieren, construir.

**El hilo.** Lo que distingue el producto no es "otra plataforma de cursos" ni "otro simulador": es que cada tema termina en "y así se calcula esto de *tu* robot". Las visualizaciones y los simuladores son el medio. Cualquier tema que no aterrice en el robot está mal diseñado.

**Para quién.**
- El estudiante de ingeniería (mecatrónica, eléctrica, mecánica, sistemas) que lleva las materias base y no ve para qué sirven.
- El docente que quiere dar clase con algo que se toque y que el robot del laboratorio tenga su gemelo en la plataforma.

**Qué resuelve.** La brecha entre "aprobé física y cálculo" y "puedo calcular, diseñar y controlar un robot".

**Qué NO es** (los agentes no construyen nada de esta lista):
- No es un LMS: no gestiona cursos, notas, calendarios ni entregas.
- No compite con Gazebo, Isaac Sim ni CoppeliaSim: precisión pedagógica, corre en el navegador.
- No es un CAD.
- No reemplaza al docente; lo equipa.

**Decisiones de producto (fijas para v1).**
| Decisión | Valor |
|---|---|
| Audiencia | Universitarios de ingeniería y docentes/instituciones |
| Modelo | Open source, comunidad. Código MIT, contenido CC BY-SA 4.0 |
| Idioma | Español primero; i18n en la arquitectura desde el día 1 |
| Nivel matemático | Universitario completo (vectores, cálculo, álgebra lineal). Se visualiza para entender, no para evitar |
| Control del robot en simuladores | Solo parámetros (sliders) en v1; el controlador es intercambiable para que en v2 entre código del estudiante |
| Modo aula | Entra en v1, mínimo: roles docente/estudiante, grupos por código de invitación, progreso del grupo |
| Perfil "Mi robot" | Entra en v1 desde el módulo 0 |
| Ruta 1 | Completa, 27 temas |
| Catálogo de brazos | Mínimo: SO-101 (LeRobot) + brazo plano didáctico de 2 GDL propio |
| Pista del seguidor | Editor por segmentos + pistas prediseñadas (sin importar foto) |
| Motor de física | Ninguno en v1: ambos simuladores son cinemáticos |
| Autoalojable | Sí, con `docker compose` |

**Versión 1 (alcance congelado).**
1. Ruta 1, *De la física al robot móvil*, 27 temas en 7 módulos.
2. Simulador móvil 2D: robot diferencial parametrizable, pista editable, sensores de línea, controladores integrados, instrumentación.
3. Simulador de brazo 3D: carga URDF, cinemática directa por articulación, marcos, matrices, espacio de trabajo, catálogo mínimo, importación de URDF propio.
4. Cuentas, progreso, perfil "Mi robot", robots guardados.
5. Modo aula mínimo.

**Visión completa (v2 en adelante, no se construye en v1):** cinemática inversa y dinámica con motor de física, celda o línea de producción, asistente que genera URDF desde medidas y GDL, código del estudiante como controlador (sandbox), pista importada desde foto, bilingüe, más rutas (brazo, control, sensores y estimación, electrónica, automatización), exportación a ROS 2, Web Worker para la simulación.

**Criterio de éxito de v1.** Un estudiante termina la ruta 1 y calcula la velocidad de su propio robot con datos reales; un docente da una clase completa usando la plataforma y ve el progreso de su grupo.

## 2. Mapa de contenidos

Detalle completo en `CURRICULUM.md`. Reglas de estructura en `CONTENT-STANDARDS.md`.

**Anatomía de un tema** (plantilla fija, 7 secciones): Gancho → Concepto → Fórmulas → Explora → Al robot → Verifica → Profundiza. Metadatos: prerrequisitos, objetivos, tiempo estimado, widgets usados.

**"Mi robot".** Perfil persistente (masa, radio de rueda, distancia entre ruedas, rpm del motor, reducción, encoder, sensores). Toda sección "Al robot" lo usa; en el módulo 6 ese mismo perfil es el que se simula. Es una instancia de `RobotSpec` (ver `ROBOT-SPEC.md`).

**Ruta 1 — De la física al robot móvil** (27 temas):

| Módulo | Temas |
|---|---|
| M0 Herramientas | 0.1 Unidades y magnitudes · 0.2 Vectores · 0.3 Derivada como razón de cambio |
| M1 Cinemática de la partícula | 1.1 MRU · 1.2 MRUA · 1.3 Caída libre · 1.4 Tiro parabólico |
| M2 Dinámica | 2.1 Leyes de Newton y cuerpo libre · 2.2 Fricción · 2.3 Torque |
| M3 Energía | 3.1 Trabajo y energía · 3.2 Potencia |
| M4 Rotación | 4.1 Movimiento circular y ω · 4.2 v = ω·r, la velocidad del robot · 4.3 Aceleración angular y centrípeta · 4.4 Transmisión y reducción · 4.5 Encoders |
| M5 Robot diferencial | 5.1 Pose y marcos de referencia · 5.2 Cinemática directa · 5.3 Cinemática inversa · 5.4 Odometría · 5.5 Restricción no holonómica |
| M6 Seguidor de línea | 6.1 Sensor de línea · 6.2 Control on/off y proporcional · 6.3 PID · 6.4 Geometría vs desempeño · 6.5 Proyecto final |

**Rutas futuras (solo módulos, v2+):** Del plano al brazo robot · Control · Sensores y estimación · Electrónica del robot · Automatización.

**Referencias base** (el contenido cita capítulos de estos, no de blogs): Young & Freedman, *Física universitaria*; Serway & Jewett, *Física para ciencias e ingeniería*; Siegwart, Nourbakhsh & Scaramuzza, *Introduction to Autonomous Mobile Robots*; Craig, *Robótica*; Siciliano et al., *Robotics: Modelling, Planning and Control*; Corke, *Robotics, Vision and Control*; Åström & Murray, *Feedback Systems*.

## 3. Simuladores

**Principios del núcleo común** (una sola implementación para los 27 temas y los dos simuladores):
1. Un solo bucle de simulación: paso de tiempo fijo, determinista, con pausa, paso a paso, reinicio y velocidad de reproducción.
2. Un solo sistema de unidades: SI internamente, conversión solo en la interfaz.
3. Un solo esquema de robot: `RobotSpec` (JSON versionado). URDF se importa y se mapea a él. Nada dibuja ni simula desde un URDF crudo.
4. Sin motor de física en v1. Ambos simuladores son cinemáticos.
5. Un solo controlador intercambiable: `controller(sensors, state, params, dt) → commands`.

**Simulador móvil 2D (v1).**
- Modelo diferencial cinemático (ver `ARCHITECTURE.md` §sim-core para las ecuaciones).
- Parámetros desde "Mi robot": r, L, rpm máx, reducción, ticks del encoder, arreglo de sensores (N, separación, distancia al eje), rampa de aceleración.
- Sensores: línea (analógico y binario, ruido opcional con semilla), encoders cuantizados.
- Pista: editor por segmentos (recta, arco), ancho y color de línea; 4 prediseñadas: óvalo, S, curvas cerradas, cruce.
- Controladores integrados: manual (teclado), on/off, proporcional, PID.
- Instrumentación: trayectoria, gráficas en vivo (error, v, ω, términos PID), tiempo de vuelta, velocidad promedio, evento "perdió la línea".
- Fuera de alcance: colisiones, deslizamiento, varios robots, sensores de distancia.

**Simulador de brazo 3D (v1).**
- Carga URDF con mallas (STL, DAE, OBJ) desde zip o catálogo; tipos revolute, continuous, prismatic, fixed; límites respetados.
- Cinemática directa: slider por articulación, marcos por eslabón, posición y orientación del efector en vivo, matriz homogénea visible.
- Espacio de trabajo por muestreo.
- Importación validada; el robot importado se guarda en la cuenta.
- Fuera de alcance: cinemática inversa, gravedad, colisiones, pinza funcional, celda.

**Catálogo de brazos.** Criterios de entrada: URDF oficial o mantenido, licencia abierta verificable en hardware y software, documentación de armado, BOM con links, costo total publicado. v1: SO-101 (LeRobot / TheRobotStudio) y el brazo plano de 2 GDL propio. Candidatos documentados para v2: HELENE, reBot-DevArm (Seeed), ElRobot, PAROL6, BCN3D Moveo. Descartado: Arctos (CAD de pago).

**Biblioteca de widgets.** Los temas no crean simuladores propios: componen widgets del catálogo (`WIDGETS.md`). El catálogo se construye antes que los temas.

## 4. Arquitectura (resumen)

Detalle en `ARCHITECTURE.md` y `adr/`.

- Monorepo pnpm: `packages/sim-core` (TS puro, sin DOM), `packages/robot-spec`, `packages/widgets` (React), `packages/sims`, `content/es/`, `catalog/`, `apps/web` (Astro + islas React), `supabase/` (migraciones, políticas), `infra/`.
- Frontend: Astro para páginas y MDX; islas React para widgets y simuladores; estado compartido con nanostores; three.js + React Three Fiber + drei + urdf-loader; Canvas 2D y SVG; uPlot; KaTeX; i18next; Tailwind.
- Backend: Supabase (Postgres, Auth, Storage, RLS). Contenido y catálogo no viven en la base: viven en el repo ("currículo como código").
- Calidad: Vitest con valores dorados analíticos, Testing Library, Playwright (e2e y regresión visual), CI bloqueante.
- Despliegue: sitio estático en Cloudflare (Workers static assets) con dominio de Namecheap apuntando a Cloudflare, más proyecto Supabase (Pro al lanzar); autoalojado con `docker compose`. Detalle en F7-05b.

## 5. Estándares y flujo de agentes (resumen)

Detalle en `STANDARDS.md`, `DEFINITION-OF-DONE.md`, `CLAUDE.md`, `templates/`.

- Regla número uno: **si no está en `docs/`, no existe.** Un agente no inventa alcance ni arquitectura. Ante un vacío, abre un issue "spec gap" y se detiene.
- Un ticket = un PR. `main` protegida. Conventional Commits. Squash merge.
- Tablero: Backlog → Ready → En progreso → QA → Auditoría → Done.
- Roles: orquestador (modelo fuerte, nunca codifica), desarrollador (económico), QA (económico, verifica contra la spec, no arregla), auditor de código (medio), auditor de coherencia (fuerte, por módulo), seguridad (medio, todo PR que toque auth, base o subidas), humano (gate de infra, config, secretos, migraciones y docs; califica cada PR).
- El humano mergea solo PRs críticos: infra, auth, base, docs. El resto lo mergea el orquestador tras QA y auditoría aprobadas.
- Idiomas: código, identificadores y commits en inglés; documentación del proyecto y contenido en español.

## 6. Fases y backlog

Convenciones: `ID · Título · tipo · tamaño`. Tamaños: S (≤ 2 h de agente), M (≤ medio día), L (≤ 1 día; se divide si excede). Cada tarea incluye: depende de, lee, entregables, spec, aceptación, fuera de alcance. Lo que no se lista como entregable no se toca.

Orden de fases: F0 → F1 → F2 → (F3 ∥ F4 ∥ F5) → F6 → F7. Los temas de F6 se pueden paralelizar en cuanto sus widgets existan; el módulo 5 y 6 dependen de F4.

**Puntos de control humanos.** Tickets que no ejecuta un agente: el orquestador avisa al humano al llegar a ellos y bloquea sus dependientes.

| Ticket | Qué hace el humano | Bloquea |
|---|---|---|
| D-01 | Diseña el sistema visual en Claude Design con `DESIGN-BRIEF.md` y aprueba las 6 pantallas — **hecho** | F0-04 y toda la fase F2 |
| D-02 | Maquetas móviles de 3 pantallas | F2-13, F4-02 |
| F0-07, F0-08, F3-02, F7-03, F7-05b, F7-06 | Revisa y mergea (críticos) | sus dependientes |
| C-M0 … C-M6 | Lee el informe de coherencia y aprueba el módulo | publicación del módulo |
| F7-04 | Aprueba el informe de QA global | F7-06 |

### Fase 0 — Fundaciones

#### F0-01 · Monorepo y herramientas base · infra · M
- Depende de: —
- Lee: `ARCHITECTURE.md` §estructura, `STANDARDS.md`
- Entregables: `package.json` raíz, `pnpm-workspace.yaml`, `tsconfig.base.json`, `.eslintrc.cjs`, `.prettierrc`, `.editorconfig`, `.gitignore`, `.nvmrc`, `LICENSE` (MIT), `LICENSE-CONTENT` (CC BY-SA 4.0), `README.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, carpetas vacías con `package.json` de cada paquete.
- Spec: Node LTS actual fijado en `.nvmrc`; pnpm workspaces con `apps/*`, `packages/*`; TypeScript `strict: true`, `noUncheckedIndexedAccess: true`; ESLint con typescript-eslint y reglas de `STANDARDS.md`; scripts raíz `dev`, `build`, `test`, `lint`, `typecheck`, `format`. Versiones de dependencias fijadas (sin `^`).
- Aceptación: `pnpm install && pnpm lint && pnpm typecheck && pnpm test` pasan con paquetes vacíos; README explica cómo arrancar en 5 comandos.
- Fuera de alcance: cualquier código de aplicación.

#### F0-02 · CI en GitHub Actions · infra · S
- Depende de: F0-01
- Lee: `STANDARDS.md` §CI
- Entregables: `.github/workflows/ci.yml`
- Spec: en cada PR y en `main`: install con caché de pnpm, `lint`, `typecheck`, `test`, `build`. Jobs paralelos donde sea posible. Falla si cualquiera falla.
- Aceptación: un PR de prueba muestra los checks; `main` exige que pasen (documentar la configuración de branch protection en `docs/ops/BRANCH-PROTECTION.md` para que el humano la aplique).
- Fuera de alcance: despliegue.

#### F0-03 · Plantillas de GitHub y etiquetas · infra · S
- Depende de: F0-01
- Lee: `templates/`, `DEFINITION-OF-DONE.md`
- Entregables: `.github/PULL_REQUEST_TEMPLATE.md`, `.github/ISSUE_TEMPLATE/task.md`, `.github/ISSUE_TEMPLATE/spec-gap.md`, `.github/ISSUE_TEMPLATE/bug.md`, `.github/labels.yml`, `docs/ops/LABELS.md`.
- Spec: copiar las plantillas de `docs/templates/` adaptando el formato de GitHub. Etiquetas: `type:infra|core|widget|sim|content|qa|docs`, `module:M0..M6`, `size:S|M|L`, `status:ready|blocked|qa|audit`, `spec-gap`, `security`.
- Aceptación: al crear un issue aparecen las plantillas; el script o documento de etiquetas está listo para aplicar.

#### D-01 · Diseño visual y sistema de diseño · docs · M — **PUNTO DE CONTROL HUMANO** — **ESTADO: DONE (2026-09-14)**, ver `design/D-01-REVIEW.md`
- Quién: **el humano, en Claude Design**, no un agente del equipo. Cuando el orquestador llega a este ticket, notifica al humano ("D-01 listo para diseñar; F0-04 bloqueado hasta que esté en Done") y no avanza F0-04 ni ningún ticket de `widget`.
- Depende de: F0-01
- Lee: `DESIGN-BRIEF.md` (el brief se pega tal cual en Claude Design)
- Entregables: `docs/DESIGN.md` (principios, paleta con justificación de psicología del color, tipografía, escala de espaciado, componentes base con estados, reglas de claro/oscuro), `apps/web/src/styles/tokens.css` (variables CSS con los nombres de `DESIGN-BRIEF.md` §7), maquetas exportadas en `docs/design/` para las 6 pantallas del brief, en claro y oscuro.
- Aceptación: contraste AA verificado en toda la paleta (texto y controles); los tokens cubren todos los componentes base de `WIDGETS.md`; el humano aprueba las 6 pantallas.
- Fuera de alcance: implementación (la hace F0-04 y los tickets de widget).

#### D-02 · Maquetas móviles · docs · S — **PUNTO DE CONTROL HUMANO**
- Quién: el humano en Claude Design, reabriendo `docs/design/source/`.
- Depende de: D-01
- Entregables: `docs/design/07-tema-movil-claro.png`, `08-simulador-2d-movil-claro.png`, `09-ruta-movil-claro.png` (viewport 390 px) y la sección §9 de `DESIGN.md` actualizada con lo que las maquetas fijen (barra inferior de controles, acordeones, tabla con primera columna sticky).
- Aceptación: F2-13 y F4-02 pueden implementar el layout móvil sin preguntar.
- Bloquea: F2-13, F4-02 (no bloquea F0-04).

#### F0-04 · Armazón Astro · infra · L
- Depende de: F0-01, **D-01**
- Lee: `ARCHITECTURE.md` §frontend, §rutas, `DESIGN.md`, maquetas en `docs/design/`
- Entregables: `apps/web/` con Astro, integración React, Tailwind, `src/layouts/Base.astro`, `src/components/Nav.astro`, `src/styles/tokens.css` (copiado de D-01, sin modificar), páginas `index.astro`, `404.astro`, tema claro/oscuro con persistencia en `localStorage`.
- Spec: Tailwind consume exclusivamente los tokens de D-01 (colores, espaciado, tipografía, radios, sombras); fuentes Source Sans 3 y Source Code Pro autoalojadas en `apps/web/public/fonts/` (woff2, subconjuntos latín y griego con `unicode-range`, `font-display: swap`), sin CDN; layout y navegación según las maquetas de D-01; navegación: Inicio, Ruta, Simuladores, Brazos, Cuenta; contenido a máximo 72 caracteres de ancho de lectura; sin librería de componentes externa; ningún color ni tamaño literal fuera de `tokens.css`.
- Aceptación: `pnpm dev` levanta el sitio; comparación visual con las maquetas de inicio y 404 aprobada por el humano; Lighthouse accesibilidad ≥ 95 en inicio; cambio de tema funciona y persiste.
- Fuera de alcance: contenido real, auth, cambiar tokens (eso es un ticket de docs sobre `DESIGN.md`).

#### F0-05 · Content collections y rutas de tema · infra · M
- Depende de: F0-04
- Lee: `ARCHITECTURE.md` §contenido, `CONTENT-STANDARDS.md` §frontmatter
- Entregables: `apps/web/src/content.config.ts` (esquema zod del frontmatter de tema y de ruta), `src/pages/ruta/[ruta]/index.astro`, `src/pages/ruta/[ruta]/[modulo]/[tema].astro`, `content/es/ruta-1/ruta.json`, un tema de ejemplo `content/es/ruta-1/m00-t01/index.mdx` con contenido placeholder.
- Spec: la ruta `/ruta/ruta-1/m04/t02` renderiza `content/es/ruta-1/m04-t02/index.mdx`; el índice de ruta lista módulos y temas desde `ruta.json` con estado de progreso placeholder; navegación anterior/siguiente calculada desde el orden de `ruta.json`.
- Aceptación: el tema de ejemplo renderiza con layout; frontmatter inválido rompe el build con mensaje claro.

#### F0-06 · i18n · infra · S
- Depende de: F0-04
- Lee: `STANDARDS.md` §i18n
- Entregables: `packages/i18n/` con i18next configurado, `locales/es/common.json`, helper `t()` para Astro y hook `useT()` para React, `docs/ops/I18N.md`.
- Spec: idioma por defecto `es`; toda cadena de interfaz por clave; regla ESLint personalizada o convención documentada que prohíbe literales de UI en `packages/widgets`.
- Aceptación: la navegación y páginas de F0-04 usan claves; test que falla si una clave usada no existe.

#### F0-07 · Esquema Supabase y RLS · infra · L (crítico: mergea humano)
- Depende de: F0-01
- Lee: `ARCHITECTURE.md` §datos, §seguridad
- Entregables: `supabase/config.toml`, `supabase/migrations/0001_schema.sql`, `supabase/migrations/0002_rls.sql`, `supabase/migrations/0003_functions.sql`, `supabase/seed.sql`, `packages/db/` con tipos generados y cliente tipado, `docs/ops/SUPABASE.md`.
- Spec: tablas y políticas exactamente como `ARCHITECTURE.md` §datos; función `join_group(invite_code)` con `security definer`; trigger que crea `profiles` al registrarse; bucket privado `urdf` con política por dueño y límite de 20 MB.
- Aceptación: `supabase start` local aplica migraciones; tests SQL o script que verifica que un estudiante no puede leer progreso ajeno ni el código de otro grupo; tipos generados compilan.
- Fuera de alcance: UI.

#### F0-08 · Autenticación y sesión · infra · M (crítico: mergea humano)
- Depende de: F0-04, F0-06, F0-07
- Lee: `ARCHITECTURE.md` §auth
- Entregables: `packages/auth/` (cliente supabase-js, store de sesión con nanostores, `useSession()`), páginas `/auth/login`, `/auth/registro`, `/auth/recuperar`, `/cuenta`, componente `AuthGate`.
- Spec: email + contraseña y enlace mágico; selección de rol al registrarse (estudiante/docente); sesión persistente; `AuthGate` muestra CTA de registro en lugar de bloquear el contenido (el contenido es público; solo el progreso requiere cuenta).
- Aceptación: e2e Playwright: registro → verificación simulada → login → `/cuenta` muestra rol; logout limpia el store.

#### F0-09 · Documentación en el repo y CLAUDE.md · docs · S (crítico: mergea humano)
- Depende de: F0-01
- Entregables: `docs/` con todos los documentos de este plan, `CLAUDE.md` en la raíz, `docs/adr/`.
- Aceptación: enlaces internos válidos (script `pnpm docs:check`).

### Fase 1 — sim-core y robot-spec

#### F1-01 · RobotSpec v1 · core · M
- Depende de: F0-01
- Lee: `ROBOT-SPEC.md`, `GLOSSARY.md`
- Entregables: `packages/robot-spec/src/schema.ts` (zod), `src/index.ts`, `src/examples/` (un móvil, un brazo plano 2 GDL), `src/migrate.ts` (v1 → v1 identidad, estructura lista para futuras), tests.
- Spec: esquema exactamente como `ROBOT-SPEC.md`; `parseRobotSpec(unknown) → Result<RobotSpec, ValidationError[]>` con mensajes en español legibles por usuario (claves i18n).
- Aceptación: ejemplos validan; 10 casos inválidos producen el error esperado; snapshot del JSON Schema exportado.

#### F1-02 · Bucle de simulación · core · M
- Depende de: F0-01
- Lee: `ARCHITECTURE.md` §sim-core
- Entregables: `packages/sim-core/src/loop/Simulation.ts`, `src/loop/Clock.ts`, `src/random/SeededRng.ts`, tests.
- Spec: `interface Model<S, I> { init(seed): S; step(state: S, input: I, dt_s: number): S }`; `Simulation` con acumulador de tiempo fijo (`dt_s` configurable, default 0.001), `play/pause/step/reset/setSpeed(0.25–4)`, `subscribe(listener)`; sin `requestAnimationFrame` dentro (el driver de render es externo). RNG mulberry32 o xoshiro con semilla `number`.
- Aceptación: 1000 pasos con la misma semilla producen estados idénticos; `setSpeed(2)` duplica pasos por segundo real en test con reloj falso.

#### F1-03 · Integradores y matemática base · core · M
- Depende de: F1-02
- Lee: `GLOSSARY.md`
- Entregables: `packages/sim-core/src/math/vec2.ts`, `vec3.ts`, `mat4.ts` (homogéneas), `angles.ts` (`wrapPi`, `deg↔rad`), `integrators.ts` (Euler, RK4), `units.ts` (`rpmToRadps`, etc.), tests.
- Spec: funciones puras, sin clases mutables; `mat4` con `multiply`, `fromRpy(roll, pitch, yaw)` según convención URDF (R = Rz·Ry·Rx), `fromAxisAngle`, `translate`, `transformPoint`.
- Aceptación: tests contra valores conocidos (rotación 90°, composición de dos traslaciones, `wrapPi(3π) = π` o `−π` documentado).

#### F1-04 · Modelo diferencial cinemático · core · M
- Depende de: F1-01, F1-02, F1-03
- Lee: `ARCHITECTURE.md` §sim-core (ecuaciones), `GLOSSARY.md`
- Entregables: `packages/sim-core/src/mobile/diffDrive.ts`, `src/mobile/encoders.ts`, tests.
- Spec: entrada `{ omegaL_radps, omegaR_radps }`; saturación a `±omegaMax` donde `omegaMax = rpmToRadps(maxMotorSpeed_rpm) / gearRatio`; rampa `maxAccel_radps2` opcional; `vL = ωL·r`, `vR = ωR·r`, `v = (vR+vL)/2`, `ω = (vR−vL)/L`; integración exacta de arco; estado `{ x_m, y_m, theta_rad, v_mps, omega_radps, wheelAngleL_rad, wheelAngleR_rad, t_s }`; encoders: `ticks = floor(wheelAngle/(2π) · ticksPerRev)`; funciones `forwardKinematics(ωL, ωR, spec)` e `inverseKinematics(v, ω, spec)` exportadas por separado para los temas 5.2 y 5.3.
- Aceptación (valores dorados): `ωL = ωR` → línea recta, `θ` constante; `ωL = −ωR` → `x, y` no cambian; `vR = 2vL` → círculo de radio `R = (L/2)·(vR+vL)/(vR−vL)`, y tras una vuelta completa la pose vuelve al inicio con error < 1e-6 m.

#### F1-05 · Pista · core · M
- Depende de: F1-03
- Lee: `ARCHITECTURE.md` §pista
- Entregables: `packages/sim-core/src/track/Track.ts`, `src/track/presets.ts`, `src/track/serialize.ts`, tests.
- Spec: segmentos `{ type: 'line', from, to } | { type: 'arc', center, radius_m, startAngle_rad, endAngle_rad, ccw }`; `lineWidth_m`; `distanceToCenterline(p)`; `reflectance(p, footprint_m)` en `[0, 1]` (1 sobre la línea, transición lineal en el borde); `length_m`; `pointAt(s)`; presets: óvalo, S, curvas cerradas (radio mínimo 0.15 m), cruce; serialización JSON con versión.
- Aceptación: `reflectance` en el centro = 1, a `lineWidth/2 + footprint` = 0; las 4 presets cargan y su longitud coincide con el cálculo analítico ±1 mm.

#### F1-06 · Sensores de línea y controladores integrados · core · M
- Depende de: F1-04, F1-05
- Lee: `ARCHITECTURE.md` §sensores, §controlador
- Entregables: `packages/sim-core/src/sensors/lineArray.ts`, `src/control/Controller.ts` (interfaz), `src/control/onOff.ts`, `src/control/proportional.ts`, `src/control/pid.ts`, `src/control/manual.ts`, tests.
- Spec: posición del sensor `k` en el marco del robot `(forwardOffset_m, spacing_m·(k − (N−1)/2))`, índice 0 el más a la izquierda; lectura analógica `[0,1]` con ruido gaussiano opcional (σ configurable, RNG con semilla); binaria con umbral; `linePosition ∈ [−1, 1]` por promedio ponderado (negativo = línea a la izquierda); `lineLost` cuando la suma < umbral, manteniendo el último signo. Interfaz `Controller<P> { params: P; reset(); update(reading, state, dt_s) → { omegaL_radps, omegaR_radps } }`. PID: `u = Kp·e + Ki·∫e·dt + Kd·de/dt`, `ωL = ωbase + u`, `ωR = ωbase − u`, anti-windup por saturación del integrador.
- Aceptación: en recta con desplazamiento inicial de 1 cm el PID con ganancias de referencia converge a `|e| < 0.05` en < 1 s simulado; on/off oscila (test que verifica cambio de signo periódico).

#### F1-07 · Cinemática de partícula y energía · core · M
- Depende de: F1-03
- Lee: `CURRICULUM.md` M1 y M3 (fórmulas), `GLOSSARY.md`
- Entregables: `packages/sim-core/src/physics/kinematics1d.ts`, `src/physics/projectile.ts`, `src/physics/energy.ts`, `src/physics/friction.ts`, tests.
- Spec: soluciones analíticas (`positionMRUA`, `projectileState(t)`, `range`, `maxHeight`, `timeOfFlight` con altura inicial `h`), modelo paso a paso para animación (`ProjectileModel` implementa `Model`), energía cinética/potencial/mecánica, aceleración máxima sin deslizar `a_max = μ_s·g`, pendiente máxima `tan(φ) = μ_s`, torque a fuerza `F = τ/r`, `g = 9.81`.
- Aceptación: analítico vs paso a paso coinciden con error < 1e-4 en alcance para dt = 1 ms; valores dorados de los ejercicios de `CURRICULUM.md` M1–M3.

#### F1-08 · Cadenas seriales y cinemática directa · core · L
- Depende de: F1-01, F1-03
- Lee: `ROBOT-SPEC.md` §arm, `ARCHITECTURE.md` §brazo
- Entregables: `packages/sim-core/src/arm/forwardKinematics.ts`, `src/arm/workspace.ts`, `src/arm/jacobianNumeric.ts`, tests.
- Spec: `T_child = T_parent · T_origin(xyz, rpy) · T_joint(q)`; revolute/continuous: rotación sobre `axis` por `q`; prismatic: traslación sobre `axis` por `q`; fixed: identidad; `forwardKinematics(spec, q) → Map<linkName, mat4>`; `endEffectorPose(spec, q) → { position_m, rpy_rad, T }`; `sampleWorkspace(spec, n, rng) → Float32Array` de puntos; jacobiano numérico por diferencias finitas.
- Aceptación: brazo plano 2 GDL con `l1 = 0.2, l2 = 0.15`: `q = (0, 0)` → `(0.35, 0)`; `q = (π/2, 0)` → `(0, 0.35)`; `q = (π/2, −π/2)` → `(0.15, 0.20)`; error < 1e-9. Límites de articulación fuera de rango producen error.

#### F1-09 · Lector URDF → RobotSpec · core · L
- Depende de: F1-01, F1-08
- Lee: `ROBOT-SPEC.md` §urdf, `ARCHITECTURE.md` §brazo
- Entregables: `packages/sim-core/src/urdf/parseUrdf.ts`, `src/urdf/validate.ts`, fixtures `test/fixtures/so101/`, `test/fixtures/planar2dof/`, tests.
- Spec: parser sobre `DOMParser` (navegador) con adaptador para Node en tests; extrae links, joints (tipo, parent, child, origin, axis, limits), mallas (ruta relativa, escala), `base_link` detectado como el link sin padre; errores con código y clave i18n (`urdf.noRoot`, `urdf.cycle`, `urdf.missingLink`, `urdf.unsupportedJoint` para floating/planar); `package://` se resuelve al zip raíz.
- Aceptación: el URDF del SO-101 parsea a un `RobotSpec` válido con el número de joints esperado; 8 URDF inválidos producen los códigos esperados; FK del spec parseado coincide con el planar de F1-08.

#### F1-10 · Motor de ejercicios · core · M
- Depende de: F1-02
- Lee: `CONTENT-STANDARDS.md` §ejercicios
- Entregables: `packages/sim-core/src/exercises/defineExercise.ts`, `src/exercises/check.ts`, `src/exercises/format.ts`, tests.
- Spec: `defineExercise({ id, generate(rng) → { values, answer, unit }, statement: (values) → string con claves i18n e interpolación, tolerance: { type: 'relative' | 'absolute', value } })`; `check(exercise, seed, response) → { correct, expected, relError }`; formato de números con cifras significativas (3 por defecto) y unidad; respuestas vectoriales (`number[]`).
- Aceptación: la misma semilla produce los mismos valores; tolerancia relativa 2 % acepta 1.019·x y rechaza 1.021·x.

### Fase 2 — Widgets

Todos los widgets siguen `WIDGETS.md` (API, props, eventos, demo aislada, captura) y se estilizan solo con los tokens y componentes base de `DESIGN.md` (D-01). Cada uno registra sus textos en `locales/es/widgets.json`.

#### F2-01 · ParamPanel, Formula y Plot · widget · L
- Depende de: F0-04, F0-06, F1-02
- Entregables: `packages/widgets/src/ParamPanel/`, `src/Formula/` (KaTeX), `src/Plot/` (uPlot), `apps/web/src/pages/dev/widgets.astro` (playground con todos los widgets), tests, capturas.
- Spec: `ParamPanel` recibe una lista de `{ key, label, unit, min, max, step, value }` y emite cambios; muestra valor con unidad; teclado y lector de pantalla. `Formula` renderiza LaTeX en bloque o en línea, con resaltado opcional de una variable. `Plot` acepta series estáticas o un buffer en vivo (ring buffer de N puntos), ejes con unidades, leyenda, líneas de referencia.
- Aceptación: capturas de regresión; `Plot` mantiene 60 fps con 4 series de 2000 puntos actualizadas a 60 Hz (test de rendimiento manual documentado).

#### F2-02 · Scene2D · widget · L
- Depende de: F2-01
- Entregables: `packages/widgets/src/Scene2D/` (Canvas 2D), primitivas: grid, ejes, `Vector`, `Trace`, `Body` (círculo, rectángulo, robot desde `RobotSpec`), `Text`, transformación m → px con zoom y centrado; hook `useSimulationDriver(sim)` que enlaza `Simulation` con `requestAnimationFrame`.
- Spec: API declarativa (`<Scene2D worldWidth_m={2}> <Vector from to color label/> </Scene2D>`); coordenadas físicas en metros con Y hacia arriba; hi-DPI.
- Aceptación: captura de regresión con vectores y trazas; `useSimulationDriver` pausa al perder foco de pestaña.

#### F2-03 · VectorWidget y FreeBodyWidget · widget · M
- Depende de: F2-02
- Spec: `VectorWidget`: suma y componentes de 2 vectores arrastrables, muestra magnitud, ángulo y producto escalar. `FreeBodyWidget`: cuerpo con fuerzas editables (magnitud y ángulo), resultante, opcional plano inclinado con `φ`.
- Aceptación: valores dorados de `CURRICULUM.md` 0.2 y 2.1; capturas.

#### F2-04 · KinematicsWidget · widget · M
- Depende de: F2-01, F2-02, F1-07
- Spec: partícula 1D con `x0, v0, a`; gráficas `x–t`, `v–t`, `a–t` sincronizadas con la animación; marcador de tiempo arrastrable; modo "pendiente" que dibuja la tangente en `x–t` y muestra su valor igual a `v`.
- Aceptación: capturas; el valor de la tangente coincide con `v(t)` ±1 %.

#### F2-05 · ProjectileWidget · widget · M
- Depende de: F2-01, F2-02, F1-07
- Spec: `v0, α, h` editables; trayectoria con trazas cada 0.1 s; vectores `v`, `vx`, `vy` en el punto actual; modo caída libre (`v0 = 0` horizontal, solo `h`); modo "soltado desde robot en movimiento" (`vx = v_robot`, `vy0 = 0`); panel con alcance, altura máxima, tiempo de vuelo; opción de superponer dos lanzamientos.
- Aceptación: valores dorados de 1.3 y 1.4; capturas.

#### F2-06 · RotationWidget · widget · M
- Depende de: F2-01, F2-02
- Spec: disco o rueda con `ω` (entrada en rpm o rad/s), punto en el borde con vector `v = ω·r`, ángulo acumulado en rad y vueltas, período y frecuencia; modo "rueda sobre el suelo" que muestra el avance lineal del centro; modo aceleración angular `α`.
- Aceptación: valores dorados de 4.1–4.3; capturas.

#### F2-07 · EnergyWidget · widget · M
- Depende de: F2-01, F2-02, F1-07
- Spec: robot (bloque) en pista con tramo horizontal y rampa de ángulo `φ`; barras de `E_k`, `E_p`, `E_mec` en vivo; parámetros `m, v0, φ, μ` (fricción opcional que disipa); modo potencia: `P = τ·ω` y `P = V·I` con `η`, cálculo de autonomía en minutos desde `Wh`.
- Aceptación: sin fricción `E_mec` constante ±0.1 %; valores dorados de 3.1–3.2.

#### F2-08 · GearWidget · widget · S
- Depende de: F2-02
- Spec: dos engranajes con `z1, z2` editables; relación `i = z2/z1`; animación con sentidos correctos; panel `n_out = n_in / i`, `τ_out = τ_in · i · η`; modo tren de dos etapas.
- Aceptación: valores dorados de 4.4; capturas.

#### F2-09 · DiffDriveWidget · widget · L
- Depende de: F2-02, F1-04
- Spec: robot diferencial desde `RobotSpec` (o `useMyRobot()`), sliders `ωL, ωR` (o `v, ω` en modo inverso), muestra `v, ω, R`, centro instantáneo de rotación dibujado, trayectoria, marcos global y del robot con toggle, modo odometría (integra desde ticks cuantizados y muestra la pose estimada vs real con error). Es el mini simulador de M5.
- Aceptación: valores dorados de 5.1–5.4; capturas.

#### F2-10 · ExerciseWidget · widget · M
- Depende de: F2-01, F1-10, F0-08
- Spec: enunciado con valores generados (semilla por usuario y tema, o aleatoria si no hay sesión), campo numérico con unidad, botón verificar, feedback (correcto / fuera por X %), contador de intentos, "nuevos valores"; si hay sesión, registra `attempts` y actualiza `progress` (lógica en `packages/progress`, F3-01; hasta entonces, usa un adaptador nulo).
- Aceptación: e2e: responder correctamente marca el ejercicio; sin sesión funciona sin guardar.

#### F2-11 · MyRobotWidget y useMyRobot · widget · M
- Depende de: F1-01, F2-01, F0-08
- Spec: formulario del perfil móvil de `RobotSpec` (campos en `ROBOT-SPEC.md` §mobile) con validación y unidades; robot de ejemplo precargado ("robot de referencia", valores en `ROBOT-SPEC.md`); persistencia en `localStorage` y, con sesión, en la tabla `robots` (uno marcado como `is_default`); `useMyRobot()` devuelve el spec activo y se actualiza en vivo; widget compacto "Tu robot" que muestra los 4 datos clave y enlace a editar.
- Aceptación: e2e: editar el radio de rueda actualiza un `DiffDriveWidget` en la misma página sin recargar.

#### F2-12 · Scene3D base · widget · M
- Depende de: F2-01
- Spec: canvas de React Three Fiber con luces, grid, ejes, `OrbitControls` de drei, componente `Frame` (tríada XYZ con etiqueta), carga perezosa (`client:visible`), tamaño responsive, fondo según tema.
- Aceptación: carga solo en páginas que lo usan (verificar en build que three no entra en el bundle de temas 2D); captura.

#### F2-13 · Componentes MDX y layout de tema · widget · M
- Depende de: F0-05, F2-01, F2-10, D-02
- Spec: componentes `Gancho`, `Concepto`, `Formulas`, `Explora` (con `Experimento` hijos), `AlRobot`, `Verifica` (lista de `ExerciseWidget`), `Profundiza` (lista de referencias con formato fijo); mapa MDX que los expone; layout de tema con título, tiempo estimado, prerrequisitos, barra de progreso de la ruta, anterior/siguiente, índice lateral de secciones.
- Aceptación: el tema de ejemplo de F0-05 usa las 7 secciones; el build falla si un tema omite una sección obligatoria (verificación en `content.config.ts` o script `pnpm content:check`).

### Fase 3 — Cuenta, progreso y aula

#### F3-01 · Servicio de progreso · sim · M
- Depende de: F0-07, F0-08, F2-10
- Entregables: `packages/progress/` (`recordAttempt`, `getProgress`, `markCompleted`, store), integración en `ExerciseWidget` y en el índice de ruta.
- Spec: un tema se marca `completed` cuando todos sus ejercicios obligatorios han sido respondidos correctamente al menos una vez; `best_score` = fracción de ejercicios correctos al primer intento; el índice de ruta muestra pendiente / en curso / completado; sin sesión, progreso en `localStorage` con aviso "crea una cuenta para guardar".
- Aceptación: e2e completo; RLS impide escribir progreso de otro usuario (test con dos usuarios).
- Estado: Done (#120).

#### F3-02 · Grupos, docente · sim · L (crítico: mergea humano)
- Depende de: F0-07, F0-08
- Entregables: páginas `/aula`, `/aula/[groupId]`, componentes de lista y tabla.
- Spec: docente crea grupo (nombre), recibe código de invitación de 8 caracteres, ve miembros, ve tabla tema × estudiante con estado, puede regenerar el código y quitar miembros; exporta CSV del progreso.
- Aceptación: e2e con un docente y dos estudiantes; un estudiante no puede abrir `/aula`.
- Estado: Done. Se ejecutó en dos partes: F3-02a (grupos, código de invitación y miembros, #121) y F3-02b (tabla tema × estudiante y exportación CSV, #122).

#### F3-03 · Unirse a grupo, estudiante · sim · S
- Depende de: F3-02
- Spec: página `/unirse` con campo de código que llama a `join_group`; en `/cuenta` lista de grupos con opción de salir; eliminación de cuenta con confirmación (borra datos propios).
- Aceptación: e2e; código inválido muestra error sin revelar existencia de grupos.
- Estado: Done (#123).

#### F3-04 · Robots guardados y subida de URDF · sim · M (seguridad revisa)
- Depende de: F0-07, F1-01, F1-09
- Spec: CRUD de robots en `/cuenta/robots`; subida de zip (≤ 20 MB) a Storage con validación en cliente (extensiones permitidas: `.urdf`, `.xacro` no, `.stl`, `.dae`, `.obj`, `.png`, `.jpg`), rechazo de rutas con `..`; parseo y validación con F1-09 antes de guardar; el `RobotSpec` resultante se guarda en `robots.spec` y el zip en `urdf/{user}/{robot}.zip`.
- Aceptación: zip válido del SO-101 se guarda y aparece en la lista; zip con traversal se rechaza; RLS impide leer archivos ajenos.
- Estado: Done (#124).

### Fase 4 — Simulador móvil 2D

#### F4-01 · Editor de pista · sim · L
- Depende de: F1-05, F2-02
- Spec: herramientas recta y arco por clic y arrastre, snap a extremos, edición de radio, ancho de línea, deshacer/rehacer, exportar/importar JSON, cargar preset, validación de continuidad (advertencia si hay huecos).
- Aceptación: crear un óvalo desde cero y guardarlo; capturas de las 4 presets.
- Estado: Done. Se ejecutó en dos partes: F4-01a (modelo puro de la pista, #125) y F4-01b (editor, #126).

#### F4-02 · Vista del simulador móvil · sim · L
- Depende de: F1-04, F1-06, F2-02, F2-11, F4-01, D-02
- Spec: página `/simuladores/movil`; robot desde `useMyRobot()` o selección de robot guardado; sensores dibujados con su lectura (color por intensidad); controles play/pause/step/reset/velocidad; selector de controlador con `ParamPanel` de sus parámetros (Kp, Ki, Kd, ωbase, umbral); posición inicial arrastrable sobre la pista.
- Aceptación: e2e: cargar preset óvalo, PID por defecto, el robot completa una vuelta sin perder la línea en < 60 s simulados.
- Estado: Done. Se ejecutó en dos partes: F4-02a (vista y controles, #127) y F4-02b (pose inicial, acordeones y barra inferior móvil, #128).

#### F4-03 · Instrumentación · sim · M
- Depende de: F4-02
- Spec: panel con `Plot` en vivo de error, `v`, `ω`, y términos P, I, D; trayectoria acumulada; cronómetro de vuelta (detección de paso por la línea de meta = punto de inicio de la pista); velocidad promedio de la última vuelta; evento "perdió la línea" que pausa y marca el punto.
- Aceptación: capturas; el tiempo de vuelta coincide con `length_m / v_promedio` ±2 %.
- Estado: en curso (#129). `v_promedio` es la longitud de la pista dividida por el tiempo de vuelta, con lo que la aceptación se cumple exacta; la tarjeta muestra además la distancia realmente recorrida (#170). La tolerancia no cambia.

#### F4-04 · Modo manual y robots de referencia · sim · S
- Depende de: F4-02
- Spec: controlador manual con teclado (flechas: ωbase y diferencia) y botones táctiles; 3 robots de referencia en `catalog/mobile/` (pequeño competitivo, educativo estándar, grande lento) con sus specs y una nota de origen.
- Aceptación: manual funciona con teclado y táctil; los 3 specs validan.
- Estado: Done (#130).

#### F4-05 · Guardar configuraciones y compartir · sim · S
- Depende de: F4-02, F3-04
- Spec: guardar `{ robotId, trackJson, controller, params }` en `localStorage` y, con sesión, en `robots.spec.simConfigs[]`; enlace compartible que codifica pista y parámetros en la URL (comprimido) para que un docente comparta una configuración.
- Aceptación: abrir el enlace reproduce la misma simulación (determinismo).
- Estado: Done (#131).

#### F4-06 · Pistas guardadas en la cuenta · sim · M (crítico: mergea humano; seguridad revisa)
- Depende de: F4-01b, F4-02b, F3-04, y el cambio de alcance en docs (#191)
- Entregables: `supabase/migrations/0006_tracks.sql` y `supabase/tests/tracks.sql` (pgTAP), `packages/db/src/types.ts` regenerado, el guardado del editor de pista y el grupo «Mis pistas» del selector de `/simuladores/movil`.
- Spec: «Guardar» con sesión pide un nombre en línea y hace `insert`/`update` en la tabla `tracks` de `ARCHITECTURE.md` §5.1; sin sesión guarda en un store local `trayectoria.tracks`. Los botones de archivo pasan a «Exportar JSON» / «Importar JSON». El selector de pista suma un grupo «Mis pistas» (las de la cuenta y las locales) junto a los presets; elegir una la carga y borrarla pide confirmación. El enlace compartido de F4-05 sigue llevando la pista embebida: compartir no depende de la cuenta.
- Aceptación: con sesión, guardar una pista, recargar la página y elegirla en «Mis pistas»; otro usuario no la ve (RLS del propietario, §5.2).
- Fuera de alcance: compartir pistas entre usuarios o con el grupo; pistas públicas.

### Fase 5 — Simulador de brazo 3D

#### F5-01 · Visor URDF con articulaciones · sim · L
- Depende de: F2-12, F1-09, F5-05 (planar y SO-101 en catálogo)
- Spec: página `/simuladores/brazo`; carga con `urdf-loader` desde `catalog/arms/{id}/`; slider por articulación con límites del spec; toggle de marcos por eslabón (`Frame` de F2-12); panel del efector con posición `(x, y, z)` y `rpy` en vivo calculados por `sim-core` (F1-08), no por three.
- Aceptación: e2e: cargar planar 2 GDL, poner `q = (90°, 0)`, el panel muestra `(0, 0.35, 0)`; test que compara la posición de `sim-core` con la del objeto three (< 1e-6).
- Estado: Done. Se ejecutó en dos partes: F5-01a (visor y sliders, #133) y F5-01b (paneles plegables en móvil, #134).

#### F5-02 · Panel de matrices · sim · M
- Depende de: F5-01
- Spec: vista opcional que muestra, por eslabón, `T_origin`, `T_joint(q)` y la acumulada `⁰T_i` con `Formula`, actualizadas en vivo, con la cadena de multiplicación explícita; resaltado del eslabón seleccionado en 3D.
- Aceptación: capturas; valores coinciden con F1-08.
- Estado: Done (#135).

#### F5-03 · Espacio de trabajo · sim · M
- Depende de: F5-01
- Spec: botón "calcular espacio de trabajo" que muestrea `n` configuraciones (n configurable, default 20 000) en lotes con barra de progreso sin bloquear la interfaz, y dibuja la nube de puntos con color por distancia a la base; toggle de visibilidad.
- Aceptación: planar 2 GDL produce un anillo de radios `|l1 − l2|` y `l1 + l2` (verificación numérica de los extremos).
- Estado: Done (#136).

#### F5-04 · Importar URDF propio · sim · M (seguridad revisa)
- Depende de: F5-01, F3-04
- Spec: en la página del simulador, "importar" abre el flujo de F3-04 y carga el resultado en el visor; errores de validación se muestran con la clave i18n correspondiente; robots guardados aparecen en el selector.
- Aceptación: e2e con el zip del SO-101.
- Estado: Done (#137).

#### F5-05 · Catálogo de brazos · content · M
- Depende de: F0-05, F1-09
- Entregables: `catalog/arms/so101/` (URDF y mallas del repositorio oficial, licencia y `ficha.json`), `catalog/arms/planar2dof/` (URDF creado por nosotros: `l1 = 0.20 m`, `l2 = 0.15 m`, dos revolute en Z, mallas simples generadas), páginas `/brazos` y `/brazos/[id]`.
- Spec: `ficha.json`: nombre, GDL, alcance, carga, costo aproximado, licencia de hardware y software, links (repositorio, planos, BOM, compra), fecha de verificación; página con foto (propia o con licencia compatible), ficha y botón "abrir en simulador".
- Aceptación: ambos parsean con F1-09; licencias copiadas al directorio; fichas validadas por esquema.
- Estado: Done (#132).

### Fase 6 — Contenido

27 tickets `T-0.1` … `T-6.5` especificados en `CURRICULUM.md`, más 7 auditorías de coherencia `C-M0` … `C-M6` (una al cerrar cada módulo, la ejecuta el auditor de coherencia con el modelo fuerte, produce `docs/audits/C-Mn.md` con hallazgos y tickets de refactor).

Dependencias de widgets por módulo: M0 → F2-03, F2-04, F2-06; M1 → F2-04, F2-05; M2 → F2-03, F2-07; M3 → F2-07; M4 → F2-06, F2-08, F2-09, F2-11; M5 → F2-09; M6 → F4 completo.

### Fase 7 — Integración y release

#### F7-01 · Accesibilidad · qa · M
- Spec: todos los widgets operables con teclado; contraste AA; `aria-label` en controles; foco visible; texto alternativo en escenas (resumen textual del estado, actualizado con `aria-live` a baja frecuencia).
- Aceptación: axe sin violaciones críticas en 5 páginas representativas.

#### F7-02 · Rendimiento · qa · M
- Spec: presupuesto por página de tema ≤ 250 kB de JS comprimido sin 3D; three solo en páginas 3D; imágenes optimizadas; Lighthouse rendimiento ≥ 90 en tema y ≥ 80 en simuladores en laptop de gama media.
- Aceptación: reporte en `docs/audits/PERF-v1.md`.

#### F7-03 · Autoalojado · infra · M (crítico: mergea humano)
- Entregables: `infra/docker-compose.yml` (web estático con Caddy + referencia al `docker compose` oficial de Supabase), `docs/ops/SELF-HOSTING.md` paso a paso para una universidad, variables de entorno documentadas.
- Aceptación: instalación desde cero en una VM limpia siguiendo solo el documento.

#### F7-04 · QA global · qa · L
- Spec: e2e de la ruta completa (registro → 27 temas con al menos un ejercicio cada uno → simulador móvil con "Mi robot" → docente ve el progreso); smoke en móvil (viewport 390 px); informe de defectos.
- Aceptación: `docs/audits/QA-v1.md` sin defectos bloqueantes abiertos.

#### F7-05 · Páginas públicas · content · M
- Spec: inicio con propuesta de valor y el hilo de la ruta; `/docentes` (cómo usarla en clase, modo aula, catálogo); `/contribuir` (cómo aportar contenido, robots y código; licencias); `/acerca`.
- Aceptación: textos revisados por el auditor de contenido.

#### F7-05b · Despliegue público · infra · M (crítico: mergea humano)
- Depende de: F0-02, F0-07, F7-03
- Lee: `ARCHITECTURE.md` §5.3
- Entregables: `apps/web/wrangler.jsonc` (assets → `./dist`, `not_found_handling: "404-page"`), `.github/workflows/deploy.yml` (en push a `main`: build y `wrangler deploy` con secreto `CLOUDFLARE_API_TOKEN`; en PR: despliegue de vista previa), `docs/ops/DEPLOY.md`.
- Spec: sitio en Cloudflare Workers con static assets (recomendación actual de Cloudflare para proyectos nuevos; Pages es alternativa aceptable si el humano la prefiere); dominio comprado en Namecheap con nameservers apuntando a Cloudflare, registro del dominio raíz y `www` con redirección a uno solo, SSL "Full (strict)"; Supabase en plan **Pro** desde el lanzamiento público (el plan gratuito pausa proyectos con poca actividad en 7 días); SMTP externo configurado en Supabase Auth para correos de registro y recuperación (el SMTP integrado es solo para desarrollo); plantillas de correo de auth en español; variables `PUBLIC_SUPABASE_URL` y `PUBLIC_SUPABASE_ANON_KEY` como variables de build en la Action; `DEPLOY.md` cubre: pasos exactos en Namecheap y Cloudflare, cómo rotar el token, cómo hacer rollback a un despliegue anterior, y checklist de lanzamiento.
- Aceptación: `https://<dominio>` sirve el sitio con certificado válido; un push a `main` despliega en < 5 min; un PR genera URL de vista previa; registro real de usuario recibe el correo en < 1 min; rollback probado.
- Fuera de alcance: analytics, dominio propio para la API de Supabase (innecesario).

#### F7-06 · Release v1.0.0 · infra · S (crítico: mergea humano)
- Depende de: F7-04, F7-05, F7-05b
- Spec: `CHANGELOG.md`, tag, despliegue de la instancia pública, anuncio en `README`.

## 7. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Los agentes divergen en estilo o notación | Auditor de coherencia por módulo; glosario y catálogo de widgets como fuentes de verdad; sufijos de unidad en variables |
| 27 temas son mucho contenido | Plantilla fija, widgets previos, specs pre-llenadas en `CURRICULUM.md`; se pueden paralelizar |
| URDF del SO-101 cambia o su licencia se aclara distinto | Se copia una versión fijada al catálogo con fecha de verificación; ficha con "verificado el" |
| Supabase autoalojado es pesado para una universidad | Documento paso a paso y compose probado en VM limpia (F7-03) |
| Rendimiento en laptops modestas | Presupuesto de JS, three solo donde se usa, sim-core sin DOM listo para Worker en v2 |
| Astro + islas confunde a agentes débiles | `ARCHITECTURE.md` §islas con reglas simples (`client:visible` por defecto, estado solo en nanostores) |

## 8. Decisiones abiertas (no bloquean v1)

- Nombre final del proyecto y dominio.
- Si el brazo plano 2 GDL tendrá una versión física recomendada (kit imprimible) en v1.1.
- Política de contribuciones de contenido externas antes de v1.0 (propuesta: cerradas hasta v1.0, abiertas después con la misma plantilla de tema).
