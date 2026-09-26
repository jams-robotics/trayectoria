# Auditoría de coherencia — C-M2

2026-09-26 · auditor de coherencia / Claude Opus 5.5 · T-2.1 Leyes de Newton y diagrama de cuerpo libre, T-2.2 Fricción y T-2.3 Torque, todos en `status: review` sobre `main` (21f61ff; los temas no cambian hasta d9a35f9).

## Método

Se leyeron completos los tres temas: `content/es/ruta-1/m02-t0{1,2,3}/index.mdx`, `ejercicios.ts`, `alrobot.ts` y sus tests, y los enunciados de `packages/i18n/locales/es/content.json:45-62`. Se revisaron contra `CURRICULUM.md` § Módulo 2 y la lista mínima de «Auditorías de coherencia», `CONTENT-STANDARDS.md`, `GLOSSARY.md`, `WIDGETS.md` y `REFERENCES.md`. Se comprobaron los rangos de los deslizadores de `FreeBodyWidget` (`params.ts:17-21`, `FreeBodyWidget.tsx:45`) y `GearWidget` (`panels.tsx:15-23`) para confirmar que cada experimento se puede hacer. M1 aún no tiene informe (C-M1, #426, en curso), así que la comparación se hizo contra el contenido de M1 en `main` y contra las líneas base de C-M0. En cada tema y entre los tres se revisó:

1. Símbolos: todos existen en el glosario con la misma unidad, y se usan los mismos para lo mismo.
2. Fórmulas: las de la spec aparecen tal cual, con la lista de variables (símbolo, nombre, unidad).
3. Widgets: son los de la spec, con sus props exactas, sin widgets nuevos, con frase descriptiva y con valores por defecto iguales a los del gancho.
4. Al robot: usa `RobotFormula` sobre `useMyRobot()` y su ejemplo de referencia coincide con la spec.
5. Ejercicios: valores dorados en los tests con su tolerancia, unidad en el enunciado, rejilla exacta, dificultad creciente y rangos realistas.
6. Tono, longitudes y forma de Explora.
7. Nivel, estilo del gancho y densidad de fórmulas frente a M0 y M1.
8. Referencias.

Cada hallazgo se clasifica como **técnico** (no cambia lo que ve el estudiante) o **visible** (cambia el texto, los números o la interfaz que ve el estudiante). Los visibles se listan en «Para la validación del humano» y no se corrigen ahora.

Se revisó sin hallazgos:

- **Anatomía.** Las siete secciones están en orden en los tres temas.
- **Frontmatter.** Coincide con la spec en título, tiempo, prerrequisitos, objetivos, widgets, ejercicios obligatorios y referencias.
- **Fórmulas.** Las trece de la spec aparecen idénticas (3, 5 y 5), cada una con su lista de variables. Todos los símbolos de las fórmulas están en el glosario con la unidad correcta.
- **Props de los widgets.** `FreeBodyWidget` (T-2.1:78-99, T-2.2:89-98) y `GearWidget` (T-2.3:92-103) llevan las props exactas de la spec. Ninguno se ha modificado. La `Formula` estática del tercer experimento de T-2.3 (`:128`) es la que fija la spec. Cada Explora abre con una frase que describe lo que muestra el widget.
- **Experimentos realizables.** La tracción llega a 6 N (deslizador de 0 a 10 N), la pendiente va de grado en grado hasta 45°, μₛ baja a 0.3, la masa sube a 1.8 kg y z₄ sube a 60. El aviso «desliza» aparece a 31° y no a 30° con μₛ = 0.6, como dice T-2.2:116.
- **Longitudes.** Concepto tiene 314, 301 y 293 palabras (rango 150–350) y Al robot 185, 201 y 202 (rango 100–300). Cada tema tiene tres experimentos con la forma cambia → observa → ¿por qué?, y ninguna respuesta pasa de 3 frases. El gancho tiene 2, 1 y 2 frases.
- **Tono.** Trato de tú, sin exclamaciones ni emojis, con punto decimal en todo el texto.
- **Valores dorados.** Los trece de la spec están en los tests con su tolerancia (0.5° absoluta en T-2.2 e2, 2 % relativa en el resto). Los ejemplos de Al robot coinciden con la spec (1.152 N y 8.83 N; 1.28 y 3.53 m/s²; 0.216 N·m, 6.75 N, 13.5 N y 3.18 N). Las cuentas del texto se rehicieron a mano y son correctas. `vitest` sobre `content/es/ruta-1/m02` pasa 58 de 58 y `content:check` da 0 incumplimientos.
- **Rejillas.** Los tres temas sortean en rejillas que el enunciado muestra exactas (centésimas, milésimas y grados enteros). Ninguna respuesta con tolerancia relativa puede acercarse a cero.
- **Líneas base de C-M0.** El gancho se responde en Concepto en los tres temas (0.72 N, 5.886 m/s² y 6.75 N). Al robot usa `RobotFormula` con el perfil en los tres. La única velocidad sorteada, en T-2.2 e4, no pasa de 1 m/s.

## Hallazgos

| # | Tema/archivo | Tipo | Descripción | Severidad | Ticket |
|---|---|---|---|---|---|
| 1 | `REFERENCES.md:3`, `:10-11`, `:15`, `:19-20`, `:29` | referencia · técnico | M2 es el primer uso de `young-freedman-4`, `young-freedman-5`, `young-freedman-10`, `serway-5` y `serway-10`. La confirmación de capítulo que exige `REFERENCES.md:3` no se ha hecho: «Capítulos confirmados» solo lista las claves de M0 (#276). Los números y títulos coinciden con el índice de la edición original de cada libro, así que no se espera que cambie lo que muestra Profundiza. Se clasifica como técnico, pero la corrección toca `docs/` y necesita al humano. | mayor | — (ver recomendación 1) |
| 2 | `WIDGETS.md:297` frente a `CURRICULUM.md` § T-2.1–T-2.3 | widget · técnico | La tabla «Relación tema → widgets» asigna a M2 `EnergyWidget (rampa)` y `GearWidget` «modo 1 etapa». La spec de M2 no usa `EnergyWidget` y monta `GearWidget stages={2}`. Los temas siguen la spec, que es lo correcto. La tabla es la que está desfasada. | menor | — (ver recomendación 2) |
| 3 | T-2.3 `ejercicios.ts:16`, `:106` frente a T-2.1 `ejercicios.ts:1`, `:86` | estilo (código) · técnico | T-2.3 define su propio `DEG_TO_RAD = Math.PI / 180` y T-2.1 usa `degToRad` de sim-core. El resultado es el mismo. Este punto es terreno del auditor de código y aquí solo se anota. | menor | — |
| 4 | T-2.3 `index.mdx:19-20`, `:110-112`, `:120-122`, `:48`, `:167`, `:171` | estilo (fuente) · técnico | El gancho y dos respuestas de Experimento van sangrados dos espacios. Hay líneas en blanco antes de `</Concepto>` y `</AlRobot>`, y `Verifica` va en una sola línea. T-2.1 y T-2.2 no hacen nada de esto. El MDX se renderiza igual. | menor | — |
| 5 | T-2.1 `index.mdx:74-99` frente a `:19`; T-2.2 `index.mdx:85-98` frente a `:19-20` | widget · visible | Los valores por defecto del widget no son los del gancho (`CONTENT-STANDARDS.md:69`). En T-2.1 el gancho pide 0.72 N para 0.8 m/s², pero el widget arranca con 1.5 − 0.4 = 1.1 N y 1.22 m/s², aunque la frase descriptiva lo presenta como «el del gancho». En T-2.2 el gancho es en plano (5.886 m/s²), pero el widget arranca en una rampa de 15° con 3 N, así que el panel muestra a_max = μₛ·g·cosφ ≈ 5.69 m/s². Los dos los fija la spec. Es la misma deriva que el hallazgo 13 de C-M0. | menor | — |
| 6 | T-2.3 `index.mdx:24-26` frente a `:52-56` | notación · visible | En Concepto, r de τ = F·r es «el brazo, la distancia perpendicular entre el eje y la línea de la fuerza». En la lista de variables es «radio de rueda», que es el r del glosario (`GLOSSARY.md:102`). El brazo genérico del glosario es ℓ (`:48`), que el mismo tema usa en `:43`. La fórmula es literal de la spec. | menor | — |
| 7 | T-2.2 `index.mdx:46-48`, `:79` | notación · visible | En la misma frase, v es la velocidad final (cero) en v² = v₀² + 2·a·Δx y la velocidad al empezar a frenar en d_frenado = v²/(2·μₖ·g). La lista de variables (`:79`) aclara el segundo sentido, pero la derivación salta de v₀ a v sin decirlo. | menor | — |
| 8 | T-2.2 `index.mdx:47` frente a T-2.1 `index.mdx:32` y T-0.2 `index.mdx:24` | notación · visible | «aceleración de módulo μₖ·g» es el único «módulo» de la ruta. M0, T-2.1 y el glosario (`GLOSSARY.md:67`) llaman «magnitud» a la norma de un vector. | menor | — |
| 9 | T-2.3 `index.mdx:38-44`, `:128` frente a T-2.1 `:37-44` y T-2.2 `:35-43` | estilo · visible | T-2.1 y T-2.2 escriben el peso en prosa como m·g (m·g·sinφ, m·g·cosφ). T-2.3 escribe mg (mg·sinφ, mg·ℓ, «el peso mg»). Las fórmulas en KaTeX de los tres usan mg, como la spec. La diferencia está solo en la prosa. | menor | — |
| 10 | T-2.1 `index.mdx:133`, `:151`; T-2.2 `index.mdx:133`; T-2.3 `index.mdx:33`, `:157` | estilo · visible | Las referencias a otros temas se escriben de tres formas. T-2.1 y T-2.2 enlazan T-1.2 con la URL a mano, T-2.3 nombra «el tema Fricción», que es anterior, sin enlace, y T-2.1 anuncia «el tema siguiente, la fricción» en minúscula y sin enlace. M1 enlaza siempre los temas anteriores. La recomendación 6 de C-M0 sigue pendiente. | menor | — |
| 11 | T-2.1 `index.mdx:76`; `widgets.json:75` | notación · visible | La frase descriptiva llama «R» a la resultante porque así la rotula el widget. En el glosario R es el alcance (en tiro), el radio de giro o una matriz de rotación (`GLOSSARY.md:31`, `:133`, `:183`), y la resultante no tiene símbolo. | menor | — |
| 12 | T-2.2 `index.mdx:138-139` frente a T-2.1 `:138-139` y T-2.3 `:147-148` | estilo · visible | T-2.1 y T-2.3 explican el respaldo en dos frases: sin el dato se usa el valor de referencia, y si el perfil no es móvil se usa el robot de referencia completo. T-2.2 dice que, si el perfil no es móvil, se usa «la [α] del robot de referencia». También toma su r (`alrobot.ts:36-37`). La frase viene de T-1.2 (`:123`). | menor | — |
| 13 | `content.json:47-48` frente a `:52`, `:54-55`, `:60-61` | estilo · visible | Solo T-2.1 e2 y e3 añaden «Usa g = 9.81 m/s²». T-2.2 e1, e3 y e4 y T-2.3 e3 y e4 también usan g y no lo dicen. En M1 tampoco lo dice T-1.3. | menor | — |
| 14 | T-2.1 `ejercicios.ts:64-73`, `:98-108`; T-2.2 `ejercicios.ts:50-90` | nivel · visible | La dificultad no siempre crece como pide `CONTENT-STANDARDS.md:52`. T-2.1 e2 (N = m·g) es más simple que e1. T-2.2 e1 y e3 son aplicación directa, y la única inversión es e2 (arctan). T-2.1 e4 no genera valores, así que «Nuevos valores» repite la instancia, y su respuesta, 1.22 m/s², es la que el panel del widget muestra al abrir el tema y la que da el tercer experimento. Todo sale de la spec. Es la misma deriva que el hallazgo 16 de C-M0. | menor | — |
| 15 | los tres `index.mdx` y `content.json` | unidades · visible | Los tres temas usan espacio normal (U+0020) antes de la unidad, y `CONTENT-STANDARDS.md:42` pide espacio fino. Toda la ruta lo hace igual. La recomendación 4 de C-M0 sigue pendiente. | menor | — |
| 16 | T-2.1 `alrobot.ts:50-56` | Al robot · visible | La fórmula sustituida muestra a con 3 cifras y F con 4, pero F se calcula con la a sin redondear. Con el robot de referencia cuadra (0.9·1.28 = 1.152). Con un perfil cuya a tenga más cifras, el producto que se lee no da el resultado que se muestra en la cuarta cifra (p. ej., α = 37 rad/s² y r = 0.035 m: «0.9 · 1.30 = 1.166»). T-2.2 y T-2.3 no tienen este problema. | menor | — |

Resumen: 0 bloqueantes, 1 mayor y 15 menores. De los 16 hallazgos, 4 son técnicos y 12 son visibles. Ningún técnico es bloqueante, así que no se abre ningún issue de corrección desde esta auditoría.

### Para la validación del humano

Estos hallazgos cambian lo que ve el estudiante. No se corrigen ahora: el humano decide en la validación final del módulo.

| # | Tema | Qué vería distinto el estudiante | Origen |
|---|---|---|---|
| 5 | T-2.1, T-2.2 | Widget que arranca con los números del gancho. Hay que cambiar la spec o anotar la excepción. | spec |
| 6 | T-2.3 | Lista de variables de τ = F·r que diga «brazo», o Concepto que diga que en la rueda el brazo es r. | tema / spec |
| 7 | T-2.2 | Derivación del frenado sin cambiar el sentido de v a mitad de frase. | tema |
| 8 | T-2.2 | «magnitud» en lugar de «módulo», o bien el glosario adopta «módulo». | tema / glosario |
| 9 | T-2.3 | m·g en la prosa, como en T-2.1 y T-2.2, o la regla contraria para los tres. | tema |
| 10 | T-2.1, T-2.2, T-2.3 | Una sola forma de referirse a otros temas. | estándar pendiente |
| 11 | T-2.1 | «la resultante» sin símbolo, o R con un calificador en el glosario. | tema / glosario |
| 12 | T-2.2 | Respaldo del perfil explicado en dos frases, como en T-2.1 y T-2.3. | tema |
| 13 | T-2.2, T-2.3 | «Usa g = 9.81 m/s²» en todos los enunciados que usan g, o en ninguno. | enunciados |
| 14 | T-2.1, T-2.2 | Ejercicios con dificultad creciente y un e4 de T-2.1 que no repita el valor del widget. | spec |
| 15 | todos | Espacio fino antes de la unidad, o la regla ajustada al espacio normal. | estándar pendiente |
| 16 | T-2.1 | Fórmula sustituida cuyo producto cuadra con el resultado en cualquier perfil. | tema |

### Excepciones decididas por el orquestador

- **#299 · Al robot de T-2.2 con una `Formula` estática para a_max.** Se aplica (`index.mdx:144-147`). μₛ = 0.6 y β = 0.6 son constantes del texto y no del perfil. La parte que depende del perfil, a = α·r, sí usa `RobotFormula`. Es coherente con T-2.3, que usa las mismas constantes en `max-friction` (`alrobot.ts:20-21`).
- **#299 · respaldos del perfil.** T-2.1 y T-2.2 toman α = 40 rad/s² si falta `maxAccel_radps2`, T-2.3 toma 0.012 N·m y η = 0.6 si falta `motor`, y los tres toman el robot de referencia completo si el perfil no es móvil. Se aplican como dice la spec (ver hallazgo 12 sobre la redacción).
- **#299 · tercer experimento de T-2.3 con una `Formula` estática.** Se aplica (`index.mdx:125-138`). Cumple el límite de un widget grande por Explora (`CONTENT-STANDARDS.md:68`).

## Deriva detectada entre módulos

Frente a las líneas base de C-M0, M2 cumple las cuatro: el gancho se responde en Concepto, Al robot usa `RobotFormula`, los ejercicios usan rejilla exacta y ninguna velocidad de «tu robot» pasa de 1.5 m/s. Frente a M1:

- **Nivel y densidad.** Son similares. M1 tiene 2, 3, 4 y 6 fórmulas y M2 tiene 3, 5 y 5. Concepto está en 256–310 palabras en M1 y en 293–314 en M2. Al robot, en 144–198 en M1 y en 185–202 en M2.
- **Gancho.** M1 abre casi siempre con «Tu robot…». En M2 lo hace T-2.1, T-2.2 empieza por las ruedas y T-2.3 por «El motor entrega…». Los tres tienen números y pregunta, y son literales de la spec.
- **Al robot.** M2 introduce una comparación entre dos límites: la tracción del motor frente a la fricción, en T-2.2 y T-2.3. Es la primera vez que un tema combina cálculos del perfil con constantes del texto. Queda coherente entre los dos temas.
- **Formato de los números en `alrobot.ts`.** T-2.2 y T-2.3 usan 3 cifras con ceros finales, como T-0.2. T-2.1 usa 3 cifras para a y N, y 4 para F. Sigue sin haber una regla común (C-M0, deriva 4).
- **Código.** Los tres `ejercicios.ts` siguen el patrón de T-1.2: rangos exportados, `drawOnGrid`, lista `as const` y cabecera con `//`. La excepción es `DEG_TO_RAD` en T-2.3 (hallazgo 3).
- **Hallazgos repetidos de C-M0.** Siguen apareciendo los valores por defecto del widget distintos del gancho (13 → 5), la dificultad no creciente fijada por la spec (16 → 14), el espacio fino (15 → 15), los enlaces entre temas (recomendación 6 → hallazgo 10), la confirmación de referencias al primer uso (4 → 1) y «magnitud» con varios nombres (11 → 8). Ninguna de las recomendaciones 3 a 7 de C-M0 se ha llevado todavía a `docs/`.

## Recomendaciones para el orquestador

Son cambios en `docs/` que evitarían repetir los hallazgos en los módulos siguientes. Todos requieren al humano.

1. `REFERENCES.md`: confirmar `young-freedman-4`, `-5` y `-10`, y `serway-5` y `-10` en «Capítulos confirmados». Conviene hacerlo en el mismo lote que las claves de M1 (`young-freedman-3`, `serway-4`) y las de M3 a M6 antes de publicar, en vez de módulo a módulo. Es la recomendación 7 de C-M0 (hallazgo 1).
2. `WIDGETS.md` § «Relación tema → widgets»: alinear la fila de M2 con la spec (FreeBodyWidget y GearWidget de dos etapas, sin EnergyWidget) y revisar las demás filas contra `CURRICULUM.md` (hallazgo 2).
3. `CONTENT-STANDARDS.md` §7: decidir entre exigir que la spec reproduzca el gancho en el widget o anotar que la spec puede fijar otros valores cuando lo explica la frase descriptiva. Es la recomendación 3 de C-M0 (hallazgo 5).
4. `GLOSSARY.md`: dar símbolo o calificador a la resultante (hallazgo 11) y decidir «magnitud» o «módulo» para la norma de un vector (hallazgo 8, recomendación 5 de C-M0). `CURRICULUM.md` § T-2.3: escribir `\tau = F\,\ell` o anotar que en la rueda el brazo es r (hallazgo 6).
5. `CONTENT-STANDARDS.md` §4: fijar la forma del producto en la prosa (m·g o mg) y si todo enunciado que usa g la da explícitamente (hallazgos 9 y 13). Las recomendaciones 4 (espacio fino) y 6 (enlaces entre temas) de C-M0 siguen abiertas (hallazgos 15 y 10).
6. `CONTENT-STANDARDS.md` §2.5: añadir que en una fórmula sustituida el resultado se calcula con los valores tal como se muestran, o que se muestran con las cifras suficientes para que el producto cuadre (hallazgo 16).

## Veredicto

**Módulo aprobado con tickets.** No hay hallazgos bloqueantes. Los cuatro técnicos quedan para que el orquestador decida si abre tickets de corrección. El 1 y el 2 tocan `docs/` y necesitan al humano, y el 3 y el 4 son de forma y pueden ir en un lote posterior. Los doce visibles quedan para la validación del humano antes de publicar el módulo.
