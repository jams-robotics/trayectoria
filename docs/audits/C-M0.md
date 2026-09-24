# Auditoría de coherencia — C-M0

2026-09-23 · auditor de coherencia / Claude Opus 5.5 · T-0.1 Unidades y magnitudes (#261), T-0.2 Vectores (#269), T-0.3 La derivada como razón de cambio (#257), todos en `status: review` sobre `main` (dcc6653).

## Método

Se leyeron completos los tres temas: `content/es/ruta-1/m00-t0{1,2,3}/index.mdx`, `ejercicios.ts` y sus tests, `alrobot.ts` (T-0.1 y T-0.2) y los enunciados de `packages/i18n/locales/es/content.json`. Después se compararon entre sí línea a línea. Se revisaron contra `CONTENT-STANDARDS.md`, `GLOSSARY.md`, `WIDGETS.md`, `CURRICULUM.md` (M0 y la lista mínima de «Auditorías de coherencia») y `REFERENCES.md`. En cada tema y entre los tres se revisó:

1. Símbolos: todos existen en el glosario con la misma unidad, y se usan los mismos para lo mismo.
2. Fórmulas: las de la spec aparecen tal cual, con la lista de variables (símbolo, nombre, unidad).
3. Widgets: son los de la spec, con sus props exactas y sin widgets nuevos. Se comprobó también que los valores por defecto coinciden con el gancho y que hay una frase descriptiva.
4. Al robot: usa `RobotFormula` sobre `useMyRobot()` y su ejemplo de referencia coincide con la spec.
5. Ejercicios: valores dorados en los tests con su tolerancia, unidad en el enunciado, dificultad creciente y rangos realistas. Se estimó por simulación (10⁶ sorteos) qué ocurre con los valores redondeados a 4 cifras que muestra el enunciado.
6. Tono, longitudes y forma de Explora. Se contaron las palabras de Concepto y Al robot y las frases de cada respuesta desplegable.
7. Nivel, progresión 0.1 → 0.2 → 0.3 y prerrequisitos.
8. Referencias.

Se revisó sin hallazgos:

- **Anatomía.** Las siete secciones están en orden en los tres temas.
- **Frontmatter.** Coincide con la spec en título, tiempo, prerrequisitos, objetivos, widgets, ejercicios obligatorios y referencias.
- **Fórmulas.** Las doce de la spec aparecen idénticas.
- **Props de los widgets.** `RotationWidget` (T-0.1:76), `MyRobotWidget` (T-0.1:111), `VectorWidget` (T-0.2:85-90) y `KinematicsWidget` (T-0.3:75-80) llevan las props exactas. Ninguno se ha modificado.
- **Longitudes.** Concepto tiene 284, 311 y 292 palabras (rango 150–350) y Al robot 191, 193 y 151 (rango 100–300). Cada tema tiene tres experimentos con la forma cambia → observa → ¿por qué?, y ninguna respuesta pasa de 3 frases.
- **Tono.** Trato de tú, sin exclamaciones ni emojis, con punto decimal en todo el texto.
- **Valores dorados.** Los doce de la spec están en los tests, con su tolerancia. Los ejemplos de Al robot coinciden con la spec (628.3 y 20.94 rad/s; 0.670, 0.580 y 0.335 m/s; 0.9 m/s). Las cuentas del texto se rehicieron a mano y son correctas.
- **Referencias.** Todas las claves existen en `REFERENCES.md`.

## Hallazgos

| # | Tema/archivo | Tipo | Descripción | Severidad | Ticket |
|---|---|---|---|---|---|
| 1 | T-0.3 `ejercicios.ts:76-86`, `:27-29` | ejercicios | e3 sortea v₁ y v₂ en continuo e independientes en [0, 1] m/s. El enunciado los muestra con 4 cifras (`ExerciseWidget/state.ts:16`, #94) y la respuesta usa los valores sin redondear. Con \|v₂ − v₁\| pequeño, una respuesta bien calculada con los números del enunciado sale fuera del 2 % en ≈ 0.3 % de las instancias, y en ≈ 4 % la aceleración pedida es casi cero. Es el mismo riesgo que #259 corrigió en T-0.2 e1. | mayor | [#273](https://github.com/jams-robotics/trayectoria/issues/273) |
| 2 | T-0.3 `ejercicios.ts:15-25`; `CURRICULUM.md:48`; #252 | unidades (rangos) | Con los rangos de la spec, «tu robot» llega a 20 m/s en e1, 5 m/s en e2 y 4 m/s en e4. Supera 1.5 m/s en ≈ 15 %, 47 % y 74 % de las instancias. Choca con «rangos realistas» (`CONTENT-STANDARDS.md:48`), con la v_max de 0.670 m/s del robot de referencia y con el techo de 1.5 m/s de T-0.2 e1. | mayor | [#274](https://github.com/jams-robotics/trayectoria/issues/274) |
| 3 | T-0.3 `index.mdx:121-130` frente a T-0.2 `index.mdx:137-143` | nivel (coherencia entre temas) | T-0.3 atribuye al robot de referencia 0.09 m en 0.1 s, es decir, 0.9 m/s. T-0.2 acaba de calcular que ese robot tiene v_max = 0.670 m/s y que «ningún rumbo» lo hace ir más rápido. El número sale de `CURRICULUM.md:47` y la atribución, de la excepción de #252. | mayor | [#275](https://github.com/jams-robotics/trayectoria/issues/275) |
| 4 | `REFERENCES.md:3`, `:7-8`, `:16-17` | referencia | M0 es el primer uso de `young-freedman-1/2` y `serway-1/2`. La confirmación de edición y capítulo que exige `REFERENCES.md:3` no se ha hecho: el archivo no cambia desde el bootstrap. Las filas no dicen edición, al contrario que el ejemplo de §6 («14.ª ed.»), y Profundiza las muestra tal cual. | mayor | [#276](https://github.com/jams-robotics/trayectoria/issues/276) |
| 5 | T-0.3 `ejercicios.ts:27-29` frente a T-0.1 `ejercicios.ts:9-11` y T-0.2 `ejercicios.ts:10-12` | ejercicios (estilo) | T-0.1 y T-0.2 sortean en rejillas que el enunciado muestra exactas (centésimas, décimas, grados enteros). T-0.3 sortea en continuo, así que sus enunciados muestran valores como «Δx = 0.4373 m en Δt = 1.237 s» y el estudiante calcula con números distintos de los de la respuesta. La corrección propuesta en #273 lo resuelve. | menor | — (ver #273) |
| 6 | T-0.3 `index.mdx:34-35`; `content.json:17` | nivel | e3, que es obligatorio, pide la «aceleración media», pero el tema nunca la define: solo da `a = dv/dt`. Se infiere por analogía con v̄ = Δx/Δt. Basta una frase en Concepto: «la aceleración media es (v₂ − v₁)/Δt», con símbolos que ya están en el glosario (`GLOSSARY.md:20`). | menor | — |
| 7 | T-0.1 `index.mdx:19-20` | estilo | El gancho pregunta «¿cuántos vatios consume?» y el tema nunca calcula 6 V · 1.2 A = 7.2 W. Solo lo hace e4, que es opcional. T-0.2 (`:29-30`) y T-0.3 (`:43-45`) sí responden su gancho en Concepto. | menor | — |
| 8 | T-0.1 `index.mdx:114-121` frente a T-0.2 `index.mdx:122-124` | notación | La misma magnitud, la rueda con el motor sin carga, se llama ω_rueda en T-0.1 y ω_max en T-0.2. El glosario admite los dos nombres (`GLOSSARY.md:67-68`) y T-0.2 hace el puente de forma explícita («Es ω_max»), así que no hay error, pero sí dos nombres para lo mismo dentro del módulo. | menor | — |
| 9 | T-0.2 `index.mdx:81-83`, `:93`, `:103-108`, `:112-113` | notación | Explora escribe los vectores como a y b sin flecha, igual que las etiquetas del widget (`widgets.json`, `VectorWidget.nameA/nameB`). En cambio, Concepto, Fórmulas y la respuesta de `:116` usan a⃗ y b⃗. Además, una a sin flecha es la aceleración del glosario (`GLOSSARY.md:23`). | menor | — |
| 10 | T-0.3 `index.mdx:34`, `:60`, `:71`, `:93`, `:103`; `content.json:18` | notación | Dentro de T-0.3, `a` es la aceleración (m/s²) y en e4 es el coeficiente de x = a·t + b·t² (m/s). Además, la aceleración de ese movimiento es 2b y no a. En el módulo, `n` es la velocidad en rpm en T-0.1 (`:54`) y un exponente en T-0.3 (`:66`). El glosario delimita los dos usos (`GLOSSARY.md:57-58`, `:70`; DOCS-F6a #244), así que es una decisión registrada y no un error. | menor | — |
| 11 | T-0.2 `index.mdx:24` frente a T-0.1 `index.mdx:30` | estilo | Aparece «**magnitud**» en negrita y definida dos veces con dos sentidos. En T-0.1 es número × unidad. En T-0.2 es «cuánto» mide el vector, en la frase siguiente a usarla en el sentido de T-0.1 («un vector es una magnitud con dirección»). `CONTENT-STANDARDS.md:44` reserva la negrita para la primera definición. | menor | — |
| 12 | T-0.2 `index.mdx:56`, `:65` | unidades | θ figura en rad en la lista de variables, pero todos los números del tema usan grados: el gancho, Concepto, e1 y e2. El tema no da la relación 180° = π rad. T-0.1 (`:35`) solo da «una vuelta son 2π rad». Quien use la calculadora en modo radianes falla e1. | menor | — |
| 13 | T-0.1 `index.mdx:76` frente a `:19`; T-0.3 `index.mdx:75-80` frente a `:19` | widget | Los valores por defecto del widget no son los del gancho (`CONTENT-STANDARDS.md:69`). En T-0.1 el disco arranca a 20.94 rad/s (200 rpm) y el gancho habla de 6000 rpm, que queda fuera del deslizador, cuyo máximo es 600 rpm (`RotationWidget/panels.tsx:18`). En T-0.3 el widget arranca con v₀ = 0.5 m/s y a = 0.2 m/s², mientras que la tabla del gancho corresponde a v₀ = 0.4 m/s y a = 2 m/s². En los dos casos lo fija la spec (`CURRICULUM.md:26`, `:46`). | menor | — |
| 14 | T-0.3 `index.mdx:19-20` | longitud | El gancho tiene tres frases y el máximo es dos (`CONTENT-STANDARDS.md:11`). El texto es literal de la spec (`CURRICULUM.md:43`). | menor | — |
| 15 | los tres `index.mdx` y `content.json` | unidades | `CONTENT-STANDARDS.md:42` pide espacio fino antes de la unidad. Los tres temas usan espacio normal (U+0020), igual que los ejemplos del propio estándar. El módulo es coherente consigo mismo, pero no con la letra de la regla. | menor | — |
| 16 | T-0.1 `ejercicios.ts:61-70`, `:84-94`; T-0.2 `ejercicios.ts:129-135` | nivel | La dificultad no siempre crece como pide `CONTENT-STANDARDS.md:52`. T-0.1 e2 repite la operación de e1 con otro rango. T-0.1 e4 y T-0.2 e4 son aplicación directa, sin inversión de la fórmula ni razonamiento. T-0.2 e4 no genera valores, así que «Nuevos valores» repite la misma instancia, y su respuesta (53.13°) es la del valor dorado de e2. Todo sale de la spec (`CURRICULUM.md:28`, `:38`). | menor | — |
| 17 | T-0.3 `index.mdx:103` | estilo | En «cambia la aceleración a a un valor negativo», el símbolo seguido de la preposición se lee como una errata. Mejor: «pon a negativa, con v₀ positiva». | menor | — |

Resumen: 0 bloqueantes, 4 mayores y 13 menores.

### Excepciones decididas por el orquestador

- **#252 · «Al robot» de T-0.3 con el robot de referencia.** El tema usa `Formula` estática sustituida y no tiene `alrobot.ts` (`index.mdx:121-127`). En principio la excepción es razonable: Δx y Δt no son campos de `RobotSpec`, y §2.5 admite el robot de referencia «cuando el perfil no aplica». Aun así, **no debería quedar como está**. Es el único Al robot del módulo que no usa el perfil, y al atribuir 0.9 m/s al robot de referencia contradice a T-0.2 (hallazgo 3). La opción A de #275 hace el cálculo con el perfil (Δx = v_max·Δt con la v_max de T-0.2) y elimina la excepción. La opción B conserva la excepción y corrige solo la atribución.
- **#252 · rangos de e4 de T-0.3.** Se aplican tal cual (`ejercicios.ts:22-25`). Son parte del hallazgo 2 (#274), que propone acotarlos.
- **#259 · θ ∈ [10°, 80°] en T-0.2 e1.** Se aplica (`ejercicios.ts:74-79`). El mismo criterio debería aplicarse a T-0.3 e3 (hallazgo 1, #273).
- **DOCS-F6a #244 · símbolos con alcance en el glosario** (`a, b` en polinomios, `c` y `n` en derivadas). Se usan como dice el glosario. La colisión dentro de T-0.3 se anota como menor (hallazgo 10).

## Deriva detectada entre módulos

M0 es el primer módulo auditado y no hay un módulo anterior con el que comparar. Dentro del módulo, los tres temas coinciden en el estilo del gancho (tu robot, con números y pregunta), en la forma de Explora (frase descriptiva, tres experimentos y respuestas de 2–3 frases), en el tono y en la densidad de fórmulas (4, 5 y 3). La deriva interna es esta:

- **Cierre del gancho.** T-0.2 y T-0.3 lo responden en Concepto; T-0.1 deja sin responder la mitad del suyo (hallazgo 7).
- **Al robot.** T-0.1 y T-0.2 usan `RobotFormula` con el perfil; T-0.3 usa una `Formula` estática (#252).
- **Generación de ejercicios.** T-0.1 y T-0.2 usan rejillas exactas; T-0.3 sortea en continuo (hallazgo 5). También cambia la forma del código: T-0.3 no exporta cada ejercicio, tipa la lista con `as const` en vez de `readonly TopicExercise[]` y documenta la cabecera con `//` en vez de JSDoc. Esto es terreno del auditor de código y aquí solo se anota.
- **Formato de los números en `alrobot.ts`.** T-0.1 usa 4 cifras sin ceros finales; T-0.2 usa 3 cifras con ceros finales para las velocidades. Los dos coinciden con la spec, pero no hay una regla común.

Estas son las líneas base para C-M1: gancho respondido en Concepto, Al robot con `RobotFormula`, ejercicios en rejilla exacta y velocidades de «tu robot» ≤ 1.5 m/s.

## Recomendaciones para el orquestador

Son cambios en `docs/` que evitarían repetir los hallazgos en los módulos siguientes. Todos requieren al humano.

1. `CONTENT-STANDARDS.md` §5: añadir que los valores se sortean en una rejilla que el enunciado muestra exacta, y que se vuelve a sortear si la respuesta queda cerca de cero con tolerancia relativa. Generaliza #259 y el hallazgo 1.
2. `CONTENT-STANDARDS.md` §5: fijar un techo de velocidad para «tu robot» en los rangos (propuesta: 1.5 m/s, el de T-0.2 e1) y revisar con él los rangos de `CURRICULUM.md` de M1 a M6 antes de abrir sus tickets. Así se evita que se repita el hallazgo 2.
3. `CURRICULUM.md`: revisar las specs de M1 en adelante para que el gancho tenga como máximo dos frases y los valores por defecto del widget reproduzcan el gancho, o bien anotar en §7 que la spec puede fijar otros valores cuando el gancho queda fuera del rango del widget (hallazgos 13 y 14).
4. `CONTENT-STANDARDS.md` §4: aclarar si «espacio fino» significa U+202F o el espacio normal que usan los ejemplos, y alinear la regla con lo que hacen los temas (hallazgo 15).
5. `GLOSSARY.md`: anotar que «magnitud» tiene dos sentidos (magnitud física y norma de un vector, |a⃗|) y valorar «módulo» para el segundo. Valorar también renombrar los coeficientes `a, b` de x(t) = a·t + b·t² para que no choquen con la aceleración en el mismo tema (hallazgos 10 y 11).
6. `CONTENT-STANDARDS.md` §2: decidir si los enlaces internos entre temas del cuerpo (T-0.2 `index.mdx:122`, `/ruta/ruta-1/m00/t01`, el único del módulo) se escriben con la URL a mano o con un componente, y documentarlo antes de que M1 los multiplique.
7. `REFERENCES.md`: hacer la confirmación de primer uso en el mismo lote DOCS que el primer tema que estrena cada clave, no después (hallazgo 4).

## Veredicto

**Módulo aprobado con tickets.** No hay hallazgos bloqueantes. Los cuatro mayores (#273, #274, #275 y #276) deberían cerrarse antes de publicar el módulo. Los tres primeros son de T-0.3, y #274, #275 y #276 necesitan una decisión del humano sobre `docs/`. Los trece menores pueden ir en un lote posterior o quedar como están con las recomendaciones anotadas.
