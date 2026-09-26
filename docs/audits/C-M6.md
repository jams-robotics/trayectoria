# Auditoría de coherencia — C-M6

2026-09-26 · auditor de coherencia / Claude Opus 5.5 · T-6.1 El sensor de línea (#440, con `LineSensorWidget`), T-6.2 Control on/off y proporcional (#447), T-6.3 Control PID (#446), T-6.4 Geometría del robot y desempeño (#454) y T-6.5 Proyecto final: tu robot completa la pista (#458). Los cinco están en `status: review` sobre `main` (98059a3).

## Método

Se leyeron completos los cinco temas: `content/es/ruta-1/m06-t0{1..5}/index.mdx`, `ejercicios.ts`, `alrobot.ts` y sus tests, y los enunciados de `packages/i18n/locales/es/content.json`. Se revisaron contra `CONTENT-STANDARDS.md`, `GLOSSARY.md` (§ Seguidor de línea y § Robot diferencial), `WIDGETS.md` (`LineSensorWidget`, `LineFollowerWidget`, `MyRobotWidget` y `RobotFormula`), `REFERENCES.md` y `CURRICULUM.md` (Módulo 6 tras #401, #438 y #456, y la lista mínima de «Auditorías de coherencia»). También se aplicaron las decisiones del orquestador:

- #419–#422: en Explora, «observa» nombra algo que se ve en el widget, y las cifras medidas (cambios de signo, RMS, error medio) van en el desplegable.
- QA de #447: `kp-max` usa el robot de referencia si la ω_max del perfil no supera ω_base = 15 rad/s.
- #453: las cifras que dependen del reloj del widget se escriben aproximadas («≈ 5.5 s», «hacia t ≈ 1 s»).

Se comprobaron las etiquetas de los controles citados en el texto contra `widgets.json` y `sims.json`, y el modelo de reflectancia (`sim-core/src/track/Track.ts`, huella de 4 mm) para las cifras de T-6.1. Después se compararon con M5 y con las líneas base de C-M5.

En cada tema y entre los cinco se revisó:

1. Símbolos: todos existen en el glosario con la misma unidad, y se usan los mismos para lo mismo.
2. Fórmulas: las de la spec aparecen tal cual, cada una con su lista de variables. Se comprobó por coincidencia exacta de cadenas.
3. Widgets: son los de la spec, con sus props exactas, y los valores de los experimentos caben en los sliders y en el formulario de «Mi robot».
4. Al robot: `RobotFormula` sobre `useMyRobot()`, con respaldo al robot de referencia, y el ejemplo de referencia de la spec.
5. Ejercicios: valores dorados y tolerancia en los tests, unidad en el enunciado, rejilla exacta y rangos realistas. Con los generadores reales (20 000 semillas por ejercicio) se midió qué fracción de enunciados no muestra exactos sus datos con las 4 cifras significativas de `ExerciseWidget`, y qué fracción deja una respuesta con tolerancia relativa en 0 < |x| < 0.01, la regla de #451.
6. Tono, longitudes y forma de Explora, con un recuento de palabras y de frases.
7. Nivel, progresión 6.1 → 6.5, prerrequisitos y comparación con M5.
8. Referencias.
9. Página generada: `pnpm build` en el worktree de la auditoría y búsqueda de las siete secciones en `apps/web/dist/ruta/ruta-1/m06/t0{1..5}/index.html`.

Cada hallazgo se clasifica según la decisión del humano en #460:

- **Técnico:** no cambia lo que ve el estudiante, o devuelve la página a lo que ya dicen la spec, los estándares o una regla ya aplicada por el orquestador, sin cambiar su contenido. Si es bloqueante, se abre un ticket de corrección.
- **Visible:** cambia lo que ve el estudiante. Va a «Para la validación del humano» y no se corrige ahora.

Se revisó sin hallazgos:

- **Anatomía y frontmatter.** Las siete secciones están en orden en los cinco `index.mdx`, y las siete salen en la página generada de los cinco temas. Título, tiempo, prerrequisitos, objetivos, widgets, ejercicios obligatorios y referencias coinciden con la spec. `ruta.json` los lista en orden. `pnpm content:check`: 27 temas, 0 incumplimientos. La regla de #452 (etiquetas de cierre en la columna 0) se cumple.
- **Fórmulas.** Las 23 de la spec aparecen idénticas (4, 6, 4, 5 y 4), todas con su lista de variables. En T-6.3, `v_{ext} ≤ v_{max}` y la cota de ω_base van en un solo bloque unidos por ⇒, como en la spec. Todos los símbolos de las listas y de los enunciados están en `GLOSSARY.md` con la misma unidad: k̄, v_k, b_k, u (umbral), y_línea, σ, e, u, u_0, K_p, K_i, K_d, \|e\|_max, u_k, e_k, e_{k−1}, I_max, ω_base, v_ext, v_int, Δθ, y_sensor, y_perdida, w, Δs_ciclo, Δt_c, v_pred, t_pred, v_med, t_vuelta, Δ% y D. `k` y `u` llevan calificador en el glosario para sus dos usos.
- **Props de los widgets.** Las cinco instancias llevan las props exactas de la spec:
  - T-6.1:88, `LineSensorWidget initialOffset_m={0} showBinary noiseSigma={0.03}`;
  - T-6.2:96-101, T-6.3:84-89, T-6.4:97-102 y T-6.5:90-95, `LineFollowerWidget` sin `compact`;
  - T-6.4:104 y T-6.5:88, `MyRobotWidget mode="form"`.

  Todos los valores de los experimentos caben en los controles: desplazamiento de 0.012 m y ruido de 0.1 en T-6.1; K_p = 2, 8 y 20, u_0 = 4, 8 y 8.5 rad/s, K_d = 0.8, K_i = 2 y 10, y límite integral 0.1 en T-6.2 y T-6.3; d = 0.15 m, N = 3 y L = 0.25 m en el formulario de T-6.4; K_d = 0.05 y 0.3 en T-6.5. Las etiquetas citadas existen: «Corrección», «Límite integral», «Adelanto respecto al eje», «Número de sensores», «Distancia entre ruedas», «Última vuelta», «Mejor vuelta», «Distancia recorrida», «Velocidad media», «Reproducir» y «On/off».
- **Cifras de T-6.1.** Con la huella de 4 mm, los sensores 1 y 3 leen 0.5 con la línea centrada, y la suma baja de 0.5 justo después de 0.036 m, como dicen el experimento 2 y el 3 y los dorados de `WIDGETS.md`.
- **Regla de «observa» (#419–#422).** Los 16 experimentos piden observar algo que se ve: barras, aviso de línea perdida, escena, traza, gráficas de error, ω, v y PID, contador de vueltas y lecturas. Las cifras medidas van en el desplegable.
- **Longitudes.** Concepto tiene 306, 288, 310, 302 y 293 palabras (rango 150–350). Al robot tiene 181, 194, 155, 197 y 174 (rango 100–300). T-6.1 a T-6.4 tienen tres experimentos, y T-6.5 cuatro. Ninguna respuesta pasa de 3 frases.
- **Tono.** Trato de tú, sin exclamaciones ni emojis, con punto decimal. Cada término en negrita (sensor de reflectancia, índice ponderado, umbral, perdida, error, acción de control, lazo cerrado, on/off, control proporcional, PID y anti-windup) se define una sola vez en la ruta. Las excepciones están en el hallazgo 17.
- **Valores dorados.** Los 18 ejercicios de la spec están en los tests con su tolerancia: 22 valores, contando cada componente de las respuestas vectoriales. Las tolerancias son las de la spec: 0.01 absoluta en T-6.1 e1, 0.0002 m en T-6.1 e3, 0.001 m en T-6.4 e1, 0.5 absoluta en el Δ% de T-6.5 e3 y 2 % relativa en el resto. Los ejemplos de Al robot están en los tests de `alrobot.ts`:
  - T-6.1: 0.024 m y 0.034 m;
  - T-6.2: 18.2 y 11.8 rad/s, −1.365 rad/s y K_p ≤ 5.94;
  - T-6.3: 0.447 m/s y 13.96 rad/s;
  - T-6.4: 0.034 m, 0.0134 m y p = 0.375;
  - T-6.5: 0.480 m/s y 5.773 s.

  Las cuentas del texto, de Explora y de las respuestas se rehicieron a mano y son correctas. Entre ellas: k̄ = 2.9/1.4 = 2.071, 2u = 6.4 rad/s, (20.94 − 15)/8 = 0.74, K_i·I_max = 1 rad/s, 0.0335 m con un lazo de 50 ms, 0.483 m/s y −0.6 %. `vitest` sobre `m06`: 103 de 103.
- **Al robot.** Los cinco temas calculan con `RobotFormula` sobre el perfil, y toman el robot de referencia si el perfil no es móvil. `kp-max` aplica el respaldo decidido en el QA de #447, y el texto lo explica (T-6.2:156-158). Los cálculos que no dependen del perfil van en `Formula` estática: los comandos de T-6.2 y v_med y Δ% de T-6.5.
- **Líneas base de C-M5.**
  - Ninguna etiqueta de cierre sangrada. Ahora lo comprueba `content:check` (#452), y la página generada tiene las siete secciones.
  - «—» para las magnitudes sin dimensión (p, k̄, e, N, \|e\|_max).
  - Techo de 1.5 m/s con «tu robot»: T-6.4 e2 llega justo a 1.5 m/s (#274).
  - ω_max para la velocidad máxima de la rueda.
  - No se cumplen «rumbo» (hallazgo 12), la regla de las respuestas casi nulas (hallazgos 2 y 8), los números del robot de referencia (hallazgo 9) ni la de ningún identificador de código (hallazgo 11).
- **Gancho respondido en Concepto.** T-6.1:36-37 (p = 0.0357), T-6.2:35-37 (6.4 rad/s), T-6.3:28-34 (P deja el sesgo e I lo quita; D amortigua), T-6.4:29-46 y T-6.5 con el guion completo.

## Hallazgos

| # | Tema/archivo | Tipo | Clase | Descripción | Severidad | Ticket |
|---|---|---|---|---|---|---|
| 1 | T-6.2 `ejercicios.ts:82-124` | ejercicios (rejilla) | técnico | e2 sortea ω_L y ω_R en milésimas, pero el enunciado los muestra con 4 cifras significativas, así que la milésima se pierde cuando el comando pasa de 10 rad/s. En ≈ 60 % de las instancias el enunciado no muestra los datos exactos. En ≈ 1.2 %, la respuesta calculada exactamente con lo que se ve se rechaza: con la semilla 35, el enunciado dice 14.51 y 14.49 rad/s, la respuesta esperada es −0.004693 rad/s, y la calculada con lo que se ve, −0.004267 (9 % de diferencia). Es un ejercicio obligatorio. | bloqueante | [#461](https://github.com/jams-robotics/trayectoria/issues/461) |
| 2 | T-6.2 `ejercicios.ts` (e1, e2); T-6.3 `ejercicios.ts:69-145` (e1, e3) | ejercicios (tolerancia) | técnico | La regla de #451 (volver a sortear si 0 < \|respuesta\| < 0.01 con tolerancia relativa), que el orquestador aplicó a M5, no está en M6. Quedan por debajo de 0.01: ω_R en T-6.2 e1 (≈ 0.05 % de las instancias), ω en T-6.2 e2 (≈ 0.08 %), u_k en T-6.3 e1 (≈ 0.13 %) y el término D en T-6.3 e3 (≈ 0.01 %). T-6.4 e2 va aparte (hallazgo 8). | mayor | — (junto a #461, si se decide) |
| 3 | `REFERENCES.md` | referencia | técnico | M6 estrena `astrom-murray-11` y `siegwart-2`, sin capítulo confirmado. Tampoco se han confirmado `siegwart-3`, `siegwart-4`, `corke-4` ni `craig-2` (hallazgo 2 de C-M5). `REFERENCES.md:3` exige la confirmación al primer uso. La fila de Åström y Murray tampoco da editorial, año ni ISBN. Requiere un lote DOCS del humano. | mayor | — (DOCS) |
| 4 | `GLOSSARY.md:126`, `:163` | notación | técnico | Δθ aparece dos veces sin calificador: «giro del robot en un paso de odometría» (§ Robot diferencial) y «error de rumbo» (§ Seguidor de línea). La cabecera de § Seguidor de línea dice que los símbolos que chocan llevan calificador. En el texto no hay ambigüedad, porque cada tema usa uno solo. | menor | — (DOCS) |
| 5 | `CONTENT-STANDARDS.md` §5 frente a T-6.1 e1 y e3, T-6.4 e1 y T-6.5 e3 | ejercicios (tolerancia) | técnico | §5 solo admite tolerancia absoluta para ángulos y tiempos cortos. La spec (#396) la usa para p, para desplazamientos en m y para Δ% en puntos porcentuales. Los temas siguen la spec. Falta anotar la excepción en §5. | menor | — (DOCS) |
| 6 | PR #447 y commit e411487 (T-6.2) | trazabilidad | técnico | La descripción del PR de T-6.2, y el mensaje de su commit de squash, son el informe de C-M5 (#450), no el de T-6.2. El tema no tiene su reporte de PR en el registro. Los comentarios de QA y el merge sí son de T-6.2. | menor | — |
| 7 | T-6.1 `index.mdx:116-118`; T-6.2 `:161`; T-6.4 `:109`; `content.json:134-161` | estilo (formato) | técnico | La respuesta del experimento 3 de T-6.1 no está sangrada, y las otras dos sí. Dos líneas de T-6.2 y T-6.4, retocadas en el QA, rompen el ancho de línea del resto. En `content.json`, las claves van en el orden t01, t03, t04, t02, t05. No cambia lo que se ve. Los cinco `ejercicios.ts` copian `drawOnGrid`, `loss-offset` está repetido en T-6.1 y T-6.4, y el formato de los números varía (`Number(toPrecision)`, `toPrecision`, `toFixed`). Esto último es terreno del auditor de código, y aquí solo se anota. | menor | — |
| 8 | T-6.4 `ejercicios.ts:81-92`; `content.json:148` | ejercicios (tolerancia) | visible | En e2, Δs_ciclo = v·Δt_c queda por debajo de 0.01 m en ≈ 46 % de las instancias (siempre con Δt_c = 5 ms) y se pide en m con tolerancia relativa del 2 %. Una respuesta exacta como 0.00185 m pasa, pero redondeada al milímetro (0.002 m) se rechaza. Aplicar la regla de #451 descartaría casi la mitad del rango de la spec. | mayor | — (validación) |
| 9 | T-6.1 `index.mdx:83-86`, `:95-118`; T-6.3 `:80-82`, `:96-121` | widget / nivel | visible | `LineSensorWidget` y `LineFollowerWidget` usan el robot del perfil, pero T-6.1 y T-6.3 dan cifras del robot de referencia sin decirlo. T-6.1 habla del «arreglo de 5 sensores de tu robot», la pérdida a 0.036 m y los sensores 1 y 3 en 0.5, y T-6.3 dice «Tu robot recorre la pista» con cambios de signo 38 → 22 y errores medios. T-6.2 (`:92`), T-6.4 (`:107`) y T-6.5 (`:103`, `:123`) sí lo aclaran. Con otro perfil, el estudiante ve otras cifras. Es la línea base de C-M5. | menor | — (validación) |
| 10 | T-6.2 `:108-131`; T-6.5 `:123`, `:153` frente a T-6.4 `:109`, `:139` | widget | visible | La decisión de #453 (cifras del reloj del widget con «≈») solo se aplicó en T-6.4. T-6.2 escribe exactos 1.59 s, 6.04 y 5.85 s, 7.9 s y 8.86 s, y T-6.5 escribe 5.98, 5.74 y 5.74 s. En el navegador, T-6.5 dio 5.73 y 5.75 s (PR #458). Son las cifras de la spec, pero el estudiante puede ver otras en ±0.03 s. | menor | — (validación) |
| 11 | T-6.3 `:80`, `:126`; T-6.2 `:92`; T-6.5 `:10`, `:25`, `:84`, `:146` | estilo | visible | T-6.3 nombra la pista como código, `` `tight` ``, contra la línea base de C-M4. Además, cada tema llama de una forma distinta a las pistas: «pista ovalada» en T-6.2, «pista oval» en T-6.5 (también en un objetivo) y «pista de curvas cerradas» en T-6.4. El simulador las llama «Óvalo» y «Curvas cerradas» (`sims.json:34-36`). `oval` y `tight` salen de la spec. | menor | — (validación) |
| 12 | T-6.4 `:26`, `:60`, `:66`, `:117`, `:164`; `content.json:149` | notación | visible | T-6.4 usa «rumbo» para la orientación θ: «si su rumbo se desvía», «error de rumbo Δθ», «desvío de rumbo». La línea base de C-M5 reservaba «rumbo» para θ_objetivo. La spec y el glosario de M6 (Δθ, «error de rumbo») usan la palabra así, de modo que la línea base choca con `docs/`. | menor | — (validación) |
| 13 | T-6.3 `alrobot.ts` (`v_{\max}`); T-6.4 `alrobot.ts` (`v_{\max}`) frente a T-6.2 `:83`, T-6.3 `:68` (`\omega_{max}`, `v_{max}`) | notación | visible | En la misma página, «max» sale en cursiva en las Fórmulas (`v_{max}`, copiado de la spec) y en redonda en Al robot (`v_{\max}`). Sigue la deriva de subíndices de palabra (hallazgo 9 de C-M5), ahora dentro de un mismo tema. | menor | — (validación) |
| 14 | T-6.3 `:25`, `:60` frente a T-6.4 `:39-41`, `:81`; T-6.1 `:39` frente a T-6.2 `:27` | notación | visible | El período del lazo es Δt en T-6.3 («período del lazo, el paso») y Δt_c en T-6.4 («período del lazo de control»), en dos temas seguidos. u es el umbral en T-6.1 y la acción de control en T-6.2. El glosario califica los dos usos de u, y los símbolos salen de la spec. | menor | — (validación) |
| 15 | T-6.3 `:19-22`; T-6.4 `:19-22`; T-6.5 `:19-22` | estilo (gancho) | visible | Tres de cinco ganchos no llevan números, y `CONTENT-STANDARDS.md` §2.1 los pide. El de T-6.4 tiene 3 frases (máximo 2). Los tres son literales de la spec. En M5 solo había uno sin números (hallazgo 10 de C-M5). | menor | — (validación) |
| 16 | T-6.1 `:19-21` frente a `:88`; T-6.2 `:128-131`; T-6.3 `:99`; T-6.4 `:129` | widget / nivel | visible | El widget de T-6.1 arranca con la línea centrada, que da 0, 0.5, 1, 0.5 y 0, no las lecturas del gancho (0, 0.2, 0.9, 0.3 y 0), que el modelo de rampa del widget no puede dar (`CONTENT-STANDARDS.md` §7). Los desplegables de T-6.2 a T-6.4 hablan de «RMS del error», que ni la ruta ni el glosario definen, y T-6.2 habla de «25 cruces de ±0.2», mientras que la cabecera de la spec cuenta los cambios de signo con histéresis de ±0.1. Las cifras salen de la spec. | menor | — (validación) |
| 17 | T-6.4 `:25`; T-6.5 `:28-43` | estilo | visible | T-6.4 pone en negrita el símbolo **d**, y T-6.5 las etiquetas «**Paso 1.**» a «**Paso 5.**». §4 reserva la negrita para el término que se define por primera vez. | menor | — (validación) |
| 18 | T-6.1 `:134` (`loss-offset`) | notación | visible | Al robot de T-6.1 muestra y_perdida en la fórmula sustituida, pero el símbolo no está en las Fórmulas del tema. Se define en T-6.4. | menor | — (validación) |
| 19 | T-6.5 `:124-126` | nivel | visible | «Con ruido de lectura (σ = 0.03) esa K_d amplificaría el ruido y perdería la línea, como viste en Control PID». T-6.3 solo lo afirma en el Concepto (`:39`), y ningún experimento lo muestra. La cifra sale de la spec. | menor | — (validación) |
| 20 | T-6.5 `alrobot.ts` (`predicted-speed`); `:141-142` | widget / Al robot | visible | La predicción usa ω_base = 15 rad/s con cualquier perfil. Si la ω_max del perfil es menor, el slider de ω_base (en [0, ω_max]) no llega a 15 y v_pred = 15·r pasa de v_max. Para el mismo caso, `kp-max` de T-6.2 tiene un respaldo (QA de #447). | menor | — (validación) |
| 21 | T-6.2 `ejercicios.ts:64-124`; `content.json:153-154` | nivel | visible | e1 solo evita que sature la rueda rápida. En ≈ 11 % de las instancias de e1 y e2, la rueda lenta gira hacia atrás (ω_base − K_p·\|e\| < 0), un caso que el Concepto no trata. El enunciado de e2 lo muestra con el guion de JavaScript («ω_L = -3.791 rad/s»), como ya anotó el hallazgo 15 de C-M1. Los rangos salen de la spec. | menor | — (validación) |

Resumen: 1 bloqueante, 3 mayores y 17 menores. Hay 7 técnicos (1 a 7). El 1 es bloqueante y tiene ticket (#461). Los otros 14 son visibles.

### Excepciones decididas por el orquestador o por la spec

- **#396 / #401 / #438 / #456 · huecos de la spec del Módulo 6.** Se aplican tal cual:
  - Cifras de Explora medidas en el simulador con τ_m = 0.185 s (#423).
  - `ω_base = 10` en T-6.4 y `kd: 0.3` en T-6.5, para que el robot de referencia no pierda la línea (#455).
  - Tolerancias absolutas de T-6.1 e1 y e3, T-6.4 e1 y el Δ% de T-6.5 e3 (hallazgo 5).
  - T-6.2 y T-6.5 con solo 3 ejercicios.
  - «Ruta completada» fuera de T-6.5.
- **#419–#422 · regla de «observa».** Se cumple en los 16 experimentos.
- **QA de #447 · respaldo de `kp-max`.** Se cumple, con su texto en T-6.2:156-158.
- **#453 · cifras del reloj del widget.** Se aplica en T-6.4, y no en T-6.2 ni en T-6.5 (hallazgo 10).
- **Decisiones dentro del alcance en los PR.**
  - T-6.5 agrupa los 5 pasos del guion en 4 experimentos (1 y 2 juntos), porque §4 admite de 2 a 4, y usa `MyRobotWidget mode="form"`, que la spec de T-6.5 no fija (#458).
  - T-6.3 e4 da 16.75 rad/s con la v_max = 0.670 m/s del enunciado. El dorado, 16.76, sale de v_max sin redondear, con un 0.06 % de diferencia (#446).
  - T-6.4 e4 no vuelve a sortear, porque los rangos ya dan R > L/2 (#454).

## Para la validación del humano

Son los hallazgos visibles. Ninguno se corrige ahora, y el módulo no se publica hasta la validación final.

1. **T-6.4 e2 con respuestas de milímetros en m** y tolerancia relativa (hallazgo 8, mayor). Propuesta: pedir Δs_ciclo en mm, o volver a sortear por debajo de 0.01 m quitando Δt_c = 5 ms.
2. **Robot de referencia sin decirlo** en Explora de T-6.1 y T-6.3 (hallazgo 9).
3. **Cifras del reloj del widget** exactas en T-6.2 y T-6.5, con «≈» solo en T-6.4 (hallazgo 10).
4. **Nombres de las pistas:** `tight` como código en T-6.3, y «ovalada», «oval» y «curvas cerradas» frente a «Óvalo» y «Curvas cerradas» del simulador (hallazgo 11).
5. **Notación:**
   - «rumbo» para la orientación en T-6.4 (hallazgo 12).
   - «max» en cursiva y en redonda en la misma página (hallazgo 13).
   - Δt y Δt_c para el mismo período, y u para el umbral y para la acción de control (hallazgo 14).
   - y_perdida en T-6.1 antes de definirse (hallazgo 18).
6. **Ganchos** sin números en T-6.3, T-6.4 y T-6.5, y con 3 frases en T-6.4 (hallazgo 15).
7. **Widgets y desplegables:**
   - lecturas del gancho de T-6.1 que el widget no da (hallazgo 16).
   - «RMS» sin definir y «cruces de ±0.2» (hallazgo 16).
   - ω_base = 15 fija en la predicción de T-6.5 (hallazgo 20).
8. **Presentación:** negritas en **d** y en «**Paso n.**» (hallazgo 17), y «como viste en Control PID» para algo que T-6.3 no muestra (hallazgo 19).
9. **T-6.2 e1 y e2:** rueda lenta hacia atrás sin aviso (hallazgo 21).

## Deriva detectada entre módulos

Frente a M5 y a las líneas base de C-M5:

- **Se mantiene:**
  - Al robot usa `RobotFormula` con el perfil y respaldo al robot de referencia.
  - Los ejercicios se sortean en rejilla exacta, salvo T-6.2 e2 (hallazgo 1).
  - Explora tiene frase descriptiva y experimentos con respuestas de 2–3 frases.
  - Longitudes parecidas: Concepto 274–312 palabras en M5 y 288–310 en M6; Al robot 158–196 y 155–197.
  - «—», ω_max y el techo de 1.5 m/s.
- **Mejora:**
  - Ninguna sección se pierde en la página generada, y `content:check` ya lo vigila (#452, recomendación 2 de C-M5).
  - Vuelven los enlaces internos: M5 no tenía ninguno y M6 tiene cinco (T-6.2 → T-5.2, T-6.4 → T-4.4 y T-0.2, T-6.5 → T-6.3 dos veces).
- **Densidad de fórmulas.** Sube de 4, 5, 3, 3 y 2 en M5 a 4, 6, 4, 5 y 4 en M6. La marca la spec.
- **Explora con cifras del simulador.** Es nuevo en M6: los desplegables dan tiempos de vuelta, cambios de signo, RMS y errores medios que el widget no muestra (#419–#422). Trae dos derivas: la aplicación desigual de #453 (hallazgo 10) y métricas sin definir (hallazgo 16).
- **Ganchos.** Empeoran: M5 tenía uno sin números, y M6 tiene tres, además de uno de 3 frases (hallazgo 15). Todos son literales de la spec.
- **Respuestas casi nulas.** La regla de #451 se aplicó a M5 después de C-M5, pero los temas de M6 ya estaban escritos y no la tienen (hallazgos 2 y 8).
- **«rumbo».** La línea base de C-M5 no se puede cumplir sin cambiar `docs/`, porque el glosario de M6 define Δθ como «error de rumbo» (hallazgos 4 y 12).
- **Subíndices de palabra.** Siguen sin regla en `docs/`, y ahora se mezclan dentro de un mismo tema (hallazgo 13).

M6 es el último módulo de la Ruta 1, así que no hay líneas base para un C-M7. Las de C-M4, C-M5 y esta auditoría deberían pasar a `CONTENT-STANDARDS.md` (recomendaciones).

## Recomendaciones para el orquestador

Son cambios en `docs/` o en el código de ejercicios que evitarían repetir los hallazgos. Los de `docs/` requieren al humano.

1. Decidir si la regla de #451 se aplica a M6 (hallazgo 2), en el mismo cambio que #461. Y llevarla a `CONTENT-STANDARDS.md` §5 junto con una segunda regla: el generador sortea en la rejilla que el enunciado muestra con 4 cifras significativas (hallazgo 1). Así ninguna de las dos depende de una auditoría.
2. `CONTENT-STANDARDS.md` §5: admitir la tolerancia absoluta que la spec ya usa para posiciones adimensionales, desplazamientos pequeños y puntos porcentuales (hallazgo 5), y decidir la unidad de T-6.4 e2 (hallazgo 8).
3. `REFERENCES.md`: confirmar en un solo lote DOCS los capítulos de `astrom-murray-11`, `siegwart-2`, `siegwart-3`, `siegwart-4`, `corke-4` y `craig-2`, y completar las filas sin editorial, año ni ISBN (hallazgo 3). Las recomendaciones 3 de C-M5, 3 de C-M4 y 7 de C-M0 siguen pendientes.
4. `GLOSSARY.md`:
   - calificar los dos Δθ (hallazgo 4).
   - decidir entre «rumbo» y «orientación» para θ y Δθ (hallazgo 12, recomendación 5 de C-M5).
   - fijar los subíndices de palabra (hallazgo 13).
   - añadir «RMS del error» o quitarlo de la spec (hallazgo 16).
   - decidir si Δt y Δt_c se unifican para el período del lazo (hallazgo 14).
5. `CONTENT-STANDARDS.md` §4 y §7: si Explora da cifras de un widget que usa el perfil, indicar que son del robot de referencia, y escribir con «≈» las que dependen del reloj del widget. Así se extienden la línea base de C-M5 y #453 a toda la ruta (hallazgos 9 y 10).
6. `CURRICULUM.md` § Módulo 6: nombrar las pistas como el simulador («Óvalo», «Curvas cerradas») en el texto para el estudiante (hallazgo 11), y revisar los ganchos de T-6.3 a T-6.5 (hallazgo 15).
7. Proceso: comprobar en la orquestación que el cuerpo del PR es el del ticket antes del squash (hallazgo 6).

## Veredicto

**Módulo aprobado con tickets**, pendiente de la validación del humano. El único hallazgo bloqueante (1) es técnico y tiene ticket (#461): en un ejercicio obligatorio de T-6.2, el enunciado no muestra los datos con los que se calcula la respuesta. El técnico mayor (2) aplica la regla de #451 y puede ir en el mismo cambio. El otro técnico mayor (3) necesita un lote DOCS del humano. Los otros cuatro técnicos son menores y sin ticket. El visible mayor (8) debería decidirse antes de publicar el módulo. Los 13 visibles menores pueden ir en un lote posterior o quedar como están, con las recomendaciones anotadas.
