# Auditoría de coherencia — C-R1-M2

2026-09-30 · auditor de coherencia · T1-2.1 Leyes de Newton y diagrama de cuerpo libre, T1-2.2 Fricción, T1-2.3 Aceleración angular y centrípeta (antes T-4.3) y T1-2.4 Torque, reducción y transmisión (tema fusionado, antes T-2.3 «Torque» + T-4.4 «Transmisión»), todos `status: published` sobre `main` tras la reestructuración de rutas (#574).

## Método

Se leyó completa la auditoría previa `docs/audits/C-M2.md` (2026-09-26, forma anterior a la reestructuración), y completos `docs/CURRICULUM.md` (cabecera §1-152 y § Módulo 2), `docs/CONTENT-STANDARDS.md`, `docs/GLOSSARY.md` y `docs/WIDGETS.md`. Se leyeron los cuatro `index.mdx`, `ejercicios.ts` y `alrobot.ts`, y se recalcularon con Node (`cr1-m2-recalc.js`, scratchpad) los 24 valores dorados de la spec: los 4+4+4+4 de Verifica y los de «Al robot» y del Explora de T1-2.4 (`i_total`, salidas de los tres experimentos, potencias, y `τ(ω) = τ_s(1−ω/ω₀)` en 3000 rpm). Los 24 cuadran; el único «FAIL» del script era mi propia tolerancia demasiado estricta sobre un redondeo a 3 cifras (0.1296 → 0.130 N·m, correcto). Se corrió `pnpm vitest run` sobre las cuatro carpetas (87/87 verdes) y `pnpm content:check` (0 incumplimientos, 25 temas). Se sirvieron las cuatro páginas en `localhost:4410` (200 OK las cuatro; servidor detenido al terminar).

Se revisó explícitamente cada punto de la lista mínima: física, orden, prerrequisitos, notación/glosario, unidades, «Mi robot» sin duplicados, props de widgets (con foco en el punto de trabajo de `GearWidget`), y contradicciones entre documentos.

## Comparación contra los 16 hallazgos de C-M2

| # C-M2 | Estado en C-R1-M2 |
|---|---|
| 1 (referencias sin confirmar) | **Resuelto.** `REFERENCES.md` §«Capítulos confirmados» ya lista `young-freedman-4/-5/-9/-10`, `serway-5/-10` (lote #485) y `young-freedman-27` (#609). |
| 2 (WIDGETS.md desfasado) | **Resuelto.** La tabla «Relación tema → widgets» ya trae GearWidget de dos etapas y RotationWidget `angularAccel` para M2, sin `EnergyWidget`. |
| 3 (`DEG_TO_RAD` propio en T-2.3) | **Ya no aplica igual, pero reaparece en T1-2.4.** T1-2.3 ahora usa `RPM_TO_RADPS` propio (equivalente, mismo patrón). T1-2.4 define su propio `DEG_TO_RAD = Math.PI/180` (`ejercicios.ts:19`) en vez de `degToRad` de sim-core, como T1-2.1 sí usa. Sigue siendo terreno del auditor de código; se anota igual. |
| 4 (sangría/estilo de T-2.3) | **No verificado de nuevo** (fuera de esta lista mínima; es forma de código/fuente, terreno del auditor de código). No se observó a simple vista al leer T1-2.3. |
| 5 (widget con valores distintos del gancho) | **Sigue sin corregir en T1-2.1.** `index.mdx:80-105`: el Explora dice explícitamente «el del gancho» pero el widget arranca con tracción 1.5 N / fricción 0.4 N (a = 1.22 m/s²), no con los 0.72 N / 0.8 m/s² del gancho. T1-2.2 ya no tiene este problema: su Explora no dice «el del gancho» y presenta su propio escenario (15°, 3 N), como permite la excepción de `CONTENT-STANDARDS.md` §7. |
| 6 (r llamado «brazo» vs «radio de rueda») | **Resuelto en T1-2.4.** La lista de variables de `τ = F·r` (`index.mdx:57-61`) ya dice «brazo de la fuerza; en la rueda, su radio», conciliando los dos usos en una sola frase. |
| 7 (v cambia de sentido a media frase) | **Resuelto.** T1-2.2 `index.mdx:52` ya dice explícitamente «llamando v a la velocidad al empezar a frenar». |
| 8 («magnitud» vs «módulo») | **Sigue igual, sin nuevos casos.** T1-2.2 `index.mdx:52` sigue con «magnitud»; ningún tema de M2 usa «módulo». Coherente con T1-2.1 y el glosario; era hallazgo de estilo entre M0 y M2, no reaparece como contradicción nueva. |
| 9 (mg vs m·g en prosa) | **Resuelto.** Los cuatro temas usan `m·g` en prosa (T1-2.1, T1-2.2, T1-2.3, T1-2.4) y `mg` solo dentro de `Formula latex`, de forma consistente. |
| 10 (formas distintas de citar temas) | **Resuelto.** Los cuatro temas enlazan sistemáticamente con Markdown (`[Título](/ruta/...)`), hacia atrás y hacia adelante, sin nombrar un tema sin enlace. |
| 11 («R» de la resultante sin glosario) | **Resuelto.** T1-2.1 ya no llama «R» a la resultante; dice «la resultante» sin símbolo (`index.mdx:82`, `:109-110`, `:118`). |
| 12 (respaldo del perfil en una frase en T-2.2) | **Resuelto.** T1-2.2 `index.mdx:145-146` ya usa las dos frases (falta el motor / no es móvil), igual que T1-2.1 y T1-2.3. |
| 13 («Usa g = 9.81» inconsistente) | **Resuelto.** Todo enunciado de M2 que usa g en `content.json` lo dice explícitamente («Usa g = 9.81 m/s²»); T1-2.4 e2 no usa g y no lo dice, correcto. |
| 14 (dificultad no creciente, e4 repite el widget) | **Igual, fijado por la spec.** T1-2.1 e2 (N=mg) sigue siendo más simple que e1; T1-2.4 e1-e4 heredan el orden del tema fusionado por diseño (tabla de equivalencias). No es nuevo, sigue siendo decisión de spec. |
| 15 (espacio normal, no fino) | **Sigue sin corregir.** Cero apariciones de espacio fino (U+202F) en las cadenas de M2 (`content.json`, verificado por script); toda la ruta usa espacio normal, como marca la recomendación 4 de C-M0/C-M2 aún pendiente. |
| 16 (F con más cifras que a en T-2.1) | **Sigue igual, correcto.** `alrobot.ts` de T1-2.1 sigue usando 4 cifras para `a` sustituida y para `F`, de modo que el producto cuadra con cualquier perfil (comentario `FORCE_SIGNIFICANT_FIGURES`, línea 21). Mismo patrón que antes, sin regresión. |

Ningún hallazgo de C-M2 se repite bajo un número nuevo salvo el matiz de #3 (ahora en T1-2.4 en vez de T1-2.3).

## Hallazgos nuevos o propios de la reestructuración

| # | Tema/archivo | Tipo | Descripción | Severidad | Ticket |
|---|---|---|---|---|---|
| N1 | T1-2.4 `ejercicios.ts:19` | estilo (código) · técnico | Define su propio `DEG_TO_RAD = Math.PI/180` en vez de `degToRad` de sim-core (como T1-2.1 sí usa). Mismo patrón que el hallazgo 3 de C-M2, ahora en el tema fusionado. Resultado idéntico; terreno del auditor de código. | baja | — |
| N2 | T1-2.1 `index.mdx:80` | widget · visible | Persiste el hallazgo 5 de C-M2: el Explora dice «el del gancho» pero el `FreeBodyWidget` arranca con 1.5 N / 0.4 N (a = 1.22 m/s²), no con los 0.72 N / 0.8 m/s² del gancho. Como la spec fija exactamente esos props, la corrección es de spec o de la frase, no del código. | media | — (ver recomendación 1) |

No se encontró ningún hallazgo alto (error físico, dorado incorrecto, violación de orden o contradicción entre documentos). El punto más sensible del alcance —el punto de trabajo del `GearWidget` en T1-2.4— se verificó con especial cuidado: `initial={{ nIn_rpm: 3000, torqueIn_Nm: 0.006, ... }}` (`index.mdx:109-120`), nunca 6000 rpm con 0.012 N·m a la vez; el texto lo explica en Concepto y Explora y remite a T1-3.3. El torque de bloqueo (0.012 N·m) se usa correctamente solo en el cálculo de «Al robot» (`τ_rueda = τ_s·i·η_caja`), separado del punto de trabajo del Explora, y el texto aclara que el torque en la rueda a velocidad sin carga es cero, no 0.216 N·m (`index.mdx:182-184`).

No se encontró rastro de #569–#573 en ningún archivo de M2 ni en `CURRICULUM.md`; se reporta su ausencia explícitamente, sin inventar relación.

## Verificación de la lista mínima

1. **Física.** Los 24 dorados recalculados en Node cuadran exactamente con la spec (T1-2.1: 1.152 N, 8.83 N, 0.72 N, 8.829 N, 2.285/8.528 N, 1.222 m/s²; T1-2.2: 15.0 m/s², 3.53 m/s², 5.886 m/s², 30.96°, 3.532 m/s², 0.04077 m; T1-2.3: 1.28 m/s², 0.728 m/s², 41.89 rad/s², 0.72 m/s², 1.34 m/s², 1.329 m/s²; T1-2.4: τ(3000 rpm)=0.006 N·m exacto con τ_s=0.012 y n₀=6000 rpm, 0.216 N·m, 6.75 N, 13.5 N, i_total=30/36/0.833, salidas de los tres experimentos, P=1.885/1.131 W, e1-e4 del tema fusionado).
2. **Orden.** T1-2.3 solo cita T1-1.2, T1-1.4 y T1-2.2 (Fricción), nunca T1-2.4 (`index.mdx:139-165`), correcto porque el tema fusionado va después. T1-2.4 no recalcula nada de T1-2.2 (cita su conclusión, `a_motor=15.0`, `a_max=3.53`, sin `RobotFormula` propia) ni de T1-1.4 (cita `v=ω·r` sin recalcular). Sin violaciones.
3. **Prerrequisitos.** Los cuatro frontmatter coinciden exactamente con la spec: T1-2.1 `[ruta-1/m00-t02, ruta-1/m01-t02]`, T1-2.2 `[ruta-1/m02-t01]`, T1-2.3 `[ruta-1/m01-t04, ruta-1/m02-t02]`, T1-2.4 `[ruta-1/m01-t04, ruta-1/m02-t02]`.
4. **Notación/glosario.** τ, F_rueda, μₛ, β, φ, i, z, η_caja, a_motor, a_max coinciden con `GLOSSARY.md`. T1-2.2 escribe `a_motor = 2·F_rueda/m` (`alrobot.ts:69`), la forma reducida que el glosario documenta explícitamente como equivalente a `2 τ_s i η_caja/(r m)` (`GLOSSARY.md:80`); confirmado.
5. **Unidades.** Correctas en los cuatro temas; N·m, N, m/s², rad/s², m/s consistentes con el glosario.
6. **«Mi robot» sin duplicados.** T1-2.4 cita la conclusión de T1-2.2 sin `RobotFormula` propia (`index.mdx:176-180`); T1-2.3 cita T1-1.2 y T1-1.4 sin recalcular. Sin duplicados.
7. **Props de widgets.** `FreeBodyWidget` (T1-2.1, T1-2.2), `RotationWidget mode="angularAccel"` (T1-2.3) y `GearWidget stages={2}` (T1-2.4) usan exactamente las props de `WIDGETS.md`. El punto de trabajo de `GearWidget` es correcto (ver arriba).
8. **Contradicciones entre documentos.** Ninguna. `WIDGETS.md`, `CURRICULUM.md` y el contenido coinciden.

## Para la validación del humano

| # | Tema | Qué vería distinto el estudiante | Origen |
|---|---|---|---|
| N2 | T1-2.1 | Widget que arranca con los números del gancho, o la frase que quita «el del gancho». | spec / tema |
| 8, 14, 15, 16 (heredados) | varios | Sin cambio respecto a C-M2: «magnitud», dificultad de spec, espacio normal, cifras de F en T1-2.1. Repetidos aquí solo para que el humano sepa que no son regresiones nuevas. | estándar pendiente |

## Deriva detectada entre módulos

Frente a C-M2, la reestructuración resolvió 11 de los 16 hallazgos (1, 2, 6, 7, 9, 10, 11, 12, 13, y parcialmente 3) mediante cambios reales en `docs/` y en el contenido, no solo en la forma. Los que siguen abiertos (5→N2, 8, 14, 15, 16) son consistentes entre sí y con M0/M1: ninguno es nuevo, todos previamente conocidos y con severidad menor salvo N2, que sube a media porque ahora la frase «el del gancho» hace la discrepancia más visible que antes (C-M2 no señalaba esa frase explícita). La fusión de T1-2.4 en sí no introdujo hallazgos de física ni de orden: el punto más peligroso (el punto de trabajo del motor en `GearWidget`) está bien resuelto y bien explicado, con enlaces hacia adelante a T1-3.3 en los tres lugares donde correspondía (Concepto, Explora, Al robot).

## Hallazgos pendientes de #569–#573 (issues de GitHub, consolidado por el orquestador)

Mapeo a M2 vía la tabla de equivalencias de `CURRICULUM.md` (ids previos a #574):

| Issue | Punto | Tema | Estado | Evidencia |
|---|---|---|---|---|
| #569.1 | ω sobrecargada (rueda ↔ robot) en `m04-t03`(→T1-2.3): con los datos del gancho, `ω_rueda` en `ω²·R` da 219 m/s² | T1-2.3 | **Resuelto por la reestructuración.** | T1-2.3 en su forma actual no tiene robot diferencial con `ω` propia (eso vive en ruta-2); el tema solo usa `ω` de rotación de rueda/disco y `v`/`a_c` de curva, sin mezclar los dos sentidos que el issue señalaba. |
| #569.2 | «Tracción»="fricción" contradictorio entre `m02-t01`(T1-2.1) y `m02-t02`(T1-2.2); β y rueda loca sin definir | T1-2.1 / T1-2.2 | **Parcial.** | El hallazgo N2 de este informe (T1-2.1, «el del gancho» con props distintas) es un problema relacionado pero distinto. La contradicción semántica tracción=fricción específica del issue no fue verificada línea a línea por este agente; β sí está definido en el glosario (`GLOSSARY.md`: «fracción del peso sobre las ruedas motrices») y se usa consistentemente en T1-2.2/T1-2.3. Queda como spec gap de relectura dirigida. |
| #569.5 | `m04-t04`(→T1-2.4 fusión): «más r da menos torque» (debería ser menos fuerza) | T1-2.4 | **Resuelto.** | Confirmado como hallazgo 6 de la comparación contra C-M2 en este informe: la lista de variables de `τ=F·r` ya concilia «brazo»/«radio de rueda» en una sola frase; no se encontró la frase «menos torque» incorrecta en el `index.mdx` actual. |
| #570.1b | `m04-t03`(→T1-2.3) e1/e2: `a_c` hasta 22.5 m/s² (2.3g) y `α` hasta 628 rad/s², por encima de lo que enseña el propio tema (`a_c ≤ μ·g`) | T1-2.3 | **Sigue abierto**, confirmado con lectura directa de `ejercicios.ts:26-29`: `E1_SPEED_RPM: [60,600]`, `E1_T_S: [0.1,2]` (α hasta 41.89·15=628 rad/s² en el extremo), `E2_V_MPS: [0.2,1.5]`, `E2_R_M: [0.1,2]` (a_c hasta 1.5²/0.1=22.5 m/s²). Sin redibujo tipo `#274` que lo evite. | 
| #571.2 | Tablas en rad, enunciados en grados sin nota | T1-2.1, T1-2.2, T1-2.4 | **Parcial/no verificado en detalle.** | Este informe no revisó explícitamente si cada tabla de fórmulas de M2 aclara "rad (en los ejercicios, °)"; queda como spec gap de relectura dirigida. |
| #571.12 | `m02-t02`(T1-2.2) L121 "μs=0.3 (goma dura)" incorrecto (0.3 es plástico duro/suelo pulido, no goma) | T1-2.2 | **No verificado por este agente** en esta pasada; el informe original no señaló esta frase. Spec gap de relectura dirigida. |
| #572.2 | `m04-t03`(→T1-2.3): v_max en curva por fricción está en Y&F cap.5/Serway cap.6, no en caps. 9/10 de rotación | T1-2.3 | **Sigue abierto.** | `CURRICULUM.md` § T1-2.3: `Referencias: young-freedman-9, serway-10` — no incluye `young-freedman-5`. |
| #572.3 | `m04-t04`(→T1-2.4 fusión): engranajes, Y&F cap.10 no los trata | T1-2.4 | **Sigue abierto.** | `CURRICULUM.md` § T1-2.4: `Referencias: young-freedman-10, serway-10` — sin referencia adicional (`siegwart-2` o texto de elementos de máquinas) para engranajes. |

No se relanzó ningún agente para verificar #569.2, #571.2 y #571.12 con más profundidad; se anotan como spec gaps para una relectura dirigida futura, no como hallazgos confirmados de esta auditoría.

## Recomendaciones para el orquestador

1. T1-2.1 `index.mdx:80`: quitar «el del gancho» de la frase del Explora, o cambiar los props del `FreeBodyWidget` a 0.72 N netos / 0.8 m/s² (toca `docs/CURRICULUM.md` § T1-2.1 si se prefiere lo segundo). Resuelve N2 (= hallazgo 5 de C-M2, sigue sin corregir).
2. T1-2.4 `ejercicios.ts:19`: usar `degToRad` de sim-core en vez de `DEG_TO_RAD` propio, por consistencia con T1-2.1 (N1 = hallazgo 3 de C-M2, reaparecido).
3. Los hallazgos 8, 14, 15 y 16 de C-M2 siguen abiertos como decisiones de estándar pendientes (`CONTENT-STANDARDS.md` §4 y §5); no son nuevos y no bloquean este módulo.

## Veredicto

**Módulo aprobado con tickets.** No hay hallazgos bloqueantes ni altos. Un hallazgo medio (N2, widget de T1-2.1 con valores distintos del gancho, ya conocido de C-M2) y hallazgos bajos heredados o de forma. La reestructuración del módulo (fusión de T1-2.4, reordenamiento de T1-2.3, retirada de α y a=α·r de T1-2.1/T1-2.2) se hizo correctamente: física correcta en los 24 dorados, orden respetado, sin contradicciones entre documentos, y el punto crítico del punto de trabajo del motor en `GearWidget` bien resuelto.
