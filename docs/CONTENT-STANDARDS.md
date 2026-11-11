# Estándares de contenido

Aplican a todo tema en `content/`. El auditor de coherencia revisa contra este documento y contra `GLOSSARY.md`.

## 1. Principio

Cada tema termina en el robot. Si la sección "Al robot" es decorativa o forzada, el tema está mal y se rehace. Se visualiza para entender la matemática, no para evitarla: el nivel es universitario y se muestran las ecuaciones completas.

## 2. Anatomía obligatoria (7 secciones, en este orden)

Orden desde la versión 1.5: Gancho (el reto), Explora, Concepto, Fórmulas, Al robot, Verifica, Profundiza. El estudiante primero prueba y después entiende; la fórmula llega al final, como resumen. `scripts/content-check.mjs` exige este orden.

1. **Gancho (el reto).** Una situación y una meta, en máximo 3 frases: qué falla, qué se ve raro o qué hay que decidir en un robot, y qué tiene que lograr el estudiante con el widget de Explora. Sin problema numérico de tarea ni datos que haya que sustituir en una fórmula; si un número sitúa la escena, se queda en uno. ("Tu robot sigue la línea, pero en cada curva se sale. Haz que complete la pista Curvas cerradas sin perderla.")
2. **Explora.** El widget interactivo y 2 a 4 experimentos guiados, cada uno con la forma exacta **cambia X → observa Y → ¿por qué?** y una respuesta desplegable de máximo 3 frases. Guía a lograr la meta del reto **sin teoría previa**: no nombra ni usa lo que el Concepto explica después, y el texto de arriba del widget solo dice qué ver y qué mover. La respuesta de cada experimento da el resultado en palabras y como mucho un número medido (el valor que se ve en el widget); los datos finos (RMS, medias con tres decimales) no entran. Un experimento que cita un valor medido lo conserva tal cual.
3. **Concepto.** 150 a 350 palabras, con una figura (`Figura`, §7). Explica por qué pasó lo que el estudiante acaba de ver en Explora, con sus propias palabras («viste que…»). Una idea por párrafo. Puede apoyarse en una situación real de robots (un robot que falló, una competencia, un almacén) si aclara el concepto; sin «en este tema aprenderás». Las fórmulas **no se escriben en el párrafo**: se nombran y se calculan en Fórmulas; en el párrafo solo van los símbolos, con subíndice compuesto (§4).
4. **Fórmulas.** Cada fórmula una sola vez, en su propio bloque con `Formula`, seguida de la lista de variables: símbolo, nombre, unidad SI. Símbolos exclusivamente del glosario. No se repite la fórmula en el Concepto ni se repite una leyenda ya dada en la fórmula anterior del mismo tema: la variable que ya se definió no vuelve a listarse.
5. **Al robot.** 100 a 300 palabras. El mismo concepto aplicado con datos de "Mi robot" (`useMyRobot()`) o del robot de referencia cuando el perfil no aplica. Debe incluir al menos un cálculo con los números del perfil del usuario, mostrado con `Formula` sustituida: `<RobotFormula calc="<topicId>/<calcId>" />`, con el cálculo exportado desde `alrobot.ts` (`WIDGETS.md`, Componentes MDX). Cuando ningún dato del perfil aplica, Al robot puede usar un dato del gancho y lo dice (aprobado por el humano en el chat, 2026-09-26).
   - **Solo usa lo ya enseñado** (#559, #574): en su ruta, lo anterior al tema; en otra ruta, la que su ruta sigue. Un número que sale de una fórmula que se enseña después entra como **dato de tu perfil**: el cálculo de `alrobot.ts` lo obtiene del perfil sin mostrar esa fórmula, y el texto lo llama dato y enlaza hacia adelante («de dónde sale: `[Rodadura: de la rueda al robot](/ruta/ruta-1/m01/t04)`»). Cada valor tiene una sola fila en «Mi robot»: la del primer tema que lo muestra con `RobotFormula`, aunque sea como dato. El tema que después enseña su fórmula la explica, dice qué temas la usaron como dato y cita esa fila sin `RobotFormula` propia; si nadie lo mostró antes, ese tema lo calcula.
   - **Añade, no repite** (#565): cada tema añade al menos una fila a «Mi robot» (tabla «Qué añade cada tema a Mi robot» de `CURRICULUM.md`). Un resultado que ya calculó otro tema se cita con enlace, sin `RobotFormula` propia.
   - **Cifras en `RobotFormula`** (#653; C-M2 h. 16, C-R1-M1 h. 1, C-R1-M3 h. 3): cada valor sustituido se escribe con las cifras significativas con que `CURRICULUM.md` escribe su valor de referencia («Referencia:» de Al robot; 3 si no lo escribe), **conservando los ceros de relleno** hasta completarlas, porque el cero final también es una cifra: `0.670 m/s`, `5.97 s`, `0.500 m/s`; nunca `0.67` ni `0.5`. Un valor con más dígitos enteros que cifras se escribe entero completo, sin redondear ni notación exponencial (`4658 rpm`, `1790 ticks/m`). En `alrobot.ts` eso es `value.toPrecision(n)` si `|value| < 10ⁿ` y `Math.round(value).toString()` si no; nunca `String(Number(value.toPrecision(n)))`, que quita los ceros, ni `toFixed`, que fija decimales y no cifras. Un dato del perfil que aparece sustituido (masa, radio, rpm, dientes) se escribe tal como lo guarda el perfil, sin recortar.
   - **Sin notas de plataforma** (v1.5): ninguna lección habla de lo que el simulador o la plataforma no hace, ni de planes futuros («cuando la plataforma admita…», «el simulador no muestra…», «el control llega a 600 rpm y no alcanza…»). El perfil «Mi robot» es un robot móvil de dos ruedas (`kind: 'mobile-diff'`) y no se explica ese caso en el cuerpo de ningún tema. Lo que sí dice cada tema, en una frase, es qué valor del robot de referencia entra cuando **falta un campo** del perfil («si tu perfil no guarda el motor, el cálculo usa 0.012 N·m y η_caja = 0.6 del robot de referencia»).
6. **Verifica.** 3 a 5 ejercicios con `ExerciseWidget`. Los marcados como obligatorios (mínimo 3) cuentan para completar el tema. Al menos uno es conceptual o de predicción («¿qué pasa si duplicas K_d?») y se responde con el widget de Explora (§5).
7. **Profundiza.** 1 a 3 referencias en formato fijo (§6) y, opcionalmente, un enlace a un tema posterior que usa este.

## 3. Frontmatter

```yaml
id: ruta-1/m01-t04
title: "Rodadura: de la rueda al robot"
module: 1
order: 4
estimatedMinutes: 25
prerequisites: [ruta-1/m01-t03, ruta-1/m00-t01]
objectives:
  - Convertir velocidad angular a lineal para una rueda sin deslizamiento
  - Calcular la velocidad de avance de un robot a partir de rpm, reducción y radio
widgets: [RotationWidget, ExerciseWidget, MyRobotWidget]
requiredExercises: [e1, e2, e3]
references: [young-freedman-9, siegwart-3]
status: draft | review | published
```

- `id` es `ruta-N/mMM-tNN`, igual que la carpeta; `module` = MM y `order` = NN, la posición en su ruta (`CURRICULUM.md`, «Estructura»). Un tema en reserva lleva `id: reserva/<slug>` y `status: draft`.
- `prerequisites` lleva ids completos, también los de otra ruta (#574): un tema de Robot móvil declara los temas concretos de Fundamentos que usa, aunque ya le lleguen por otro prerrequisito. Un prerrequisito va antes en la misma ruta o está en la ruta que esta sigue; nunca hacia adelante ni en la reserva (el build falla, `ARCHITECTURE.md` §3.2).
- Solo `status: published` se publica; un tema en `draft` o `review` no genera página.
- Los enlaces a otros temas en el cuerpo usan su URL, `/ruta/ruta-N/mMM/tNN`.
- **Enlace a la otra ruta** (#653; C-R1-M3 h. 2): un enlace a un tema de una ruta que la actual **no sigue** (hoy, de Fundamentos a Robot móvil) lleva a continuación, en la misma frase, la marca «en la ruta <nombre corto>», con el `shortTitle` de su `ruta.json`: `[Encoders](/ruta/ruta-2/m00/t01), en la ruta Robot móvil`. Es solo una cita de contenido: ese tema no puede ser prerrequisito. Los enlaces hacia la ruta que la actual sigue (de Robot móvil a Fundamentos) y los internos a la propia ruta no llevan marca.

## 4. Tono y estilo

- Trato de **tú**, directo, sin exclamaciones ni emojis.
- Frases cortas. Un párrafo, una idea.
- Sin metáforas que no aporten cálculo; se permiten comparaciones físicas concretas ("la rueda avanza un perímetro completo por cada vuelta").
- Números con unidad siempre, separador decimal punto y **espacio normal** (U+0020) antes de la unidad (aprobado por el humano en el chat, 2026-09-26; única regla, sustituye al espacio fino de C-M0/C-M2, #653): `0.3 m/s`, `200 rpm`, `9.81 m/s²`. Vale en prosa, enunciados (`content.json`), etiquetas de widgets y cifras de `RobotFormula`; nunca espacio fino (U+2009, U+202F), inseparable (U+00A0) ni unidad pegada (`0.3m/s`). Dentro de LaTeX (`Formula` y el `latex`/`substituted` de `alrobot.ts`) el equivalente entre una cifra y su unidad es `\ `: `0.670\ \text{m/s}`, no `\,` ni `\;`; el `\,` queda para separar símbolos dentro de una fórmula (`2\pi\,\text{ticks}`), que no es una cifra con unidad.
- Notación exactamente como `GLOSSARY.md`. Introducir un símbolo nuevo requiere añadirlo al glosario primero (ticket de docs).
- Negritas solo para el término que se define por primera vez.
- **Subíndices compuestos** (v1.5): en el texto corrido, los símbolos con subíndice se escriben con `<sub>` (`K<sub>p</sub>`, `v<sub>max</sub>`, `ω<sub>base</sub>`), nunca con guion bajo. Dentro de `Formula`, de `RobotFormula` y de los bloques de código (`` `K_p` `` en la lista de variables) sigue el LaTeX o el símbolo del glosario. En los atributos de `Experimento` (`cambia`, `observa`, `porque`), que son texto plano, se usa el nombre que muestra el control del widget (`Kp`, `Kd`) o la palabra («la ganancia derivativa»).
- Tono de compañero que ya armó el robot: directo, sin chistes forzados, sin exclamaciones en fila y sin frases de relleno.

## 5. Ejercicios

- Definidos en `ejercicios.ts` con `defineExercise` (sim-core). Valores generados con rangos **realistas para robots educativos** (por ejemplo, `r ∈ [0.015, 0.05] m`, `L ∈ [0.08, 0.25] m`, `rpm ∈ [60, 600]`, `m ∈ [0.2, 3] kg`).
- Tolerancia relativa del 2 % por defecto; absoluta solo para ángulos (0.5°) y tiempos cortos (0.01 s).
- Con tolerancia relativa, el generador vuelve a sortear toda respuesta no nula con |valor| < 0.025 en su unidad (un 0 exacto se queda): desde 0.025 el 2 % cubre el redondeo a la milésima. El ExerciseWidget muestra la nota fija «Responde con al menos tres cifras significativas.» (#568, #621).
- En una respuesta vectorial, `tolerance` y `unit` admiten una lista con una entrada por componente, de la misma longitud que la respuesta (F1-10b #256, F1-10c #262); p. ej. módulo y ángulo: `unit: ['m/s', '°']` con tolerancia relativa en el módulo y absoluta de 0.5° en el ángulo. Un solo valor se aplica a todas las componentes.
- Todo ejercicio con respuesta vectorial, con `unit` compartida o por componente, declara también `labels` en `generate`: una clave por componente, `content.<topicId>.labels.<exerciseId>.<n>`, cuyo texto en `content.json` (bajo `"labels": { "<exerciseId>": [...] }` del tema) es una etiqueta breve con el nombre de la magnitud que pide el enunciado y su símbolo si lo da (p. ej. «Velocidad angular ω», «Avance Δs», «Coordenada x»); ningún campo de respuesta sale numerado (#629, #540).
- Enunciados con la unidad de respuesta esperada explícita. El texto va en `packages/i18n/locales/es/content.json` con la clave `content.<topicId>.<exerciseId>`; `ejercicios.ts` solo la referencia (ARCHITECTURE §3.3).
- Dificultad creciente: e1 aplicación directa, e2 con conversión de unidades o dos pasos, e3 en el contexto del robot, e4 y e5 opcionales con inversión de la fórmula o razonamiento.
- Cada ejercicio tiene un test con un valor dorado calculado a mano en `CURRICULUM.md`.

## 6. Referencias

Formato fijo, en `docs/REFERENCES.md` con clave, y en el tema solo la clave:

```
young-freedman-9: Young, H. D. y Freedman, R. A. Física universitaria, vol. 1, 14.ª ed. Capítulo 9, "Rotación de cuerpos rígidos".
```

Solo libros de la lista base de `PLAN.md` §2 y artículos revisados. Nunca blogs, videos ni Wikipedia.

## 7. Widgets

- Un tema solo usa widgets del catálogo (`WIDGETS.md`). Configurarlos por props, nunca modificarlos.
- Máximo un widget "grande" (Scene2D/Scene3D) por sección Explora; los demás son paneles y gráficas.
- Valores por defecto de los widgets iguales a los del reto, para que lo que el estudiante lee sea lo que ve; si el control no los alcanza, el reto usa los que sí alcanza, sin disculparse en el texto.
- **Una figura por concepto** (v1.5): cada tema lleva una `Figura` en el Concepto, un SVG propio y sobrio, pintado con los tokens de color del sitio (`var(--color-…)`) para que funcione en claro y oscuro, con `alt` (texto alternativo) y un pie de una línea. Sin imágenes generadas ni de terceros. Dónde irían una foto o un video de un robot real se anota en `COORDINACION.md`, no en el tema.

## 8. Accesibilidad del texto

- Toda visualización va acompañada de una frase que describe lo que muestra.
- Las fórmulas tienen su lectura en texto alternativo generado por KaTeX (activado en `Formula`).
- Sin información transmitida solo por color: usar etiquetas.

## 9. Lo que no va

- Biografías y datos curiosos que no aclaran el concepto. Una situación real de robots que lo aclara sí va (§2.3).
- Ejercicios de «verdadero o falso». La opción múltiple solo es conceptual o de predicción sobre el widget (§2.6).
- Enlaces externos en el cuerpo del tema (solo en Profundiza).
- Contenido que no se pueda verificar con el simulador o con una fórmula del tema.
