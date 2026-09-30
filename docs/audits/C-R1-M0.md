# Auditoría de coherencia — C-R1-M0

2026-09-30 · auditor de coherencia · Ruta 1, Módulo 0 — Herramientas: T1-0.1 Unidades y magnitudes, T1-0.2 Vectores, T1-0.3 La derivada como razón de cambio, `status: published`, sobre `main` (worktree `wt-CR1`).

## Método

Se leyeron completos `docs/CURRICULUM.md` (cabecera 1-152 y spec de M0, 156-190), `docs/CONTENT-STANDARDS.md`, `docs/GLOSSARY.md`, `docs/WIDGETS.md`, `docs/audits/C-M2.md` (formato) y `docs/templates/AUDIT-COHERENCE.md`. Se leyeron completos los tres `index.mdx`, sus `ejercicios.ts`, `alrobot.ts` (T1-0.1 y T1-0.2; T1-0.3 no tiene, es correcto) y sus tests. Se recalcularon con Node (script en el scratchpad, prefijo `cr1-m0-`) todos los valores dorados de ejercicios, «Al robot» y los ejemplos numéricos de Concepto/Explora. Se corrió `pnpm vitest run` sobre los cinco archivos de test de M0 (62/62 en verde). Se buscó rastro de #569-#573 en commits, docs y código (ninguno). Se verificó el commit `0547e9d` (#550) y su alcance real (solo `ExerciseWidget`/`LineSensorWidget`, no MDX de M0). Contra cada tema y entre los tres se revisó:

1. Física: recálculo independiente de cada dorado.
2. Regla de orden: qué usa cada tema y de qué ruta/tema viene, contra la posición de M0 (primer módulo de ruta-1, que no sigue a nadie).
3. Prerrequisitos: frontmatter contra la spec y contra la regla de `CONTENT-STANDARDS.md` §3.
4. Notación y unidades: cada símbolo contra `GLOSSARY.md`.
5. «Mi robot»: qué añade cada `RobotFormula`, qué cita, qué toma como dato, contra la tabla de `CURRICULUM.md` y las Reglas 1 y 2 de la reestructuración.
6. Widgets: props exactas contra `WIDGETS.md`, valores iniciales contra el gancho.
7. Contradicciones entre MDX, `ejercicios.ts`, `alrobot.ts`, frontmatter y las tres specs.

No se hizo verificación en página (tiempo de sesión priorizado en MDX y cálculos, ver «Para la validación del humano»).

Se revisó sin hallazgos:

