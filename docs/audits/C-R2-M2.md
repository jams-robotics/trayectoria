# Auditoría de coherencia — C-R2-M2

2026-09-30 · auditor de coherencia · T2-2.1 El sensor de línea (antes `ruta-1/m06-t01`, T-6.1), T2-2.2 Control on/off y proporcional (antes `ruta-1/m06-t02`, T-6.2), T2-2.3 Control PID (antes `ruta-1/m06-t03`, T-6.3), T2-2.4 Geometría del robot y desempeño (antes `ruta-1/m06-t04`, T-6.4) y T2-2.5 Proyecto final: tu robot completa la pista (antes `ruta-1/m06-t05`, T-6.5), todos `status: published` sobre `main` tras la reestructuración de rutas (#574) y el guion de un paso por módulo del proyecto final (#564).

## Método

Se leyeron completos `docs/CURRICULUM.md` (cabecera, «Estructura» y § T2-2.1 a T2-2.5), `docs/CONTENT-STANDARDS.md`, `docs/GLOSSARY.md` y `docs/WIDGETS.md` (`LineSensorWidget`, `LineFollowerWidget` y sus rangos de sliders). Se leyeron los cinco `index.mdx`, `ejercicios.ts` y `alrobot.ts`, y se recalcularon con Node (`cr2-recalc-m2.js`, scratchpad) los 26 valores dorados de la spec: semiancho y pérdida de línea, e1-e3 de T2-2.1; ω del gancho y K_p máxima de T2-2.2; velocidad y ω_base límite de T2-2.3; avance por ciclo y sensibilidad de T2-2.4; v_pred, t_pred y los siete pasos del guion del proyecto final (rpm de rueda y motor, rampa, aceleración centrípeta, ticks de encoder, R = v/ω y v_ext, v_med y Δ%). Los 26 cuadran. `pnpm vitest run -- ruta-2` (54 archivos, 647 tests) y `pnpm content:check` (0 incumplimientos) siguen verdes desde la sesión de M0. Se sirvieron las cinco páginas de M2 y las 9 citadas de ruta-1 en `localhost:4411` (200 OK todas; servidor detenido al terminar).

Se cruzaron los issues #569-#573 y #550 contra M2, y se verificó específicamente que cada paso del proyecto final (T2-2.5) se pueda comprobar con lecturas reales del `LineFollowerWidget` según `WIDGETS.md` (panel de valores, «Última vuelta», «Mejor vuelta», «Velocidad media», «Distancia recorrida», gráficas de error, v y PID).

## Hallazgos

| # | Tema/archivo | Tipo | Descripción | Severidad | Ticket |
|---|---|---|---|---|---|
| 1 | T2-2.2 `index.mdx:79` vs. T2-2.4 `index.mdx:140` | contradicción entre documentos · física | T2-2.2 deriva y escribe `ω = (ω_R − ω_L)·r/L = −2ur/L` (con signo negativo, correcto: u positiva gira el robot hacia la línea, ω negativa). T2-2.4, en el tercer experimento del Explora, escribe la misma relación sin el signo: «la velocidad angular del robot es ω = 2ur/L: con L mayor, ω es menor». Es la contradicción de signo del hallazgo original #569.4 (antes entre `m06-t02` y `m06-t04`), que la reestructuración no corrigió: sigue presente entre los mismos dos temas con sus nuevos ids. La conclusión cualitativa de T2-2.4 (ω decrece en magnitud con L mayor) es correcta pese al signo, pero la fórmula escrita contradice la de T2-2.2 dentro del mismo módulo. | media | ver recomendaciones |

No se encontró ningún hallazgo alto: los 26 dorados recalculados cuadran, no hay error físico nuevo y no hay violación de orden ni de prerrequisitos.

## Verificación de la lista mínima

1. **Física.** Los 26 dorados recalculados en Node cuadran exactamente con la spec: T2-2.1 semiancho 0.024 m, pérdida 0.034 m, e1 p = 0.03571, e2 p = −0.7857, e3 y = 0.000857 m; T2-2.2 ω = −1.365 rad/s, K_p ≤ 5.94; T2-2.3 v ≤ 0.447 m/s, ω_base ≤ 13.96 rad/s; T2-2.4 avance por ciclo 0.0134 m, p = 0.375; T2-2.5 v_pred = 0.48 m/s, t_pred = 5.773 s, y los siete pasos del guion (143.2 rpm rueda, 4297 rpm motor, t_rampa = 0.375 s, x_rampa = 0.09 m, a_c = 0.9216 m/s², ≈4961 ticks/vuelta, ω ≈ 1.92 rad/s, v_ext ≈ 0.624 m/s = 19.5 rad/s, v_med ≈ 0.483 m/s, Δ% ≈ −0.6 %).
2. **Orden.** T2-2.1 declara `[ruta-2/m00-t02]` y no usa nada posterior. T2-2.2 declara `[ruta-2/m02-t01, ruta-2/m01-t02, ruta-1/m03-t03, ruta-1/m01-t03]`, cita τ_m de T1-3.3 y ω_max de T1-1.3 con enlace, sin recalcular. T2-2.3 declara `[ruta-2/m02-t02, ruta-1/m03-t03, ruta-1/m01-t04]`, cita τ_m de T1-3.3 y v_max de T1-1.4. T2-2.4 declara `[ruta-2/m02-t03, ruta-2/m01-t01, ruta-1/m02-t04, ruta-1/m01-t04]`, cita la pérdida de línea de T2-2.1 sin `RobotFormula` propia (`index.mdx:153-156`) y F_rueda = τ_rueda/r de T1-2.4 con enlace. T2-2.5 declara los 9 prerrequisitos de las dos rutas que exige la regla 5 de `CURRICULUM.md` (proyecto final consume un número de cada módulo); cada paso del guion cita su tema con enlace y ningún paso usa una fórmula no enseñada en ese punto de las dos rutas. Sin violaciones de orden.
3. **Prerrequisitos.** Los cinco frontmatter coinciden con la spec: T2-2.1 `[ruta-2/m00-t02]`; T2-2.2 `[ruta-2/m02-t01, ruta-2/m01-t02, ruta-1/m03-t03, ruta-1/m01-t03]`; T2-2.3 `[ruta-2/m02-t02, ruta-1/m03-t03, ruta-1/m01-t04]`; T2-2.4 `[ruta-2/m02-t03, ruta-2/m01-t01, ruta-1/m02-t04, ruta-1/m01-t04]`; T2-2.5 los 9 ids de `CURRICULUM.md` § T2-2.5, en el mismo orden. Todos existen y van antes en su ruta o en la que ruta-2 sigue.
4. **Notación/glosario.** k, v_k, k̄, p, y_línea, b_k, u (T2-2.1); e, u, u_0, K_p, ω_base (T2-2.2); u_k, K_i, K_d, I_max, e_k, e_{k−1} (T2-2.3); y_sensor, y_perdida, Δs_ciclo, v_int, v_ext (T2-2.4); v_pred, t_pred, v_med, Δ% (T2-2.5) coinciden con `GLOSSARY.md` §Seguidor de línea. `K_d` en el glosario está en rad (`GLOSSARY.md:162`); T2-2.3 lo usa consistentemente en la fórmula del término D con Δt_c en el denominador, dimensionalmente correcto.
5. **Unidades.** Correctas en los cinco temas: rad/s para u y ω_base, adimensional para e y p, m para y_línea e y_perdida, s para Δt_c e I_max.
6. **«Mi robot» sin duplicados.** T2-2.1 calcula `half-width` y `loss-offset` (primera vez). T2-2.2 calcula `robot-omega` y `kp-max` (primera vez), con los comandos del gancho en una `Formula` estática sin `RobotFormula` (no dependen del perfil). T2-2.3 calcula `outer-wheel-speed` y `omega-base`, citando `v_max` de T1-1.4. T2-2.4 calcula `step-distance` y `line-position`, citando la pérdida de línea de T2-2.1 sin recalcularla (regla 2 de `CURRICULUM.md`, confirmado en `alrobot.ts:9-10`: «which the text cites without a calc of its own»). T2-2.5 calcula `predicted-speed` y `predicted-lap-time`, con `v_med` y `Δ%` del robot de referencia en `Formula` estática (no dependen del perfil del estudiante, que se mide en vivo). Sin duplicados.
7. **Props de widgets.** `LineSensorWidget` (T2-2.1), `LineFollowerWidget` con `controller="p"` (T2-2.2), `"pid"` (T2-2.3, T2-2.4, T2-2.5) y `MyRobotWidget mode="form"` (T2-2.4, T2-2.5) usan exactamente las props de `WIDGETS.md`, incluidos los `initialParams` de cada controlador y `showPlots`.
8. **Contradicciones entre documentos.** Un caso: el hallazgo 1 de esta tabla (signo de ω entre T2-2.2 y T2-2.4). Fuera de eso, ninguna.

## Verificación específica: proyecto final realizable con el simulador (T2-2.5)

Cada uno de los 7 pasos se comprueba con una lectura que `LineFollowerWidget` expone según `WIDGETS.md` §LineFollowerWidget y §Relación tema → widgets:
- Paso 1 (rpm): «el máximo del control "Velocidad base"» — el slider `omegaBase_radps` existe y su rango es `[0, ω_max]` del robot (`WIDGETS.md:247`); el estudiante puede leer su tope.
- Paso 2 (rampa y tiempo de vuelta): «Última vuelta» tras la 1.ª y la 2.ª vuelta — instrumentos listados en `WIDGETS.md` §LineFollowerWidget y confirmados en el Explora de T2-2.5 (`index.mdx:107`: «panel da v, ω, las vueltas y t, y la tarjeta de vueltas, la "Última vuelta"...»).
- Paso 3 (a_c): «v en la curva» — panel de valores en pausa, mismo mecanismo que el experimento 2 del Explora.
- Paso 4 (autonomía): explícitamente declarado como estimación, no medida («el simulador no modela la batería», `index.mdx:62`); no depende de una lectura que falte.
- Paso 5 (ticks): «Distancia recorrida» — instrumento confirmado en `WIDGETS.md` y en el panel del Explora de T2-2.4 y T2-2.5.
- Paso 6 (R = v/ω): «v y ω en pausa, en la curva» — mismo panel que el paso 3.
- Paso 7 (PID y comparación): «Última vuelta» y «Velocidad media» — instrumentos confirmados.

Los 7 pasos son realizables con lo que el simulador muestra, sin pedir ninguna lectura que `LineFollowerWidget` no exponga.

## Hallazgos pendientes de #569–#573 y #550 (issues de GitHub, consolidado por el orquestador)

Ids previos a #574: `ruta-1/m06-t01` → T2-2.1, `m06-t02` → T2-2.2, `m06-t03` → T2-2.3, `m06-t04` → T2-2.4, `m06-t05` → T2-2.5.

| Issue | Punto | Tema | Estado | Evidencia |
|---|---|---|---|---|
| #569.4 | Signo de ω del robot: `m06-t02` establece ω = −2ur/L; `m06-t04` escribe 2ur/L | T2-2.2 / T2-2.4 | **Sigue abierto**, confirmado como hallazgo 1 de esta auditoría. | `index.mdx:79` de T2-2.2 vs. `index.mdx:140` de T2-2.4. |
| #569.6 | Índice de sensores: «Sensor 1» = izquierdo en el panel de marcos (`DiffDriveWidget`) y k = 0 = izquierdo en `m06-t01` y `LineSensorWidget` | T2-2.1 (y T2-0.2) | **Parcial, matizado.** | «Sensor 1» es el nombre de una fila de un panel distinto (`DiffDriveWidget`, T2-0.2, `index.mdx:115`: «la fila "Sensor 1" del panel de marcos, el sensor izquierdo extremo»), no el índice k del arreglo de `LineSensorWidget` (T2-2.1, `index.mdx:61`: «k · índice del sensor, 0 el de la izquierda»). Los dos widgets nombran al mismo sensor físico de forma distinta (fila "1" en un panel, índice "0" en el otro): no es la misma variable pero sí puede confundir. No se verificó si `DiffDriveWidget` usa 1-index en otras filas; queda como spec gap de relectura dirigida. |
| #569.13 | Δt_c del PID se usa sin valor en `m06-t03`; aparece en `m06-t04` (20 ms); el simulador ejecuta el lazo cada 1 ms, no cada 20 ms | T2-2.3 / T2-2.4 | **Sigue abierto**, confirmado. | T2-2.3 usa Δt_c en sus fórmulas (`index.mdx:54-79`) sin darle un valor numérico en el tema; T2-2.4 sí lo fija en 20 ms (`alrobot.ts:14`: `CONTROL_PERIOD_S = 0.02`), como constante del texto y no del simulador. No se verificó contra `Simulation.ts` si el simulador real ejecuta a 1 ms; queda como spec gap de relectura dirigida (el ticket original decía que el simulador no expone Δt_c). |
| #569.14 | Conteos «25 cambios de signo en 15 s» y «bajan de 38 a 22» dependen del muestreo, no declarado | T2-2.2 / T2-2.3 | **Sigue igual, sin corregir; matizado con RMS.** | T2-2.2 (`index.mdx:132-136`) y T2-2.3 (`index.mdx:99-102`) siguen dando esos conteos de cruces de signo sin declarar el muestreo, pero ambos los acompañan de un valor RMS del error, que sí es independiente del muestreo (recomendación del issue original, parcialmente adoptada). |
| #573 (ROB-11) | El límite de ω_base por la curva es necesario, no suficiente: con K_p alto la rueda exterior satura aunque ω_base esté bajo el límite | T2-2.3 | **No incorporado como aviso explícito.** | T2-2.3 explica el límite de ω_base por geometría de curva (`index.mdx:128-146`) pero no advierte que una K_p alta puede saturar la rueda exterior en una esquina aunque ω_base esté dentro del límite. Sugerencia, no error. |
| #573 (ROB-14) | sgn(0) en el on/off: la fórmula da u = 0 en e = 0, el texto dice «nunca manda u = 0» | T2-2.2 | **Sigue presente, sin verificar contra el código del controlador.** | `index.mdx:33-35`: «Nunca manda u = 0, así que incluso con la línea centrada el robot gira hacia un lado». La fórmula `u = u_0·sgn(e)` (`index.mdx:61`) da matemáticamente u = 0 en e = 0 exacto; el texto asume que en la práctica e nunca es exactamente 0 (ruido, cuantización), lo cual es plausible pero no se dice. No se leyó `onOff.ts` para confirmar el comportamiento real del código (fuera del alcance de auditoría de contenido); spec gap de relectura dirigida. |
| #573 (ROB-17) | No sustituir en silencio el perfil por el robot de referencia cuando ω_max < ω_base | T2-2.2, T2-2.5 | **Sigue como sustitución silenciosa, mencionada en el texto.** | T2-2.2 `alrobot.ts:99-104` y T2-2.5 `alrobot.ts:35-42` sustituyen el robot de referencia cuando ω_max < ω_base, y el texto lo dice explícitamente en ambos (T2-2.2 `index.mdx:161-163`, T2-2.5 `index.mdx:165-167`): «Si su ω_max no supera/llega a ω_base, [...] el cálculo también usa el robot de referencia». Es una decisión de spec documentada (#447, #474 en los comentarios del código), no un error silencioso sin explicación; la sugerencia de #573 pedía mostrar «no realizable» en vez de sustituir, que sigue sin implementarse pero está declarado. |
| #573 (PED-34) | El Explora de `m06-t04` obliga a sobrescribir y restaurar el perfil a mano tres veces | T2-2.4 | **Sigue igual.** | `index.mdx:109-111` y `:145`: «anota los valores de tu perfil: al terminar tendrás que restaurarlos, porque "Guardar" sobrescribe tu perfil real» ... «Al terminar, vuelve a escribir en el formulario los valores que anotaste y guarda». Sigue siendo manual, como señala la sugerencia; no bloquea, es UX. |
| #573 (PED-33) | Un ejercicio de Verifica que use los números del propio simulador en el proyecto final | T2-2.5 | **Explícitamente declarado como pendiente por la propia spec, no un hallazgo nuevo.** | `CURRICULUM.md` § T2-2.5, Verifica: «El ejercicio con los números del propio simulador de #564 queda pendiente (decisión 11)»; `index.mdx:194-198` v Verifica solo tiene e1-e3 generados, coincide. |
| #573 (PED-31) | Homogeneizar títulos: el módulo «Rotación» contenía Transmisión y Encoders | — | **No aplica a M2**, resuelto por la reestructuración general (Encoders está en M0 de ruta-2, no en Rotación). |
| #550 | Números sin redondear expuestos al usuario | General | **Parcialmente mitigado en el contenido de M2.** | Los `alrobot.ts` de M2 formatean con `toPrecision`/`toFixed` explícitos (p. ej. `SPEED_SIGNIFICANT_FIGURES = 3` en T2-2.3 y T2-2.5, `OMEGA_SIGNIFICANT_FIGURES = 4` en T2-2.2 y T2-2.3). El hallazgo original apunta al slider de `ControllerPanel.tsx` (`max="20.943951..."`), que sigue siendo el máximo real de `ω_max` sin redondear en el rango del slider `omegaBase_radps`/`delta_radps` (`WIDGETS.md:247`: «van en `[0, ω_max]` del robot»); no se verificó el código de `ControllerPanel.tsx` en esta auditoría de contenido. |

## Deriva detectada entre módulos

Frente a C-R2-M0 y C-R2-M1, M2 introduce un patrón nuevo consistente en los cinco temas: los Explora de T2-2.2 a T2-2.5 dan cifras medidas del simulador con mucha más precisión y detalle que M0/M1 (RMS del error, conteos de cruces de signo, tiempos de vuelta con dos decimales), documentado en la cabecera del módulo (`CURRICULUM.md:406`: «El ticket del tema escribe las cifras tal como salen en el widget»). No es una deriva de tono sino una decisión de spec explícita para este módulo, consistente en los cinco temas.

## Recomendaciones para el orquestador

1. `content/es/ruta-2/m02-t04/index.mdx:140`: corregir `ω = 2ur/L` a `ω = −2ur/L` (o explicar el cambio de signo si es intencional), para que coincida con la derivación de T2-2.2 (`index.mdx:79`). Resuelve el hallazgo 1 (= #569.4, sigue abierto tras la reestructuración).
2. Relectura dirigida de #569.6 (índice de sensores «Sensor 1» vs. k = 0), #569.13 (Δt_c sin valor en T2-2.3 vs. el paso real del simulador) y #573/ROB-14 (sgn(0) en on/off) contra el código de `packages/sims`, fuera del alcance de un auditor de contenido.

## Para la validación del humano

| # | Tema | Qué vería distinto el estudiante | Origen |
|---|---|---|---|
| 1 | T2-2.4 | Un signo negativo en una fórmula del tercer experimento del Explora. | #569.4, esta auditoría |

## Veredicto

**Módulo aprobado con tickets.** Un hallazgo medio (contradicción de signo entre T2-2.2 y T2-2.4, heredada de #569.4 y no resuelta por la reestructuración). Sin hallazgos altos: los 26 dorados recalculados cuadran, los prerrequisitos y el orden son correctos, y los siete pasos del proyecto final son realizables con lo que el simulador muestra según `WIDGETS.md`.
