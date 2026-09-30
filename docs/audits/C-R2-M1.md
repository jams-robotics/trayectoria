# Auditoría de coherencia — C-R2-M1

2026-09-30 · auditor de coherencia · T2-1.1 Cinemática directa del robot diferencial (antes `ruta-1/m05-t02`, T-5.2), T2-1.2 Cinemática inversa del robot diferencial (antes `ruta-1/m05-t03`, T-5.3), T2-1.3 Odometría (antes `ruta-1/m05-t04`, T-5.4) y T2-1.4 Restricción no holonómica (antes `ruta-1/m05-t05`, T-5.5), todos `status: published` sobre `main` tras la reestructuración de rutas (#574).

## Método

Se leyeron completos `docs/CURRICULUM.md` (cabecera, «Estructura» y § T2-1.1 a T2-1.4), `docs/CONTENT-STANDARDS.md`, `docs/GLOSSARY.md` y `docs/WIDGETS.md` (incluida la maniobra en tres movimientos de `DiffDriveWidget`, #394). Se leyeron los cuatro `index.mdx`, `ejercicios.ts` y `alrobot.ts`, y se recalcularon con Node (`cr2-recalc-m0-m1.js`, scratchpad) los 20 valores dorados de la spec (v, ω, R y giro en el lugar de T2-1.1; ω_R, ω_L, e2, e3, comando rápido y ω_max/v_max de T2-1.2; arcos, paso, pose y error de radio/rumbo de T2-1.3; comandos de giro y avance y tiempo de maniobra de T2-1.4). Los 20 cuadran. `pnpm vitest run -- ruta-2` (54 archivos, 647 tests) y `pnpm content:check` (0 incumplimientos) ya se corrieron para todo el paquete en la sesión de M0 y siguen verdes. Se sirvieron las páginas de los cuatro temas y de `ruta-1/m01-t03`, `ruta-1/m01-t04` en `localhost:4411` (200 OK; servidor detenido al terminar).

Se cruzaron los issues #569-#573 y #550 contra M1.

## Hallazgos

No se encontró ningún hallazgo alto, medio ni bajo propio de M1 más allá de los heredados de #569 ya reportados en C-R2-M0 (que no vuelven a aparecer aquí porque no tocan estos cuatro temas salvo por la frase «no es un robot móvil», ver tabla de abajo).

## Verificación de la lista mínima

1. **Física.** Los 20 dorados recalculados en Node cuadran exactamente con la spec: T2-1.1 v = 0.56 m/s, ω = 1.067 rad/s, R = 0.525 m, giro en el lugar 4.267 rad/s, e4 = 8.533 rad; T2-1.2 ω_R = 16.02, ω_L = 8.98 rad/s, e2 = (0.2437, 0.3562) m/s, e3 = (3.333 rad/s, 0.075 m), comando rápido v_R = 0.75 m/s > v_max = 0.670 m/s (no realizable); T2-1.3 Δs_L = 0.2234, Δs_R = 0.2457, Δs = 0.2346 m, Δθ = 0.1489 rad, pose (0.2339, 0.01745), error de radio 0.3125 m en 10 m, error de rumbo −11.61°; T2-1.4 giro ±9.375 rad/s, avance 15.63 rad/s, tiempo de maniobra 1.185 s.
2. **Orden.** T2-1.1 declara `[ruta-1/m01-t04, ruta-2/m00-t02]` y no usa nada de T2-1.2 a T2-1.4 (que van después); su Explora es autocontenido con los tres casos límite (recta, giro en el lugar, pivote) sin depender de la inversa. T2-1.2 declara `[ruta-2/m01-t01, ruta-1/m01-t03, ruta-1/m01-t04]` e invierte correctamente las ecuaciones de T2-1.1, citando `ω_max` de T1-1.3 y `v_max` de T1-1.4 con enlace, sin recalcularlas. T2-1.3 declara `[ruta-2/m00-t01, ruta-2/m01-t01]` y aplica la cinemática directa a arcos en vez de velocidades, sin usar nada de T2-1.4. T2-1.4 declara `[ruta-2/m01-t01, ruta-2/m01-t02, ruta-1/m01-t03]` y cita `ω_max` de T1-1.3; no usa nada posterior. Sin violaciones de orden dentro de M1 ni hacia la ruta 1.
3. **Prerrequisitos.** Los cuatro frontmatter coinciden exactamente con la spec de `CURRICULUM.md`: T2-1.1 `[ruta-1/m01-t04, ruta-2/m00-t02]`, T2-1.2 `[ruta-2/m01-t01, ruta-1/m01-t03, ruta-1/m01-t04]`, T2-1.3 `[ruta-2/m00-t01, ruta-2/m01-t01]`, T2-1.4 `[ruta-2/m01-t01, ruta-2/m01-t02, ruta-1/m01-t03]`. Todos existen y van antes en su ruta o en la ruta que ruta-2 sigue.
4. **Notación/glosario.** v_L, v_R, ω, L, R, CIR (T2-1.1); ω_max, saturación (T2-1.2); Δs_L, Δs_R, Δθ, ángulo medio (T2-1.3); ẋ, ẏ, θ̇, restricción no holonómica (T2-1.4) coinciden con `GLOSSARY.md` §Robot diferencial y §Razón de cambio.
5. **Unidades.** Correctas en los cuatro temas: rad/s, m/s, m, rad, s, consistentes con el glosario.
6. **«Mi robot» sin duplicados.** T2-1.1 calcula `linear-velocity`, `angular-velocity`, `turn-radius` y `spin-angular-velocity` (primera vez, filas propias). T2-1.2 calcula `wheel-right`, `wheel-left`, `feasibility` y `fast-command`, citando `ω_max` (T1-1.3) y `v_max` (T1-1.4) sin `RobotFormula` propia (`index.mdx:122-134`). T2-1.3 calcula `wheel-arcs`, `step`, `pose` y `radius-error` (primera vez). T2-1.4 calcula `turn-command`, `forward-command` y `feasibility`, citando `ω_max` de T1-1.3 (`index.mdx:127`) y usando una `Formula` estática (no `RobotFormula`) para el tiempo de la maniobra, que no depende del perfil, tal como pide la spec. Sin duplicados.
7. **Props de widgets.** `DiffDriveWidget mode="forward"` (T2-1.1), `mode="inverse"` (T2-1.2), `mode="odometry"` (T2-1.3) y `mode="inverse"` con `maneuver` (T2-1.4) usan exactamente las props de `WIDGETS.md`, incluida la maniobra en tres movimientos (`turn_deg`, `distance_m`, valores por defecto de rapidez 1 rad/s y 0.2 m/s).
8. **Contradicciones entre documentos.** Ninguna. `WIDGETS.md`, `CURRICULUM.md` y el contenido coinciden.

## Hallazgos pendientes de #569–#573 y #550 (issues de GitHub, consolidado por el orquestador)

Ids previos a #574; mapeo a M1: `ruta-1/m05-t02` → T2-1.1, `ruta-1/m05-t03` → T2-1.2, `ruta-1/m05-t04` → T2-1.3, `ruta-1/m05-t05` → T2-1.4.

| Issue | Punto | Tema | Estado | Evidencia |
|---|---|---|---|---|
| #569.11 | Odometría (`m05-t04`): «el error de calibración crece con la distancia» solo vale para r; el error de L crece con el giro acumulado, y en una recta larga es cero | T2-1.3 | **Sigue sin corregirse del todo, pero matizado.** | `index.mdx:46-50` sigue generalizando «un error en L desvía el rumbo, y un rumbo desviado tuerce toda la posición que viene después», sin decir que en una recta pura (Δθ = 0) el error de L no aparece. El experimento 3 del Explora sí es específico (gira, no avanza recto) y el texto de «Al robot» solo trata el error de r, no generaliza el de L. El punto exacto del issue (frase que generaliza mal) sigue en el Concepto. | 
| #569.19 | «Si tu perfil de "Mi robot" no es un robot móvil» repetido sin explicarse una vez | T2-1.1 a T2-1.4 | **Sigue abierto**, igual que en M0 (ver `docs/audits/C-R2-M0.md`); aparece en los cuatro `alrobot.ts`/`index.mdx` de M1. | `index.mdx:138` (T2-1.1), `:127` (T2-1.2), `:135` (T2-1.3), `:131` (T2-1.4). |
| #571.10 | Prerrequisitos usados y no declarados: `m05-t05` (hoy T2-1.4) usa ẋ, ẏ sin declarar `m00-t03` (la derivada) | T2-1.4 | **Sigue abierto**, confirmado. | T2-1.4 usa notación de punto (ẋ, ẏ, θ̇) en `index.mdx:28` y en Fórmulas, y su frontmatter declara `[ruta-2/m01-t01, ruta-2/m01-t02, ruta-1/m01-t03]`, sin `ruta-1/m00-t03` (La derivada). El glosario documenta la notación de punto en §Razón de cambio, que es del tema de la derivada. |
| #572.1 | Odometría (`m05-t04`) cita `siegwart-4` («Perception»); la odometría está en el cap. 5, «Mobile Robot Localization», §5.2.4 | T2-1.3 | **Sigue abierto**, confirmado. | `CURRICULUM.md` § T2-1.3 y frontmatter de `index.mdx:14`: `references: [siegwart-3, siegwart-4]`, sin `siegwart-5`. |
| #573 (ROB-12) | Deducción de dos líneas para el ángulo medio en odometría: exacto en dirección, aproximado en longitud | T2-1.3 | **Parcialmente incorporado.** | El Concepto explica por qué el ángulo medio es más exacto que el inicial (`index.mdx:37-40`), pero no da la deducción de dos líneas de la sugerencia (que es exacto en dirección y aproximado en longitud, con el error de 0.2 mm del gancho). Sugerencia, no error; no bloquea. |
| #573 (MAT-18) | Deducción corta de la cinemática directa con el CIR: v_L = ω(R − L/2), v_R = ω(R + L/2) | T2-1.1 | **No incorporada.** | El Concepto de T2-1.1 deriva v, ω y R directamente de v_L y v_R (`index.mdx:26-45`), sin pasar por el CIR como en la sugerencia. Es una sugerencia pedagógica, no un error; el resultado final (R = v/ω) es el mismo y está correcto. |
| #550 | Números sin redondear expuestos al usuario | General | **No verificable en el contenido de M1.** | Los `alrobot.ts` de M1 formatean explícitamente con `toPrecision`/`toFixed` (p. ej. `RADPS_DECIMALS = 2` en T2-1.2, `SIGNIFICANT_FIGURES = 4` en T2-1.1, T2-1.3, T2-1.4), consistente con la corrección que pide #550. Sin evidencia de que M1 reproduzca el problema en el contenido; el hallazgo original apunta a `ControllerPanel.tsx` y `ExerciseWidget/seed.ts`, fuera de `content/`. |

## Deriva detectada entre módulos

Frente a C-R2-M0, M1 mantiene el mismo nivel y densidad de fórmulas (3-6 por tema). El estilo del Explora es consistente: tres experimentos con la forma «cambia → observa → por qué» en los cuatro temas. Un matiz nuevo en T2-1.4: el tercer experimento compara con una fórmula del texto en vez de con el widget puro («cumple la restricción» se verifica con el cálculo, no solo con la observación visual), coherente con el resto de la ruta y sin ser una desviación de tono.

## Recomendaciones para el orquestador

1. Ver recomendación 1 de `docs/audits/C-R2-M0.md` (frase repetida «no es un robot móvil»): aplica igual a M1.
2. `content/es/ruta-2/m01-t04/index.mdx`: declarar `ruta-1/m00-t03` (La derivada) como prerrequisito, dado que el tema usa notación de punto (ẋ, ẏ, θ̇) sin haberla presentado antes en su cadena de prerrequisitos declarados. Resuelve #571.10 para T2-1.4.
3. `content/es/ruta-2/m01-t03/index.mdx:46-50`: matizar la frase sobre el error de L, que hoy generaliza «tuerce toda la posición que viene después» sin decir que en un tramo recto (Δθ = 0) ese error no se manifiesta. Resuelve el punto exacto de #569.11 que sigue abierto.

## Para la validación del humano

| # | Tema | Qué vería distinto el estudiante | Origen |
|---|---|---|---|
| — | T2-1.4 | Un prerrequisito más en el pie del tema (La derivada), sin cambio de texto. | #571.10 |
| — | T2-1.3 | Una frase matizada sobre cuándo el error de L se nota. | #569.11 |

## Veredicto

**Módulo aprobado con tickets.** Sin hallazgos altos ni medios. Los pendientes son bajos o sugerencias heredadas de #569–#573, ninguno nuevo de la reestructuración; los 20 dorados recalculados cuadran, el orden y los prerrequisitos declarados son correctos salvo el matiz de T2-1.4, y no hay contradicciones entre documentos.
