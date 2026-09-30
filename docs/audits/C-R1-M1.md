# Auditoría de coherencia — C-R1-M1

2026-09-30 · auditor de coherencia · Módulo 1 — Cinemática de `ruta-1` (T1-1.1 a T1-1.4), `status: published`, sobre `main` en el worktree `wt-CR1`. Este módulo fusiona y reordena los antiguos M1 (T-1.1, T-1.2) y M4 (T-4.1, T-4.2) según la reestructuración de `CURRICULUM.md` §Estructura (#574).

## Método

Se leyeron completos `content/es/ruta-1/m01-t0{1,2,3,4}/index.mdx`, `ejercicios.ts`, `alrobot.ts` y sus tests, y los enunciados de `packages/i18n/locales/es/content.json:20-43`. Se contrastaron contra `CURRICULUM.md` (cabecera, «Estructura», las 5 reglas de la reestructuración, «Qué añade cada tema a Mi robot», y la spec literal de M1), `CONTENT-STANDARDS.md`, `GLOSSARY.md` y `WIDGETS.md`. Se recalcularon con Node (script `cr1-m1-golden.js` en el scratchpad) los 24 valores dorados de la spec (Al robot y ejercicios e1-e4 de los 4 temas): **todos verifican** dentro de 0.5 % de tolerancia. Se corrió `pnpm vitest run` sobre los 4 temas (87/87 tests, 8 archivos) y `pnpm content:check` (25 temas, 0 incumplimientos). Se comparó contra `docs/audits/C-M2.md` como línea base de estilo, al no existir auditoría propia de M1 antes de esta reestructuración. Verificación en página no realizada: se priorizó MDX/cálculos por presupuesto de tiempo; queda pendiente.

Se prestó atención especial al punto crítico del ticket: la cadena `n_motor → n_rueda → ω_rueda → v_max` repartida entre T1-1.3 (calcula `ω_rueda` desde el dato `n_rueda`) y T1-1.4 (calcula `v_max` citando esa `ω_rueda`, y de paso produce el dato `n_rueda` que T1-1.3 usó). Se revisó el código de `alrobot.ts` de los cuatro temas y se comparó con el patrón ya establecido en M0/M2 (T1-0.1, T1-2.2, T1-2.4): en esta base de código ningún `alrobot.ts` importa el cálculo de otro tema; cada uno reimplementa localmente la aritmética del "dato" que cita, y es el **MDX** el que decide qué `RobotFormula` se muestra (la regla 1/2 aplica a la UI, no a la reutilización de código entre módulos). Con ese criterio, T1-1.4 no muestra ninguna `RobotFormula` de `ω_rueda` (no hay una tercera clave adicional a `wheel-speed` y `v-max`) y el texto la cita con enlace; T1-1.3 no muestra ninguna fórmula de reducción (`n_motor/i`) y el texto llama a `n_rueda` dato con enlace hacia adelante. La cadena es consistente en ambas direcciones a nivel de MDX, que es el criterio de la regla.

Se revisó sin hallazgos:

- **Anatomía.** Las siete secciones en orden en los cuatro temas.
- **Frontmatter.** `id`, `module`, `order`, `prerequisites`, `widgets`, `requiredExercises`, `references` coinciden exactamente con la spec de `CURRICULUM.md` §T1-1.1 a T1-1.4, incluido el prerrequisito nuevo de T1-1.3 (`ruta-1/m00-t01`, `ruta-1/m00-t03` — MAT-10) y el de T1-1.4 (`ruta-1/m01-t03`, `ruta-1/m00-t01`).
- **Física y valores dorados.** Los 24 recalculados a mano con Node coinciden con la spec: T1-1.1 (5.97 s; e1-e4), T1-1.2 (a=1.28 m/s², t=0.524 s, x=0.175 m; e1-e4), T1-1.3 (20.94 rad/s, T=0.3 s; e1-e4), T1-1.4 (200 rpm, 0.670 m/s, 5.97 s citado; e1-e4: 0.6702 m/s, 31.25 rad/s/298.4 rpm, 0.6702 m/s, 5.968 s).
- **Widgets.** `KinematicsWidget initial={{x0_m,v0_mps,a_mps2}} editable duration_s` (T1-1.1, T1-1.2), `RotationWidget mode inputUnit="rpm" initial={{omega_radps,r_m}}` (T1-1.3 `disc`, T1-1.4 `rolling`), `MyRobotWidget mode="card"` (T1-1.4): props exactas de `WIDGETS.md`, sin props extra ni faltantes.
- **Cadena n_motor→v_max (punto crítico).** T1-1.4 no tiene `RobotFormula` de `ω_rueda`; solo `wheel-speed` (`n_rueda = n_motor/i`) y `v-max` (`v_max = ω_max·r`, con `ω_max` presentado como la `ω_rueda` "que calculaste en Movimiento circular", enlazada). T1-1.3 no tiene `RobotFormula` de reducción; `n_rueda` es dato con enlace hacia adelante a T1-1.4. Claves antiguas `omega-max` y `track-time` de T1-1.4, ausentes (confirmado en `robotCalcs = ['wheel-speed', 'v-max']`).
- **Enlaces hacia adelante/atrás.** T1-1.1 (`:103`) y T1-1.2 (`:121`, `:130`) enlazan a `/ruta/ruta-1/m01/t04`, sin enlace a Vectores. T1-1.4 (`:134`, `:142`, `:145`) enlaza de vuelta a T1-1.3 (`/ruta/ruta-1/m01/t03`) y T1-1.1 (`/ruta/ruta-1/m01/t01`), y menciona explícitamente T1-0.2, T1-1.1 y T1-1.2 como consumidores de `v_max` como dato. T1-0.2 (`:140`) enlaza hacia adelante a Rodadura. Las cinco citas "calculaste en Vectores → ahora en Rodadura" (#559) están cerradas en ambos sentidos.
- **Notación y glosario.** ω, ω_rueda, ω_max, n, n_rueda, n_motor, rpm, rad/s, T, período, θ, α, i: coinciden con `GLOSSARY.md` §Rotación. `v`, `v_max`, `a`, `x`, `Δx`, `t`: §Magnitudes generales.
- **Unidades.** Toda cifra lleva unidad y punto decimal. Espacio antes de la unidad es normal (U+0020) en los cuatro temas, no fino — igual que el resto de la ruta ya publicada (deriva conocida, ver abajo).
- **Ejercicios.** Rejillas exactas (centésimas/décimas según el enunciado), dificultad creciente, `requiredExercises: [e1,e2,e3]`, tolerancia relativa 2 % salvo donde la spec no la cambia. `MIN_RELATIVE_ANSWER` aplicado en T1-1.2 e2 y T1-1.4 e3/e4 (#568). Techo de 1.5 m/s en T1-1.4 (#274, #301).
- **Tests y content:check.** `pnpm vitest run` sobre los 4 temas: 87/87 pasan. `pnpm content:check`: 0 incumplimientos.
- **#569-#573.** Sin rastro en commits, `docs/` ni comentarios de código. No se puede confirmar ni descartar contenido asociado a esos números; se reporta como tal, sin inventar.

## Hallazgos

| # | Tema/archivo | Tipo | Descripción | Severidad | Ticket |
|---|---|---|---|---|---|
| 1 | `alrobot.ts` de T1-1.1/1.2/1.4 (`format`, p.ej. `m01-t01/alrobot.ts:51-53`) frente a T1-1.3/1.4 (`m01-t03/alrobot.ts:23-25`, `m01-t04/alrobot.ts:55-57`) | formato de número · técnico | `format()` de T1-1.1, T1-1.2 y `v-max` de T1-1.4 usa `.toPrecision(3)` crudo (conserva ceros de relleno con propósito: `0.670`, `5.97`, `1.28`, como fija la spec). `formatRotation()` de T1-1.3 y `wheel-speed` de T1-1.4 usa `String(Number(.toPrecision(4)))` (los quita: `200`, `20.94`). Es el mismo patrón mixto ya señalado en C-M0 (deriva 4) y C-M2 (hallazgo 16): cada `alrobot.ts` decide su propio formato porque no hay una regla común en `CONTENT-STANDARDS.md`. No es una regresión de M1 ni tiene relación con #550 (que trataba `ExerciseWidget`, no `RobotFormula`); ambos formatos dan aquí los dorados correctos. | menor | — (repite recomendación 6 de C-M2) |
| 2 | `docs/audits/C-M2.md:7` — proceso de esta auditoría | proceso · técnico | Verificación en página (`/ruta/ruta-1/m01/t01` a `t04`, ancho normal y 390 px) no se realizó por presupuesto de tiempo; se priorizó MDX/cálculos según lo autorizado por el ticket. No se confirmó visualmente el `RotationWidget` en `mode="rolling"` de T1-1.4 ni el `MyRobotWidget mode="card"`. | menor | — (ver recomendación 1) |
| 3 | `#569`–`#573` | referencia · sin rastro | No hay commits, entradas de `docs/` ni comentarios de código asociados a estos números en el repositorio. Sin rastro, no se puede confirmar ni descartar si corresponden a algo de M1. | menor | — |

Resumen: 0 bloqueantes, 0 mayores, 3 menores. Ningún hallazgo alto o medio: no se detectó error físico, dorado incorrecto, violación de orden ni contradicción entre documentos.

### Para la validación del humano

Ningún hallazgo de esta auditoría cambia lo que ve el estudiante (los tres son técnicos/de proceso). No hay tabla que llevar a validación humana esta vez.

## Deriva detectada entre módulos

Frente a C-M2 (Dinámica, T-2.1 a T-2.3, previo a la reestructuración):

- **Nivel y densidad.** Similares: M1 tiene 2, 3, 5 y 5 fórmulas por tema (T1-1.1 a T1-1.4); M2 tenía 3, 5 y 5. Concepto está en 256-316 palabras (rango 150-350); Al robot en 160-225 (rango 100-300); ambos dentro de los márgenes que ya cumplía M2.
- **Gancho.** Los cuatro abren con "Tu robot..." o "Tu motor(reductor)...", con números y pregunta, literales de la spec — mismo patrón que M2.
- **Formato de números en `alrobot.ts`.** Sigue sin regla común (hallazgo 1 de este informe = hallazgo 16 de C-M2 = deriva 4 de C-M0): unos temas conservan ceros de relleno con `.toPrecision()` crudo y otros los quitan con `String(Number(...))`, según si el dorado de la spec los necesita. No ha habido corrección desde C-M2.
- **Enlaces entre temas.** M1 es más disciplinado que M2 en este punto: todos los enlaces a otros temas usan Markdown con URL (`[Texto](/ruta/...)`), sin el patrón mixto (URL a mano / nombre sin enlace) que C-M2 señaló como hallazgo 10. Es una mejora, no una deriva a reportar como problema.
- **Espacio antes de unidad.** Sigue siendo espacio normal en toda la ruta, no fino como pide `CONTENT-STANDARDS.md:42`; misma deriva ya señalada en C-M0 y C-M2 (recomendación 4 de C-M0, hallazgo 15 de C-M2), sin corrección aún.
- **Cadena de "Mi robot" citada entre temas (regla 1/2, #559/#565).** M1 es la primera vez que la reestructuración pone a prueba una cadena de dos eslabones en direcciones opuestas (T1-1.3 calcula, cita hacia adelante su fuente; T1-1.4 calcula esa fuente y cita hacia atrás el resultado). Se verificó consistente en MDX en ambos sentidos (ver Método). M2 ya tenía casos de una sola dirección (T1-2.2 citando el "dato" de T1-2.4); M1 no introduce ningún patrón nuevo de riesgo respecto a M2, solo lo ejercita con más eslabones.

## Hallazgos pendientes de #569–#573 (issues de GitHub, consolidado por el orquestador)

Mapeo a M1 vía la tabla de equivalencias de `CURRICULUM.md` (ids previos a #574):

| Issue | Punto | Tema | Estado | Evidencia |
|---|---|---|---|---|
| #569.16 | `m01-t02`: KinematicsWidget sigue integrando tras «detenerse» (retrocede a x=−7.2m); Exp.3 pide duplicar v0 de 0.3 a 0.6 cuando Exp.2 ya dejó 0.6 | T1-1.2 | **No verificado por este agente** (es de comportamiento del widget en ejecución continua, requiere prueba interactiva, no solo lectura de MDX). Se deja como spec gap de verificación para QA/humano. | `index.mdx` Explora, experimentos 2 y 3 (líneas ~65-70 según la spec de CURRICULUM.md); no confirmado contra el render real. |
| #569.17 | Frase idéntica gancho/Al robot en `m04-t02`(→T1-1.4) | T1-1.4 | **No verificado explícitamente**; el informe original no señaló esta repetición como hallazgo, pero tampoco la descartó activamente. | Pendiente de una relectura dirigida de `index.mdx` de T1-1.4 comparando gancho vs Al robot línea a línea. |
| #571.10 | Prerrequisito de la derivada (`m00-t03`) usado por `m04-t01`(→T1-1.3) sin declarar | T1-1.3 | **Resuelto.** | `content/es/ruta-1/m01-t03/index.mdx:7`: `prerequisites: [ruta-1/m00-t01, ruta-1/m00-t03]` — ya declarado (MAT-10, confirmado también en Método de este informe). |
| #572.6 | Rodadura sin deslizamiento (`m04-t02`→T1-1.4) cita Y&F cap. 9; el contenido está en cap. 10 §10.3 | T1-1.4 | **Sigue abierto.** | `CURRICULUM.md` § T1-1.4: `Referencias: young-freedman-9, siegwart-3` — no se ha añadido `young-freedman-10`. Confirmar en frontmatter real de `index.mdx`. |
| #573 (PED-31) | Título "v=ω·r: la velocidad del robot" es el único con fórmula | T1-1.4 | **Resuelto.** | `CURRICULUM.md` línea 229 registra el cambio: «Cambia: título (PED-31)» → ahora «Rodadura: de la rueda al robot», sin fórmula en el título. |

No se relanzó ningún agente para verificar #569.16 y #569.17 con más profundidad (fuera del alcance de esta consolidación); se anotan como spec gaps para QA o para una relectura dirigida futura, no como hallazgos confirmados de esta auditoría.

## Recomendaciones para el orquestador

1. Verificación visual pendiente de T1-1.3 y T1-1.4 (`RotationWidget mode="disc"|"rolling"`, `MyRobotWidget mode="card"`) en ancho normal y 390 px, cuando el puerto de dev esté libre.
2. `CONTENT-STANDARDS.md` §2.5 (o un nuevo §): fijar una regla común de formato de cifras en `RobotFormula` (ceros de relleno sí/no y cuándo), para no seguir repitiendo la deriva 4/hallazgo 16/hallazgo 1 en cada módulo. Repite la recomendación 6 de C-M2.
3. Aclarar en `CURRICULUM.md` o `CONTENT-STANDARDS.md` que la regla 1/2 (#559/#565) aplica a lo que el MDX muestra con `RobotFormula`, no a si el código de `alrobot.ts` reimplementa localmente la aritmética de un "dato" citado; ya es el patrón de todo el repo (T1-0.1, T1-2.2, T1-2.4, y ahora T1-1.3/T1-1.4), pero no está escrito, y un futuro auditor podría confundirlo con una violación de código.

## Veredicto

**Módulo aprobado.** No hay hallazgos bloqueantes, mayores ni de severidad alta o media: la física recalculada con Node coincide en los 24 valores dorados, el orden de enseñanza se respeta (incluida la cadena crítica n_motor→n_rueda→ω_rueda→v_max, consistente en ambas direcciones), los prerrequisitos son correctos, la notación coincide con el glosario, los widgets usan props exactas y no hay contradicciones entre MDX, `ejercicios.ts`, `alrobot.ts` y frontmatter. Los tres hallazgos son menores y técnicos (formato de número sin regla común, verificación visual pendiente, y ausencia de rastro de #569-#573).
