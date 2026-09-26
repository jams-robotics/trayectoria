# Auditoría de coherencia — C-M3

2026-09-26 · auditor de coherencia / Claude Opus 5.5 · T-3.1 Trabajo y energía y T-3.2 Potencia (Explora con `PowerWidget` desde #367), los dos en `status: review` sobre `main` (21f61ff).

## Método

Se leyeron completos los dos temas: `content/es/ruta-1/m03-t0{1,2}/index.mdx`, `ejercicios.ts`, `alrobot.ts` y sus tests, y los enunciados de `packages/i18n/locales/es/content.json:63-74`. Se revisaron contra `CURRICULUM.md` § Módulo 3 (con las decisiones de #300 y #351), `CONTENT-STANDARDS.md`, `GLOSSARY.md`, `WIDGETS.md` (EnergyWidget y PowerWidget), `REFERENCES.md` y la lista mínima de «Auditorías de coherencia». Se comprobaron también los rangos y el formato de los paneles de los dos widgets (`EnergyWidget/panels.tsx`, `PowerWidget/rows.ts`) y las etiquetas de `widgets.json`, porque el texto de Explora describe lo que muestran. En cada tema y entre los dos se revisó:

1. Símbolos: todos existen en el glosario con la misma unidad, y se usan los mismos para lo mismo.
2. Fórmulas: las de la spec aparecen tal cual, con la lista de variables (símbolo, nombre, unidad).
3. Widgets: los de la spec, con sus props exactas y sin widgets nuevos; valores por defecto frente al gancho; frase descriptiva.
4. Al robot: usa `RobotFormula` sobre `useMyRobot()` (`apps/web/src/components/tema/RobotCalcFormula.tsx:22`) y su ejemplo coincide con la spec.
5. Ejercicios: valores dorados en los tests con su tolerancia, unidad en el enunciado, dificultad creciente y rangos realistas.
6. Tono, longitudes y forma de Explora. Se contaron las palabras de Concepto y Al robot y las frases de cada respuesta desplegable.
7. Comparación con el Módulo 2 en `main` (T-2.1 a T-2.3; C-M2, #427, sigue abierta) y con las líneas base de C-M0.
8. Referencias.

Cada hallazgo se clasifica como **técnico** (corregirlo no cambia lo que ve el estudiante) o **visible** (corregirlo cambia texto, números o símbolos en pantalla). Los visibles van a «Para la validación del humano» y no se corrigen ahora.

Se revisó sin hallazgos:

- **Anatomía y frontmatter.** Las siete secciones están en orden en los dos temas. Título, tiempo, prerrequisitos (2.1; 3.1 y 2.3), objetivos, widgets, ejercicios obligatorios y referencias coinciden con la spec. Los dos temas están en `ruta.json:41-42`.
- **Fórmulas.** Las seis de T-3.1 y las siete de T-3.2 aparecen con las mismas variables y su lista. T-3.2 escribe `t_{\text{autonomía}}` en lugar de `t_{autonomía}` (`index.mdx:80`): es solo tipografía (el subíndice sale en redonda) y no se cuenta como hallazgo.
- **Props de los widgets.** `EnergyWidget` (T-3.1:96) y `PowerWidget` (T-3.2:96) llevan las props exactas de la spec. Ninguno se ha modificado. Los tres experimentos de cada tema son los de la spec y caben en los rangos de los paneles: v₀ hasta 1.5 m/s y μₖ hasta 0.3 en `EnergyWidget`, y P hasta 20 W y m hasta 3 kg en `PowerWidget`.
- **Longitudes.** Concepto tiene 299 y 268 palabras (rango 150–350) y Al robot 173 y 145 (rango 100–300). Cada tema tiene tres experimentos con la forma cambia → observa → ¿por qué?, y ninguna respuesta pasa de 3 frases.
- **Tono.** Trato de tú, sin exclamaciones ni emojis, punto decimal. Los ángulos de T-3.1 van en rad (θ = π/2 rad, π rad), como dice la lista de variables: no se repite el hallazgo 12 de C-M0.
- **Valores dorados.** Los ocho de la spec están en los tests con la tolerancia por defecto (relativa 2 %): 0.162 J, 0.01835 m, 0.162 J y 1.6 J; 15.71 W, 4.32 W, 46.25 min y 0.6 W. Los ejemplos de Al robot coinciden con la spec (0.202 J y 0.0229 m; 14.4 W, 0.771 h y 46.3 min) y los tests comprueban el perfil sin campos opcionales y el perfil de brazo. Las cuentas del texto se rehicieron: todas cuadran salvo la del hallazgo 5.
- **Ejercicios.** Todos sortean en rejillas que el enunciado muestra exactas (línea base de C-M0) y las velocidades de «tu robot» no pasan de 1.5 m/s. Los enunciados dan la unidad de respuesta y sus claves `{{…}}` coinciden con los nombres de `values`, que son los del glosario.
- **Referencias.** `young-freedman-6` y `young-freedman-7` existen en `REFERENCES.md:12-13` y heredan la edición de la fila 1. Ver el hallazgo 2.

## Hallazgos

| # | Tema/archivo | Tipo | Clase | Descripción | Severidad | Ticket |
|---|---|---|---|---|---|---|
| 1 | T-3.2 `index.mdx:94`, `:103-104`; `GLOSSARY.md:32` | notación | técnico | Explora usa `H` para la altura final de la carga («escala fija m·g·H», «t_subida = m·g·H/P») y `t_subida` para el tiempo de subida. Los dos vienen de `WIDGETS.md:124-127` (#351). Ninguno está en el glosario: `H` solo existe como «H (en tiro) · altura máxima» y `t_subida` no aparece. Esto incumple `CONTENT-STANDARDS.md:13` y `:43`. `ΔEₖ` (T-3.1 `:30`, `:75`) tampoco tiene fila propia, aunque se define en la lista de variables siguiendo el patrón de Δx. La corrección está solo en `docs/`: añadir `H (en elevación)` · altura final de la carga · m · `liftHeight_m`, `t_subida` · tiempo de subida · s y, si se quiere, `ΔEₖ`. El texto del tema no cambia. | mayor | — (DOCS) |
| 2 | `REFERENCES.md:3`, `:12-13`, `:29-31` | referencia | técnico | M3 es el primer uso de `young-freedman-6` y `young-freedman-7`. `REFERENCES.md:3` pide confirmar el capítulo en el primer uso, pero la sección «Capítulos confirmados» solo lista los capítulos 1 y 2 (#276). Es el mismo caso que el hallazgo 4 de C-M0. Se corrige en `docs/` y el tema no cambia, porque solo lleva la clave. | mayor | — (DOCS) |
| 3 | T-3.2 `index.mdx:18-20`, `:28-29`, `:41-43`; `content.json:70`; `CURRICULUM.md:146`, `:151` | nivel (coherencia entre temas) | visible | El gancho dice «Tu motor entrega 0.03 N·m a 5000 rpm» y Concepto calcula 15.71 W mecánicos. «Tu motor» ya tiene datos en el módulo 0: T-0.1 da 0.012 N·m, 6 V y 1.2 A (`m00-t01/index.mdx:19`), y T-2.3 da 0.012 N·m en bloqueo. Un motor con 0.012 N·m de bloqueo no entrega 0.03 N·m a ninguna velocidad. Además, el mismo Concepto usa luego ese motor de T-0.1 para la autonomía: 7.2 W eléctricos por motor y 14.4 W los dos. Leído seguido, un solo motor daría más potencia mecánica (15.71 W) de la que consumen los dos juntos, es decir, η ≈ 2.2 cuando el tema acaba de decir que η está entre 0 y 1. Los números salen de la spec: el gancho y el valor dorado de e1. | mayor | — |
| 4 | T-3.2 `index.mdx:18-20`; `CURRICULUM.md:146` | longitud | visible | El gancho tiene tres frases y el máximo es dos (`CONTENT-STANDARDS.md:11`). Además, su segunda pregunta no se puede responder con sus datos, porque falta la corriente: Concepto la toma de la hoja de datos de T-0.1 (`:42-43`). El texto es literal de la spec. Es el mismo caso que el hallazgo 14 de C-M0. | menor | — |
| 5 | T-3.2 `index.mdx:113` | unidades (cifras) | visible | «de 0.4893 m/s a 0.2447 m/s»: 4.32/(1.8·9.81) = 0.24465, que a 4 cifras es 0.2446. Es la cifra que muestra el panel de `PowerWidget`, que formatea con `format` de sim-core (`rows.ts:25`). El estudiante lee un número y el widget le muestra otro. | menor | — |
| 6 | T-3.2 `index.mdx:43` frente a `:142-143` | unidades (cifras) | visible | El mismo cálculo da «0.771 h, unos 46.25 min» en Concepto y «0.771 h, unos 46.3 min» en Al robot. Además, 0.771·60 = 46.26 y no 46.25, y «unos» no casa con cuatro cifras. La spec da las dos cifras: 46.25 es el valor dorado de e3 y 46.3 el ejemplo de Al robot. Se propone escribir 46.3 min en los dos sitios, o 46.25 min sin «unos» y sin pasar por 0.771 h. | menor | — |
| 7 | T-3.2 `index.mdx:42-43` | estilo | visible | «los de la hoja de datos de T-0.1»: es el ID interno del ticket, y es el único caso en todos los `index.mdx` de la ruta. Al robot del mismo tema (`:130-131`) y el resto de la ruta nombran el tema con su título enlazado: «Unidades y magnitudes» (`/ruta/ruta-1/m00/t01`). | menor | — |
| 8 | T-3.2 `index.mdx:119`, `:123` frente a T-3.1 `index.mdx:34`, `:61`, `:67`; `GLOSSARY.md:53` | notación | visible | T-3.2 escribe `E_p` y T-3.1 y el glosario escriben `Eₚ`. T-3.2 copia la etiqueta del widget (`widgets.json:273`, `barLabel: "E_p"`; `WIDGETS.md:125`), así que dentro del módulo la misma magnitud aparece escrita de dos formas. Se corrige en el texto de T-3.2 y en la etiqueta i18n del widget, así que es visible. | menor | — |
| 9 | T-3.1 `index.mdx:92`; `EnergyWidget/panels.tsx:18`, `:53` | widget | visible | El texto dice «sube una rampa de 0.26 rad», pero el panel muestra el ángulo en grados enteros (15°). Lo que el estudiante lee no es lo que ve (`CONTENT-STANDARDS.md:69`). El valor 0.26 rad viene de las props de la spec. Se propone «una rampa de unos 15° (0.26 rad)». | menor | — |
| 10 | T-3.2 `index.mdx:96` frente a `:18-20`; `CURRICULUM.md:149` | widget | visible | Los valores por defecto del widget no son los del gancho (`CONTENT-STANDARDS.md:69`). El gancho plantea 15.71 W y `PowerWidget` arranca con 4.32 W, la potencia de e2. Lo fija la spec (#351), y el texto de Explora explica de dónde sale 4.32 W. Es el mismo caso que el hallazgo 13 de C-M0. | menor | — |
| 11 | T-3.1 `ejercicios.ts:57-91`; T-3.1 y T-3.2 e4; `CURRICULUM.md:140`, `:152` | nivel | visible | La dificultad no crece como pide `CONTENT-STANDARDS.md:52`. En T-3.1, e3 es el mismo cálculo que e1 (½·m·v²), con los mismos rangos y el mismo valor dorado (0.162 J), y Concepto lo resuelve con esos números (`index.mdx:31-32`). Los dos e4 son aplicación directa (f·D y F·v), sin inversión ni razonamiento. Todo sale de la spec. Es el mismo caso que el hallazgo 16 de C-M0. | menor | — |

Resumen: 0 bloqueantes, 3 mayores y 8 menores. Técnicos: 2 (hallazgos 1 y 2), los dos mayores y no bloqueantes. Los dos se corrigen solo en `docs/`, así que no se han abierto issues `content`. Visibles: 9 (hallazgos 3 a 11).

## Para la validación del humano

Estos hallazgos cambian lo que ve el estudiante. No se corrigen ahora. El módulo no se publica hasta que el humano los valide.

1. **Hallazgo 3 (mayor) · el motor del gancho de T-3.2.** Hay que decidir entre dos opciones:
   - **A.** Cambiar el gancho y e1 de `CURRICULUM.md` § T-3.2 por un motor coherente con el de T-0.1. Por ejemplo, el punto de máxima potencia del motor de referencia: 0.006 N·m a 3000 rpm, ≈ 1.88 W. El valor dorado de e1 cambiaría.
   - **B.** Mantener los números y añadir en Concepto que el motor del gancho es otro, más grande que el de «tu robot». Así no se mezcla con los 7.2 W por motor de T-0.1.
2. **Hallazgo 4 (menor) · gancho de tres frases.** Reducirlo a dos frases, y decidir si el gancho da la corriente o si la pregunta de la autonomía pasa a Concepto.
3. **Hallazgos 5 y 6 (menores) · cifras.** Corregir 0.2447 → 0.2446 m/s y unificar la autonomía en una sola cifra (46.3 min o 46.25 min).
4. **Hallazgo 7 (menor) · «T-0.1».** Cambiarlo por el título enlazado del tema.
5. **Hallazgo 8 (menor) · `E_p` / `Eₚ`.** Unificar en `Eₚ`, como el glosario, en el texto de T-3.2 y en la etiqueta `widgets.PowerWidget.barLabel`, o bien anotar en el glosario que el widget usa `E_p`.
6. **Hallazgo 9 (menor) · 0.26 rad frente a 15°.** Añadir los grados en el texto de Explora de T-3.1.
7. **Hallazgo 10 (menor) · valores por defecto del widget.** Aceptarlos como están (decisión de #351) o anotar la excepción en `CONTENT-STANDARDS.md` §7, igual que la recomendación 3 de C-M0.
8. **Hallazgo 11 (menor) · progresión de la dificultad.** Decidir si T-3.1 e3 pasa a otro cálculo (p. ej., trabajo neto entre dos velocidades no nulas, ½·m·(v₂² − v₁²)) y si los e4 se convierten en inversión de la fórmula. Implica cambiar la spec y sus valores dorados.

## Deriva detectada entre módulos

La comparación se hace con el Módulo 2 en `main` y con las líneas base de C-M0. M1 y M2 todavía no están auditados (#426 y #427).

- **Gancho.** En M2 los tres ganchos tienen dos frases y usan el robot o el motor de referencia (T-2.3: 0.012 N·m en bloqueo). T-3.1 sigue ese estilo. T-3.2 rompe las dos cosas: tiene tres frases y un motor distinto (hallazgos 3 y 4). Los dos ganchos de M3 se responden en Concepto (línea base de C-M0).
- **Densidad de fórmulas.** En la sección Fórmulas, M2 tiene 3, 5 y 5 bloques `Formula`, y M3 tiene 6 y 7. La subida viene de la spec (T-3.2 incluye la conversión 1 Wh = 3600 J) y no rompe el nivel.
- **Al robot.** Los dos temas de M3 usan solo `RobotFormula`, con dos cálculos cada uno. M2 combina `RobotFormula` con alguna `Formula` estática para constantes del texto (T-2.2, #299). Es coherente con la línea base de C-M0.
- **Longitudes y Explora.** Están en los mismos rangos que M2: Concepto de 282 a 307 palabras en M2 y 268 a 299 en M3; Al robot de 177 a 196 en M2 y 145 a 173 en M3. Explora tiene tres experimentos con frase descriptiva. T-3.2 es el primer tema de la ruta en el que el widget no reproduce el gancho por decisión de un ticket de widget (#351) y no de la spec original.
- **Formato de números en `alrobot.ts`.** T-3.1 conserva los ceros finales (`toPrecision`, «0.670») y T-3.2 los quita (`String(Number(…))`, «14.4»). Sigue la misma mezcla que C-M0 anotó en M0, y también está en M1 y M2. Todavía no hay regla común.
- **Espacio antes de la unidad.** Los dos temas usan espacio normal (U+0020), como M0 a M2. El hallazgo 15 de C-M0 y su recomendación 4 siguen sin resolverse en `CONTENT-STANDARDS.md:42`.
- **Símbolos que vienen de los widgets.** Es nuevo en M3: `WIDGETS.md` fija símbolos (`H`, `t_subida`, `E_p`) que el tema copia y que el glosario no tiene (hallazgos 1 y 8).

## Recomendaciones para el orquestador

Son cambios en `docs/` que evitarían repetir los hallazgos. Todos requieren al humano.

1. `GLOSSARY.md`: añadir `H (en elevación)`, `t_subida` y, si se quiere, `ΔEₖ` en un lote DOCS (hallazgo 1). Añadir también a la plantilla de los tickets de widget un paso que compruebe los símbolos de la entrada de `WIDGETS.md` contra el glosario.
2. `REFERENCES.md`: añadir `young-freedman-6` y `young-freedman-7` a «Capítulos confirmados» (hallazgo 2). Conviene hacerlo en el mismo lote que las claves que estrenan M1, M2 y M4 (`young-freedman-3`, `-4`, `-5`, `-9`, `-10`, `serway-4`, `-5`, `-10`), que tampoco están en esa sección, como ya proponía la recomendación 7 de C-M0.
3. `CURRICULUM.md` § T-3.2: resolver el hallazgo 3 con la opción que decida el humano y reducir el gancho a dos frases (hallazgo 4). Es la misma revisión que la recomendación 3 de C-M0, que sigue pendiente para M4 en adelante.
4. `CURRICULUM.md` (cabecera o § «Cómo leer una spec»): fijar que un gancho que dice «tu motor» o «tu robot» usa los datos del robot de referencia, o que avisa cuando no lo hace. Así se evita que se repita el hallazgo 3.
5. `CONTENT-STANDARDS.md` §4: fijar una sola forma de redondear los resultados del texto. Por ejemplo, la misma que `format` de sim-core (4 cifras) cuando el número coincide con un valor del widget, y la del ejemplo de la spec en Al robot. Así se evitan los hallazgos 5 y 6.
6. `CONTENT-STANDARDS.md` §4: prohibir los IDs de ticket (`T-m.n`) en el cuerpo de los temas y remitir siempre al título enlazado (hallazgo 7).

## Veredicto

**Módulo aprobado con tickets.** No hay hallazgos bloqueantes. Los dos técnicos (1 y 2) son de `docs/` y conviene cerrarlos en un lote DOCS antes de publicar. Los nueve visibles esperan la validación del humano, que está listada arriba. El único mayor entre ellos, el hallazgo 3 (el motor del gancho de T-3.2), necesita decidir entre la opción A y la B antes de publicar el módulo.
