# Auditoría de coherencia — C-M1

2026-09-26 · auditor de coherencia / Claude Opus 5.5 · T-1.1 Movimiento rectilíneo uniforme (#320), T-1.2 Movimiento uniformemente acelerado (#289), T-1.3 Caída libre (#323) y T-1.4 Tiro parabólico (#332), todos en `status: review` sobre `main` (21f61ff).

## Método

Se leyeron completos los cuatro temas: `content/es/ruta-1/m01-t0{1,2,3,4}/index.mdx`, `ejercicios.ts`, `alrobot.ts`, sus tests y los enunciados de `packages/i18n/locales/es/content.json`. Se revisaron contra `CURRICULUM.md` (Módulo 1 y la lista mínima de «Auditorías de coherencia»), `CONTENT-STANDARDS.md`, `GLOSSARY.md`, `WIDGETS.md`, `REFERENCES.md` y las decisiones de #287, #288, #304 y #315. También se leyeron los rangos de los deslizadores de `KinematicsWidget` y `ProjectileWidget` (`panels.tsx`) y sus etiquetas en `widgets.json`, para comprobar que cada experimento se puede hacer. Después se compararon con M0 y con las líneas base de C-M0. En cada tema y entre los cuatro se revisó:

1. Símbolos: todos existen en el glosario con la misma unidad, y se usan los mismos para lo mismo.
2. Fórmulas: las de la spec aparecen tal cual, con la lista de variables (símbolo, nombre, unidad).
3. Widgets: son los de la spec, con sus props exactas y sin widgets nuevos. Se comprobó que los valores por defecto reproducen el gancho, que hay una frase descriptiva y que cada valor que pide un experimento está dentro del rango del deslizador.
4. Al robot: usa `RobotFormula` sobre `useMyRobot()` y su ejemplo de referencia coincide con la spec.
5. Ejercicios: valores dorados en los tests con su tolerancia, unidad en el enunciado, rejilla exacta, dificultad creciente y rangos realistas. Se estimó por simulación (2·10⁵ sorteos por ejercicio) la distribución de las respuestas de T-1.1 e3, T-1.3 e1 y T-1.4 e3.
6. Tono, longitudes y forma de Explora. Se contaron las palabras de Concepto y Al robot y las frases de cada respuesta desplegable.
7. Nivel, progresión 1.1 → 1.4, prerrequisitos y comparación con M0 (estilo del gancho y densidad de fórmulas).
8. Referencias.

`pnpm content:check` da 21 temas y 0 incumplimientos, y los tests de los cuatro temas pasan (8 archivos, 73 tests).

Se revisó sin hallazgos:

- **Anatomía.** Las siete secciones están en orden en los cuatro temas.
- **Frontmatter.** Coincide con la spec en título, tiempo, prerrequisitos, objetivos, widgets y referencias. `requiredExercises` es e1–e3 en T-1.1 a T-1.3 y e1–e4 en T-1.4, donde solo e5 está marcado como opcional. El orden de `ruta.json` es el de la spec.
- **Fórmulas.** Las quince de la spec aparecen idénticas, con su lista de variables.
- **Props de los widgets.** `KinematicsWidget` (T-1.1:65-69, T-1.2:81-85) y `ProjectileWidget` (T-1.3:81, T-1.4:106-112) llevan las props exactas. Ninguno se ha modificado. Todos los valores que piden los experimentos caben en los deslizadores: v₀ ∈ [−1, 1] m/s y a ∈ [−2, 2] m/s² en `KinematicsWidget`; v₀ hasta 8 m/s, ángulo en grados enteros, h en pasos de 0.05 m y v del robot hasta 1 m/s en `ProjectileWidget`.
- **Valores por defecto y gancho.** Los cuatro widgets arrancan con los números del gancho, y los cuatro ganchos tienen como máximo dos frases. Así se resuelven en M1 los hallazgos 13 y 14 de C-M0.
- **Longitudes.** Concepto tiene 256, 299, 273 y 310 palabras (rango 150–350) y Al robot 144, 174, 172 y 198 (rango 100–300). Hay 3, 3, 3 y 4 experimentos con la forma cambia → observa → ¿por qué?, y ninguna respuesta pasa de 3 frases.
- **Tono.** Trato de tú, sin exclamaciones ni emojis, con punto decimal en todo el texto.
- **Valores dorados.** Los de los 17 ejercicios de la spec están en los tests, con su tolerancia: absoluta de 0.01 s en T-1.3 e1 y T-1.4 e3, y relativa del 2 % en el resto. Los ejemplos de Al robot coinciden con la spec (5.97 s; 1.28 m/s², 0.524 s y 0.175 m; 0.2258 s y 2.215 m/s; 0.151 m). Las cuentas del texto, de Explora y de las respuestas se rehicieron a mano y son correctas.
- **Rejilla y rangos de «tu robot».** Los cuatro temas sortean en rejillas que el enunciado muestra exactas, y T-1.1 e3 vuelve a sortear si v_A − v_B < 0.1 m/s (#287). Ninguna velocidad de «tu robot» pasa de 1 m/s. Se cumplen las líneas base de C-M0.
- **Coherencia con M0.** Todos los temas usan v_max = 0.670 m/s para el robot de referencia, la de T-0.2. Ya no hay una contradicción como la de C-M0 #3.
- **Referencias.** Todas las claves existen en `REFERENCES.md`.

## Hallazgos

Clase: **técnico** si corregirlo no cambia lo que ve el estudiante; **visible** si lo cambia. Los visibles no se corrigen ahora y se listan en «Para la validación del humano».

| # | Tema/archivo | Tipo | Clase | Descripción | Severidad | Ticket |
|---|---|---|---|---|---|---|
| 1 | T-1.3 `index.mdx:118-119`, `alrobot.ts:5-11`; `CURRICULUM.md:80` | nivel (Al robot) | visible | El cálculo de Al robot no usa ningún dato del perfil: la altura de la pinza es la del gancho y el texto dice «sea cual sea tu perfil». Pasa por `RobotFormula`, pero todos los perfiles ven los mismos números. `CONTENT-STANDARDS.md:15` pide «al menos un cálculo con los números del perfil del usuario», y el punto 4 de la lista mínima pide que Al robot use `useMyRobot()`. Lo fija la spec («dato del enunciado, no del perfil»). Es el caso de la excepción de T-0.3 (#252) en C-M0, que acabó eliminándose con #275. | mayor | — (humano) |
| 2 | `REFERENCES.md:3`, `:9`, `:18`, `:31` | referencia | técnico | M1 es el primer uso de `young-freedman-3` y `serway-4`. La confirmación de capítulo que exige `REFERENCES.md:3` no se ha hecho: la sección «Capítulos confirmados» solo cubre las cuatro claves de M0 (#276). La recomendación 7 de C-M0 no se aplicó. | mayor | — |
| 3 | T-1.3 `ejercicios.ts:24-25`; T-1.4 `ejercicios.ts:16`, `:86-98`; `CURRICULUM.md:81`, `:92` | ejercicios | técnico | Hay dos rangos de generación que decidió el código y no están en la spec. T-1.3 e2 solo tiene valor dorado en la spec, y el código reutiliza el rango de h de e1; #287 no detectó este hueco. En T-1.4 e2 la spec solo da `h ∈ [0, 1]`, y el código toma v₀ y α de e1 citando el hueco 8 de #287, que solo cubría e3 y e4. Los dos defaults son razonables, pero no están en `docs/`. | menor | — |
| 4 | T-1.3 `ejercicios.ts:13`, `:53`; T-1.4 `ejercicios.ts:21`, `:112` | ejercicios | técnico | La tolerancia absoluta de 0.01 s se aplica también a tiempos muy cortos. En T-1.3 e1, h ≥ 0.05 m da t ≥ 0.101 s, y en ≈ 7.7 % de las instancias la tolerancia supera el 5 % de la respuesta. En T-1.4 e3, t_v baja hasta 0.053 s (v₀ = 1 m/s, α = 15°, h = 0): en ≈ 22 % de las instancias la tolerancia es más ancha que el 2 %, y en ≈ 0.6 % pasa del 5 %. Califica con más holgura que el resto del módulo. Lo permite `CONTENT-STANDARDS.md:49`. | menor | — |
| 5 | T-1.1 `index.mdx:101`, `:112`; T-1.2 `index.mdx:127`; T-1.4 `index.mdx:155` | estilo | técnico | Hay cuatro enlaces internos escritos a mano (`/ruta/ruta-1/m00/t02`, `/ruta/ruta-1/m01/t02`), y otros doce en M2–M4. Hoy resuelven todos con `[tema].astro:10-14`. La recomendación 6 de C-M0, decidir URL a mano o componente, sigue abierta y los enlaces se han multiplicado. | menor | — |
| 6 | T-1.1 `ejercicios.ts:27-31`, `:95-118`; `CURRICULUM.md:62`; #287 | unidades (rangos) | visible | En e3 el encuentro queda a más de 10 m en ≈ 21 % de las instancias y a más de 20 m en ≈ 4 %. El máximo es 45 m, en hasta 50 s (v_A − v_B = 0.1 m/s con D = 5 m). La pista del gancho mide 4 m. Choca con los «rangos realistas» de `CONTENT-STANDARDS.md:48`. Los rangos son los del default de #287. | menor | — (humano) |
| 7 | T-1.3 `index.mdx:94`, `:98`; T-1.4 `index.mdx:102`, `:138`; `widgets.json` (`ProjectileWidget.vx`, `.vy`, `.vectorvx`, `.vectorvy`) | notación | visible | El glosario escribe vₓ y v_y (`GLOSSARY.md:24`). T-1.3 escribe «vy», copiando la etiqueta del widget. T-1.4 escribe vₓ y v_y, pero el widget que tiene al lado muestra «vx» y «vy». Es el caso de C-M0 #9 (texto frente a etiquetas del widget). | menor | — (humano) |
| 8 | T-1.1 `index.mdx:72`, `:90` frente a `:23-40` | notación | visible | Concepto y las respuestas llaman v a la velocidad del MRU. Los experimentos dicen «v₀», que es el nombre del parámetro del widget. En un MRU las dos son la misma, pero el texto no lo dice. | menor | — (humano) |
| 9 | T-1.2 `alrobot.ts:111`, `index.mdx:132` frente a `index.mdx:36-38`; T-1.4 `alrobot.ts:57` | notación | visible | La distancia de la rampa se escribe x = v_max²/(2a), como en la spec. La distancia de frenado del mismo tema es Δx = v₀²/(2·\|a\|), y el adelanto de T-1.4 también es Δx. Son dos nombres para la misma magnitud dentro del módulo. | menor | — (humano) |
| 10 | T-1.2 `index.mdx:117-124` frente a T-1.4 `index.mdx:55` y siguientes | notación | visible | En el módulo α es la aceleración angular (T-1.2) y el ángulo de lanzamiento (T-1.4). El glosario acota el segundo sentido como «α (en tiro)» (`GLOSSARY.md:29`, `:96`), así que es una decisión registrada y no un error. | menor | — (humano) |
| 11 | T-1.2 `index.mdx:117-124` | nivel | visible | Al robot usa la aceleración angular α y a = α·r, que el temario enseña en T-4.3. Aquí se introducen en una sola frase, sin definir α. Lo fija la spec (`CURRICULUM.md:70`, #288). | menor | — (humano) |
| 12 | T-1.2 `index.mdx:97`; T-1.4 `index.mdx:26` | estilo | visible | «v₀ a 0.6 m/s y a a −1.2 m/s²» y «y y sigue un MRUA»: un símbolo junto a la palabra igual se lee como una errata. Es el mismo caso que C-M0 #17. Propuesta: «pon v₀ = 0.6 m/s y a = −1.2 m/s²»; «y la altura sigue un MRUA». | menor | — (humano) |
| 13 | T-1.3 `index.mdx:41-42`, `:89`, `:98` frente a `:123`, `:127`; T-1.4 `index.mdx:148` frente a `:166` | estilo | visible | Un mismo número aparece con distinta precisión dentro del tema. En T-1.3 son 0.226 s y 2.21 m/s en Concepto y Explora, y 0.2258 s y 2.215 m/s en Al robot. En T-1.4 un tiempo de caída sale con 3 cifras en Explora (0.247 s) y con 4 en Al robot (0.2258 s). | menor | — (humano) |
| 14 | T-1.4 `index.mdx:55`, `:63`, `:71`, `:79`, `:87`, `:96`; `content.json:39-43` | unidades | visible | α figura en rad en las listas de variables, pero el gancho, los ejemplos, el widget y los enunciados usan grados, y el tema no da 180° = π rad. Es el caso de C-M0 #12 (θ en T-0.2). | menor | — (humano) |
| 15 | T-1.2 `content.json:28`; `sim-core/src/exercises/format.ts:20-35`, `ExerciseWidget/state.ts:17-25` | estilo | visible | El enunciado de e2 muestra la aceleración negativa con guion (`a = -1.2 m/s²`), porque `format` usa el signo de JavaScript. El texto del tema y los enunciados literales de M0 (T-0.2 e2) usan el signo menos «−». Es el primer valor negativo interpolado de la ruta. | menor | — (humano) |
| 16 | T-1.3 `index.mdx:102-110`; `CURRICULUM.md:79` | estilo | visible | El experimento 3 pide «cambia la masa», pero no hay nada que cambiar: observa que el widget no tiene control de masa. No tiene la forma cambia → observa → ¿por qué? de `CONTENT-STANDARDS.md:14`. El texto es literal de la spec. | menor | — (humano) |
| 17 | T-1.1 `ejercicios.ts:72-82`; T-1.3 `ejercicios.ts:45-65` | nivel | visible | La dificultad no siempre crece como pide `CONTENT-STANDARDS.md:52`. T-1.1 e2 es aplicación directa, igual que e1, sin conversión ni dos pasos. T-1.3 e1 y e2 son dos aplicaciones directas sobre el mismo dato. Todo sale de la spec. Es el caso de C-M0 #16. | menor | — (humano) |
| 18 | T-1.4 `index.mdx:19-20` | estilo | visible | La segunda pregunta del gancho («si el robot avanza mientras suelta una pieza, ¿dónde cae?») no tiene números (`CONTENT-STANDARDS.md:11`). Los números (0.6 m/s) solo aparecen en el widget y en el experimento 4. El texto es el de la spec. | menor | — (humano) |
| 19 | los cuatro `index.mdx` y `content.json` | unidades | visible | Antes de la unidad va un espacio normal (U+0020) y no el espacio fino de `CONTENT-STANDARDS.md:42`, igual que en M0 (C-M0 #15). La recomendación 4 de C-M0 sigue abierta. | menor | — (humano) |

Resumen: 0 bloqueantes, 2 mayores y 17 menores. Hay 4 técnicos (2, 3, 4 y 5), ninguno bloqueante, así que no se abre ningún issue de corrección. Los otros 15 son visibles.

### Decisiones previas aplicadas

- **#287 · huecos de M1** (rangos de T-1.1 e3 y T-1.3 e4, símbolos del glosario, `overlay` en caída y selector de modo, rangos de T-1.4 e3 y e4). Se aplican tal cual. Los rangos de T-1.1 e3 son el origen del hallazgo 6.
- **#288 · α = 40 rad/s² del robot de referencia** cuando el perfil no define `maxAccel_radps2`. Se aplica (`T-1.2 alrobot.ts:23`, `:46`) y coincide con `ROBOT-SPEC.md:140`.
- **#304 · overlay en `drop`** y selector de modo en `ProjectileWidget`. T-1.3 y T-1.4 los usan como dice `WIDGETS.md`.
- **#315 · rango de v en T-1.1 e2.** Se aplica (`ejercicios.ts:25-26`).

## Para la validación del humano

Son los hallazgos que cambiarían lo que ve el estudiante. No se corrigen ahora. Cada uno lleva la decisión que necesita.

| # | Decisión que se pide | Propuesta del auditor |
|---|---|---|
| 1 | ¿Se acepta un Al robot que no depende del perfil (T-1.3)? | A: aceptarlo y anotar en `CONTENT-STANDARDS.md` §2.5 que Al robot puede usar un dato del enunciado cuando ningún campo de `RobotSpec` aplica. B: añadir un segundo cálculo con el perfil, por ejemplo la distancia que avanza el robot a v_max durante t_caída; pero ese es el cálculo de T-1.4 y lo adelantaría. Recomendado: A. |
| 6 | ¿Se acota el encuentro de T-1.1 e3? | Volver a sortear si x > 10 m, o subir la diferencia mínima v_A − v_B a 0.2 m/s. Cambia `CURRICULUM.md:62`. |
| 7, 8, 9 | ¿Un solo nombre por magnitud? | Texto con vₓ y v_y, y etiquetas del widget iguales al glosario (`widgets.json`). En T-1.1, una frase: «en un MRU, v = v₀». En T-1.2, Δx también en la rampa (cambia `CURRICULUM.md:70`). |
| 10, 11 | ¿Se mantiene α como aceleración angular en T-1.2? | Mantenerla, porque la fija la spec, y añadir en Al robot una frase que la defina («cuánto cambia ω por segundo, en rad/s²»). |
| 12, 16, 18 | Redacción de experimentos y del gancho | Corregir las dos frases del hallazgo 12. Reformular el experimento 3 de T-1.3 como «busca un control de masa → no lo hay → ¿por qué?», o sustituirlo. Dar números a la segunda pregunta del gancho de T-1.4 («a 0.6 m/s desde 0.25 m»). Los hallazgos 16 y 18 cambian la spec. |
| 13 | Precisión de los números en el texto | Una sola regla por tema: las cifras de los valores dorados de la spec (0.2258 s, 2.215 m/s) también en Concepto y Explora. |
| 14 | Grados o radianes en T-1.4 | Una línea en Fórmulas: «α se da en grados; 180° = π rad; la calculadora, en grados». Aplica también a C-M0 #12. |
| 15 | Signo menos en los enunciados | Que `format` de `sim-core` use «−» (U+2212). Cambia todas las rutas y es un ticket de código, no de contenido. |
| 17 | Progresión de dificultad | Dejarla como está en M1 y revisar los e1–e3 de las specs de M2 en adelante con la regla de `CONTENT-STANDARDS.md:52`. |
| 19 | Espacio fino | La misma decisión que C-M0, recomendación 4. |

## Deriva detectada entre módulos

Comparación con M0 (C-M0) y con sus líneas base:

- **Gancho respondido en Concepto.** Se cumple en los cuatro temas. En T-1.4, la segunda pregunta se responde de forma cualitativa en Concepto y con números solo en Explora (hallazgo 18). Mejora frente a M0 (C-M0 #7).
- **Al robot con `RobotFormula`.** Se cumple en los cuatro. T-1.1, T-1.2 y T-1.4 usan la misma frase de reserva para perfiles sin ruedas, y los tres enlazan el v_max de T-0.2. T-1.3 no depende del perfil (hallazgo 1), igual que T-0.3 antes de #275.
- **Ejercicios en rejilla exacta.** Se cumple en los cuatro, aunque la regla no llegó a `CONTENT-STANDARDS.md` §5 (recomendación 1 de C-M0).
- **Velocidades de «tu robot» ≤ 1.5 m/s.** Se cumple: ninguna pasa de 1 m/s. Tampoco llegó al estándar (recomendación 2 de C-M0).
- **Densidad de fórmulas.** M1 tiene 2, 3, 4 y 6 frente a 4, 5 y 3 en M0. T-1.1 queda por debajo y T-1.4, que es L, por encima. Todas salen de la spec.
- **Formato de los números en `alrobot.ts`.** La deriva de M0 sigue. T-1.1, T-1.2 y T-1.4 usan 3 cifras con ceros finales, como T-0.2. T-1.3 usa 4, y α y el tiempo de caída de T-1.4 también. No hay una regla común (hallazgo 13).
- **Forma del código.** Los cuatro `ejercicios.ts` siguen el estilo de T-0.3 (`as const`, cabecera con `//`) y no el de T-0.1 y T-0.2. `REFERENCE_WHEELS` está copiado en tres `alrobot.ts` (T-1.1:23, T-1.2:24, T-1.4:28), y `Range` y `drawOnGrid` en los cuatro `ejercicios.ts`, porque `content` solo toma tipos de `robot-spec` (#246). Si cambia el robot de referencia de `ROBOT-SPEC.md` §3, hay que tocar cada copia. Esto es terreno del auditor de código y aquí solo se anota.
- **Símbolos con alcance.** Crecen: α tiene ya dos sentidos en el mismo módulo (hallazgo 10), después de `a`, `b`, `c` y `n` en M0.

Líneas base para C-M2: las de C-M0, más widgets que arrancan en el gancho, ganchos de dos frases como máximo y v_max = 0.670 m/s como única velocidad del robot de referencia.

## Recomendaciones para el orquestador

Son cambios en `docs/` que evitarían repetir los hallazgos en los módulos siguientes. Todos requieren al humano.

1. `REFERENCES.md`: confirmar en un solo lote todas las claves que ya usan los temas y no están confirmadas: `young-freedman-3` a `-7`, `-9` y `-10`; `serway-4`, `-5` y `-10`; `siegwart-3` y `-4`; `corke-4`; `craig-2`. Son catorce, y solo están confirmadas las cuatro de M0. Resuelve el hallazgo 2 y evita que se repita en cada auditoría.
2. `CURRICULUM.md`: registrar los rangos del hallazgo 3 (T-1.3 e2: h ∈ [0.05, 2]; T-1.4 e2: v₀ y α de e1). Antes de abrir más tickets de tema, comprobar que cada ejercicio que se genera tiene su rango.
3. `CONTENT-STANDARDS.md` §5: limitar la tolerancia absoluta de 0.01 s a respuestas de al menos 0.2 s, o subir el mínimo de los rangos para que el tiempo no baje de ahí (hallazgo 4).
4. `CONTENT-STANDARDS.md` §4: fijar las cifras de los números del texto y de `alrobot.ts` (propuesta: las del valor dorado de la spec) (hallazgo 13 y deriva de C-M0).
5. `CONTENT-STANDARDS.md` §2.5: decidir si Al robot puede prescindir del perfil cuando ningún campo de `RobotSpec` aplica (hallazgo 1).
6. `GLOSSARY.md` y `WIDGETS.md`: que las etiquetas de los widgets usen los símbolos del glosario (vₓ, v_y, v₀), o anotar en el glosario la forma ASCII que se admite en las etiquetas (hallazgos 7 y 8, C-M0 #9).
7. Siguen abiertas las recomendaciones 1, 2, 4 y 6 de C-M0: rejilla y techo de velocidad en §5, espacio fino y enlaces internos. M1 cumple las dos primeras sin que estén escritas, y los hallazgos 5 y 19 repiten las otras dos.

## Veredicto

**Módulo aprobado.** No hay hallazgos bloqueantes, así que no se abre ningún ticket de corrección. Los dos mayores necesitan una decisión del humano antes de publicar el módulo. El 1 es visible y está en «Para la validación del humano». El 2 es técnico, pero toca `docs/REFERENCES.md` (recomendación 1). Los diecisiete menores pueden ir en un lote posterior o quedar como están con las recomendaciones anotadas.