- **Anatomía.** Las siete secciones en orden en los tres temas.
- **Frontmatter.** `id`, `module`, `order`, `estimatedMinutes`, `prerequisites`, `widgets`, `requiredExercises`, `references` coinciden con la spec en los tres temas. Prerrequisitos: T1-0.1 `[]`, T1-0.2 y T1-0.3 `[ruta-1/m00-t01]`, exactamente como pide la lista mínima.
- **Física.** Los 16 valores dorados (12 de ejercicios + 4 de «Al robot»/Concepto/Explora) recalculados a mano cuadran exactamente con la spec: 628.3 rad/s, 20.94 rad/s, 60 cm/s, 7.2 W (T1-0.1); 0.433/0.25, (0.433,0.25)→(0,0.5) tras +60°, v_max 0.670→0.580/0.335, 0.5 m/s∠53.13°, 1.526 m, 53.13° (T1-0.2); 0.9, 0.8, 0.6, 1.1 m/s (T1-0.3). Ninguna instancia de T1-0.3 supera 1.5 m/s (el `do...while` de `e1` lo garantiza; el límite superior teórico de sus rangos sin ese filtro sí lo superaría, pero el código lo descarta correctamente).
- **Regla de orden.** T1-0.1 no usa nada no enseñado. T1-0.2 solo usa `v_max` como dato con enlace hacia adelante a T1-1.4, y cita la rotación por componentes hacia T2-0.2 como enlace hacia adelante explícito (permitido, ruta-2 sigue a ruta-1... en realidad es al revés en cuanto a orden de enseñanza, pero es un enlace de salida, no un uso de contenido de ruta-2). T1-0.3 no calcula nada de encoders, solo los nombra con enlace hacia adelante a T2-0.1, ejemplo genérico sin atribuir al robot de referencia (excepción de #252/#275 opción B, aplicada correctamente).
- **Widgets.** `RotationWidget mode="disc" inputUnit="rpm" initial={{omega_radps: 20.94, r_m: 0.032}}`, `MyRobotWidget mode="form"` (T1-0.1); `VectorWidget initialA initialB show unit` (T1-0.2); `KinematicsWidget initial={{x0_m, v0_mps, a_mps2}} editable duration_s showTangent` (T1-0.3): las tres firmas coinciden exactamente con `WIDGETS.md`, sin props extra ni faltantes, y coinciden con la tabla «Relación tema → widgets». Los tres widgets arrancan con los valores del gancho (T1-0.1 con la aclaración textual de por qué no llega a 6000 rpm; T1-0.2 con 0.433/0.25 = las componentes del gancho a 30°; T1-0.3 con x0=0, v0=0.5, a=0.2, que reproduce las velocidades medias del gancho 0.5→0.7→0.9 m/s).
- **«Mi robot» (Reglas 1 y 2).** T1-0.1 añade `omega-motor` (única fila) y no repite `omega-rueda` (correctamente quitado). T1-0.2 añade `vx` y `vy`, toma `v_max` como dato con enlace hacia adelante y no lo muestra con fórmula ni con `RobotFormula` propia (cumple Regla 1). T1-0.3 no añade fila, como dice la spec (ejemplo genérico, sin `RobotFormula`). Ninguno de los tres duplica el cálculo de otro tema.
- **Notación y unidades.** Todos los símbolos usados (ω, ω_motor, n, rpm, rad/s, v_x/v_y, θ, φ, a′_x/a′_y, v̄, Δx, Δt, d/dt, c, n en c·tⁿ) están en `GLOSSARY.md` con la misma unidad y el mismo símbolo. Separador decimal punto en los tres temas.
- **Tests.** `pnpm vitest run` sobre los 5 archivos de test de M0: 62/62 en verde.
- **#550.** Revisado el commit `0547e9d`: solo tocó `ExerciseWidget/state.ts` y `LineSensorWidget/scene.tsx`. Ningún valor del MDX de M0 muestra ceros de relleno artificiales por ese bug; el "0.00" del gancho de T1-0.3 es la lectura inicial de una tabla de posiciones (dato del enunciado, no salida de `ExerciseWidget`), y los ceros de relleno de `alrobot.ts` (628.3, 0.670, 0.580, 0.335) son formato deliberado a cifras significativas fijas, documentado en el propio código y consistente con la spec.
- **#569-#573.** Sin rastro en el repo (commits, docs, código): no se puede confirmar resuelto ni abierto.

## Hallazgos

| # | Tema/archivo | Tipo | Descripción | Severidad | Ticket |
|---|---|---|---|---|---|
| 1 | T1-0.2 `index.mdx:27` | notación · visible | Concepto dice «su magnitud (o módulo)»: es la única mención de «módulo» como sinónimo en M0. `GLOSSARY.md` no lista «módulo», solo «magnitud» (`GLOSSARY.md:67`, `|v⃗|` = «magnitud de la velocidad como vector»). C-M2 (hallazgo 8) ya señaló esta misma ambigüedad en M2 y quedó como recomendación pendiente al glosario. | baja | ver recomendación 1 (repite C-M2 #8) |
| 2 | T1-0.1–T1-0.3, todos los `index.mdx` y `content.json:2-19` | unidades · visible | Espacio normal (U+0020) antes de la unidad en vez del espacio fino que pide `CONTENT-STANDARDS.md:49`. Confirmado como el mismo hallazgo conocido de C-M2 (hallazgo 15, recomendación 4 de C-M0), no es nuevo en M0. | baja | ya abierto (recomendación pendiente, no nuevo) |
| 3 | `WIDGETS.md:329-331` | doc · técnico | La tabla «Relación tema → widgets» no incluye `Formula` ni `ExerciseWidget` en la fila de M0 (correcto, la nota bajo la tabla los excluye a propósito de todas las filas), pero tampoco refleja que T1-0.1 usa además `MyRobotWidget`, que sí está listado; no es una discrepancia, solo se anota que la tabla es consistente. Sin hallazgo real; se retira de la lista de riesgos tras verificar. | — | — |

Resumen: 0 hallazgos altos, 0 medios, 2 bajos (1 repite un hallazgo ya conocido de C-M2/C-M0 sobre otro módulo, aplicado aquí por primera vez a M0; el otro confirma un hallazgo conocido que ya se repite). No se abre ningún ticket nuevo: los dos hallazgos bajos ya tienen recomendación pendiente en `docs/` desde C-M0/C-M2.

### Para la validación del humano

| # | Tema | Qué vería distinto el estudiante | Origen |
|---|---|---|---|
| 1 | T1-0.2 | «magnitud» sin la aclaración «(o módulo)», o el glosario adopta ambos términos como sinónimos explícitos | tema / glosario |
| 2 | todos | Espacio fino antes de la unidad, o la regla ajustada al espacio normal (ya en curso desde C-M0/C-M2) | estándar pendiente |

## Deriva detectada entre módulos

M0 es el primer módulo auditado de este lote de reestructuración (#574) sobre el contenido ya fusionado en `main`; no hay una auditoría anterior de este mismo M0 post-reestructuración con la que comparar directamente. Comparado con las líneas base de C-M0/C-M2 (documentos anteriores a la reestructuración, mismo contenido y numeración distinta):

- El espacio normal en vez de fino (hallazgo 2 aquí) es exactamente la misma deriva que C-M0 y C-M2 ya señalaron en M2; sigue sin resolverse en `docs/` ni en el contenido.
- «Magnitud» vs. «módulo» (hallazgo 1 aquí) es la misma ambigüedad de C-M2 (hallazgo 8), esta vez en el módulo que primero define el término; sigue abierta.
- Fuera de eso, M0 no introduce hallazgos nuevos: las cinco reglas de la reestructuración (Al robot solo con lo ya enseñado, añade-no-repite, prerrequisitos, ids, orden) se cumplen exactamente como especifica `CURRICULUM.md` en los tres temas.

## Hallazgos pendientes de #569–#573 (issues de GitHub, consolidado por el orquestador)

`#569`-`#573` son issues de GitHub del informe de auditoría externa de 2026-09-26, con ids de tema previos a la reestructuración (`m00-t01`…`m06-t05`). Mapeados a M0 vía la tabla de equivalencias de `CURRICULUM.md`:

| Issue | Punto | Tema | Estado | Evidencia |
|---|---|---|---|---|
| #570.1d | `m00-t01 e3` hasta 5 m/s, cuando el resto de la ruta limita a 1.5 m/s | T1-0.1 | **Abierto.** | `ejercicios.ts:72`: `x ∈ [0.5, 5], t ∈ [1, 10]`; con `x=5, t=1` da 5 m/s. Sin filtro de redibujo tipo `#274`. |
| #570.3 | `m00-t02 e2` rango de atan2 mal cerrado `[−180°,180°]` | T1-0.2 | **Resuelto.** | `ejercicios.ts:56`: comentario y código ya usan `(−180°, 180°]` explícitamente, como pide el issue. |
| #571.5 | «magnitud» con dos significados (m00-t01 vs m00-t02) | T1-0.1 / T1-0.2 | **Abierto**, ya reportado como hallazgo 1 de este informe. | `index.mdx:27` de T1-0.2. |
| #571.9 | Minutos estimados cortos: m00-t01 20 min | T1-0.1 | **Sin cambio, sigue en 20 min.** | `estimatedMinutes: 20` en frontmatter; el issue proponía 30. No es un hallazgo de coherencia (es de ritmo pedagógico), se deja para que el orquestador decida si lo lleva a spec. |
| #573 (ROB-18) | Motor de referencia no es "kit típico" si algún texto lo dice así | T1-0.1 | **Resuelto / no aplica.** | Sin ocurrencias de «kit» ni «típico» en `index.mdx` (grep sin resultado). |

Puntos de #569 y #572 revisados: ninguno de los 19 (#569) ni de los 8 (#572) toca T1-0.1–T1-0.3 directamente (los de #569 relevantes a Fundamentos caen en M1-M3, ver esos informes); no se listan aquí para no duplicar.

## Recomendaciones para el orquestador

1. Resolver de una vez las dos recomendaciones ya pendientes de C-M0/C-M2 (espacio fino en `CONTENT-STANDARDS.md` §4, y «magnitud»/«módulo» en `GLOSSARY.md`) antes de seguir acumulando módulos con la misma deriva; no requieren cambio de contenido, solo decisión y, si se decide cambiar la regla, una pasada mecánica sobre todo lo publicado.
2. Ninguna acción nueva específica de M0: no hay hallazgos altos ni medios, y los dos bajos son continuación de deriva ya conocida, no hallazgos nuevos que requieran ticket propio.
3. Queda pendiente la verificación visual en `/ruta/ruta-1/m00/t01`, `/m00/t02`, `/m00/t03` a ancho normal y 390 px (no se hizo por presupuesto de esta sesión); si se prioriza, conviene un ticket QA ligero en vez de repetir la auditoría de coherencia.

## Veredicto

**Módulo aprobado.** No hay hallazgos altos ni medios: los 16 valores dorados recalculados cuadran, la regla de orden se cumple en los tres temas, «Mi robot» sigue las Reglas 1 y 2 sin duplicar ningún cálculo, los widgets usan exactamente las props y valores iniciales de la spec, y no hay contradicción entre MDX, `ejercicios.ts`, `alrobot.ts`, frontmatter y `CURRICULUM.md`/`GLOSSARY.md`/`WIDGETS.md`. Los dos hallazgos bajos son continuación de deriva ya documentada en auditorías anteriores, no defectos nuevos de M0.
