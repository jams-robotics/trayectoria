# Auditoría de coherencia — C-R2-M0

2026-09-30 · auditor de coherencia · T2-0.1 Encoders (antes `ruta-1/m04-t05`, T-4.5) y T2-0.2 Pose y marcos de referencia (antes `ruta-1/m05-t01`, T-5.1), `status: published` sobre `main` tras la reestructuración de rutas (#574).

## Método

Se leyeron completos `docs/CURRICULUM.md` (cabecera §1-152, «Estructura», tabla «Qué añade cada tema a Mi robot» y § T2-0.1, T2-0.2), `docs/CONTENT-STANDARDS.md`, `docs/GLOSSARY.md` y `docs/WIDGETS.md`, y como referencia de formato `docs/audits/C-R1-M2.md` (rama `docs/C-R1-auditoria-ruta-1`). Se leyeron los dos `index.mdx`, `ejercicios.ts` y `alrobot.ts`, y se recalcularon con Node (`cr2-recalc-m0-m1.js`, scratchpad) los 16 valores dorados de la spec de M0 (resolución, ticks/m, e2 a e4 de T2-0.1; sensor central e izquierdo, e1 a e4 de T2-0.2). Los 16 cuadran. Se corrió `pnpm vitest run -- ruta-2` sobre todo el paquete `content` (54 archivos, 647 tests, todos verdes — incluye M1 y M2) y `pnpm content:check` (0 incumplimientos, 25 temas). Se sirvieron las 11 páginas de ruta-2 y 9 de ruta-1 citadas desde ruta-2 en `localhost:4411` (200 OK todas; servidor detenido al terminar).

Se cruzaron los issues #569-#573 y el contenido de #550, leídos con `gh issue view`, contra M0.

## Hallazgos

| # | Tema/archivo | Tipo | Descripción | Severidad | Ticket |
|---|---|---|---|---|---|
| 1 | ruta-2, todos los temas | estilo · redundancia | «Si tu perfil de "Mi robot" no es un robot móvil» (o equivalente) aparece en los 11 temas de ruta-2, incluidos T2-0.1 y T2-0.2, sin explicar una sola vez cómo un perfil podría no ser móvil (el formulario de «Mi robot» solo tiene campos de robot móvil en esta ruta). Es el hallazgo #569.19, sin resolver por la reestructuración. | baja | ver recomendaciones |

No se encontró ningún hallazgo alto ni medio en M0: sin error físico, sin dorado incorrecto, sin violación de orden, sin contradicción entre documentos.

## Verificación de la lista mínima

1. **Física.** Los 16 dorados recalculados en Node cuadran exactamente con la spec (T2-0.1: res = 0.5585 mm, 1790 ticks/m, e2 = 7.854 rad/s y 0.2513 m/s, e3 = 1790, e4 = 2.793 m; T2-0.2: sensor central (1.278, 0.545), sensor izquierdo (1.266, 0.5658), e4 = (0.4598, 0.1964)).
2. **Orden.** T2-0.1 declara prerrequisitos `ruta-1/m01-t04` (Rodadura, de donde cita `v = ω·r`) y `ruta-1/m00-t03` (la derivada, con enlace explícito); no usa nada de temas posteriores de su propia ruta: cita hacia adelante a T2-1.1 («Cinemática directa») sin usar su contenido, solo para decir que ahí se explica el caso de ruedas distintas. T2-0.2 declara `ruta-1/m00-t02` (Vectores) y usa exactamente el recuadro de rotación por componentes de ese tema, citado con enlace, sin recalcularlo; el enlace hacia adelante a Cinemática inversa del `PED-20` original («la ruta 2») ya no aparece: el texto dice «El simulador de brazo usa este mismo mecanismo en 3D» sin nombrar ninguna ruta, resolviendo el hallazgo #569.18. Sin violaciones.
3. **Prerrequisitos.** Frontmatter de T2-0.1: `[ruta-1/m01-t04, ruta-1/m00-t03]`, coincide con la spec. T2-0.2: `[ruta-1/m00-t02]`, coincide. Los dos existen y van antes en la ruta que ruta-2 sigue (regla 4 de `CURRICULUM.md`).
4. **Notación/glosario.** N_e, res, ticks, Δticks, θ, s, v (T2-0.1); {G}, {R}, (x, y, θ), p⃗_G, p⃗_R, p⃗_{R,0}, R(θ), θ_objetivo (T2-0.2) coinciden con `GLOSSARY.md` §Rotación y §Robot diferencial.
5. **Unidades.** Correctas: mm para resolución (con nota `#626` de por qué en mm, no en m), rad/s, m/s, m para posición.
6. **«Mi robot» sin duplicados.** T2-0.1 calcula `encoder-resolution` y `ticks-per-meter`, primera vez que se calculan en la plataforma (filas propias de «Mi robot»). T2-0.2 calcula `center-sensor` y `left-sensor`, también primera vez; cita la rotación por componentes de T1-0.2 sin `RobotFormula` propia. Sin duplicados.
7. **Props de widgets.** `DiffDriveWidget mode="odometry"` (T2-0.1) y `mode="forward"` (T2-0.2) usan exactamente las props de `WIDGETS.md`; el panel de odometría con `Δt` fijo de 0.1 s coincide con la nota `#567` del catálogo.
8. **Contradicciones entre documentos.** Ninguna. `WIDGETS.md`, `CURRICULUM.md` y el contenido coinciden.

## Hallazgos pendientes de #569–#573 y #550 (issues de GitHub, consolidado por el orquestador)

Ids previos a #574; mapeo a M0 vía la tabla de equivalencias de `CURRICULUM.md`: `ruta-1/m04-t05` → T2-0.1, `ruta-1/m05-t01` → T2-0.2.

| Issue | Punto | Tema | Estado | Evidencia |
|---|---|---|---|---|
| #569.10 | Encoders (`m04-t05`) está en Rotación pero su Explora es `DiffDriveWidget mode="odometry"` con ω_L, ω_R y «panel de odometría», seis temas antes de enseñarse | T2-0.1 | **Resuelto por la reestructuración.** | T2-0.1 ahora vive en `ruta-2/m00-t01`, Módulo 0 «Medir y ubicar» de Robot móvil, junto a Pose y marcos; ya no está en Rotación. El texto explica en una frase que las dos ruedas giran igual y enlaza hacia adelante a T2-1.1 para el caso general (`index.mdx:83-86`). |
| #569.18 | «La ruta 2 usa este mismo mecanismo en 3D»: no existe ruta 2 (era cierto antes de #574) | T2-0.2 | **Resuelto por la reestructuración.** | `index.mdx:55`: «El simulador de brazo usa este mismo mecanismo en 3D», sin nombrar ninguna ruta. Ahora sí existe ruta 2, pero el texto ya no la nombra explícitamente (decisión PED-20 de la spec). |
| #569.19 | «Si tu perfil de "Mi robot" no es un robot móvil» repetido sin explicarse una vez | T2-0.1, T2-0.2 | **Sigue abierto**, confirmado por grep: la frase (o equivalente) aparece en los 11 temas de ruta-2, incluidos los dos de M0 (`index.mdx:135`, `index.mdx:148` de T2-0.1 y T2-0.2 respectivamente). | 
| #571.10 | Prerrequisitos usados y no declarados: `m04-t05` usa dos ruedas y odometría sin declarar `m05-t02` (hoy T2-1.1) | T2-0.1 | **No aplica ya.** | La reestructuración movió T2-1.1 después de T2-0.1 en la ruta (M1 después de M0) y T2-0.1 ya no presupone cinemática directa: dice explícitamente que las dos ruedas giran igual y remite hacia adelante. No hay prerrequisito oculto. |
| #572.1 | Odometría (`m05-t04`, hoy T2-1.3) cita `siegwart-4` («Perception»); pertenece al cap. 5 | T2-1.3 (M1) | No aplica a M0. |
| #550 | Números sin redondear expuestos al usuario (slider «Velocidad base» con `max="20.943951..."`, enunciados con 4 decimales) | General (`ControllerPanel.tsx`, `ExerciseWidget/seed.ts`) | **No verificable en el contenido de M0.** | Es un hallazgo de UI/formato de `packages/sims` y `packages/widgets`, no de los MDX de M0. Ninguno de los dos temas de M0 muestra ese slider (`ω_max` en rueda no es un slider en T2-0.1 ni T2-0.2). Sin evidencia de que M0 lo reproduzca. |

Ningún hallazgo de #569–#573 relevante para M0 permanece sin marcar.

## Deriva detectada entre módulos

Frente al estilo de C-R1-M2 (mismo formato de informe), M0 de ruta-2 mantiene el mismo nivel, la misma densidad de fórmulas por tema (3-5) y el mismo estilo de gancho con números concretos. No se detecta deriva de tono entre Fundamentos y el inicio de Robot móvil: los dos temas de M0 abren con el mismo patrón de gancho-concepto-fórmulas-explora-al robot-verifica que M2 de ruta-1.

## Recomendaciones para el orquestador

1. `docs/CONTENT-STANDARDS.md` o `docs/CURRICULUM.md`: explicar una sola vez, en T1-0.1 o T2-0.1, cómo un perfil de «Mi robot» puede no ser un robot móvil (un perfil de brazo, sin campos de rueda), para no repetir la frase condicional en cada `alrobot.ts` sin contexto. Resuelve #569.19 de forma estructural en vez de tema por tema.

## Para la validación del humano

| # | Tema | Qué vería distinto el estudiante | Origen |
|---|---|---|---|
| 1 | Todos (M0 incluido) | Ninguno directamente; es una nota de redacción repetida sin explicación, no un error. | #569.19, pendiente desde 2026-09-26 |

## Veredicto

**Módulo aprobado.** Sin hallazgos altos ni medios. Un hallazgo bajo, heredado y ya conocido (#569.19), que no bloquea la publicación y cuya corrección es estructural (una frase en docs/), no de contenido de M0.
