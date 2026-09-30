# Estándares de contenido

Aplican a todo tema en `content/`. El auditor de coherencia revisa contra este documento y contra `GLOSSARY.md`.

## 1. Principio

Cada tema termina en el robot. Si la sección "Al robot" es decorativa o forzada, el tema está mal y se rehace. Se visualiza para entender la matemática, no para evitarla: el nivel es universitario y se muestran las ecuaciones completas.

## 2. Anatomía obligatoria (7 secciones, en este orden)

1. **Gancho.** Una pregunta robótica concreta en máximo 3 frases; con números cuando el temario los da (aprobado por el humano en el chat, 2026-09-26). ("Tu motor gira a 200 rpm y tu rueda mide 3 cm de radio. ¿A qué velocidad avanza tu robot?")
2. **Concepto.** 150 a 350 palabras. Explica la idea con la visualización al lado. Sin historia, sin anécdotas, sin "en este tema aprenderás".
3. **Fórmulas.** Cada fórmula en su propio bloque con `Formula`, seguida de la lista de variables: símbolo, nombre, unidad SI. Símbolos exclusivamente del glosario.
4. **Explora.** El widget interactivo con 2 a 4 experimentos guiados, cada uno con la forma exacta: **cambia X → observa Y → ¿por qué?**, y una respuesta desplegable de máximo 3 frases.
5. **Al robot.** 100 a 300 palabras. El mismo concepto aplicado con datos de "Mi robot" (`useMyRobot()`) o del robot de referencia cuando el perfil no aplica. Debe incluir al menos un cálculo con los números del perfil del usuario, mostrado con `Formula` sustituida: `<RobotFormula calc="<topicId>/<calcId>" />`, con el cálculo exportado desde `alrobot.ts` (`WIDGETS.md`, Componentes MDX). Cuando ningún dato del perfil aplica, Al robot puede usar un dato del gancho y lo dice (aprobado por el humano en el chat, 2026-09-26).
   - **Solo usa lo ya enseñado** (#559, #574): en su ruta, lo anterior al tema; en otra ruta, la que su ruta sigue. Un número que sale de una fórmula que se enseña después entra como **dato de tu perfil**: el cálculo de `alrobot.ts` lo obtiene del perfil sin mostrar esa fórmula, y el texto lo llama dato y enlaza hacia adelante («de dónde sale: `[Rodadura: de la rueda al robot](/ruta/ruta-1/m01/t04)`»). Cada valor tiene una sola fila en «Mi robot»: la del primer tema que lo muestra con `RobotFormula`, aunque sea como dato. El tema que después enseña su fórmula la explica, dice qué temas la usaron como dato y cita esa fila sin `RobotFormula` propia; si nadie lo mostró antes, ese tema lo calcula.
   - **Añade, no repite** (#565): cada tema añade al menos una fila a «Mi robot» (tabla «Qué añade cada tema a Mi robot» de `CURRICULUM.md`). Un resultado que ya calculó otro tema se cita con enlace, sin `RobotFormula` propia.
   - **Cifras en `RobotFormula`** (#653; C-M2 h. 16, C-R1-M1 h. 1, C-R1-M3 h. 3): cada valor sustituido se escribe con las cifras significativas con que `CURRICULUM.md` escribe su valor de referencia («Referencia:» de Al robot; 3 si no lo escribe), **conservando los ceros de relleno** hasta completarlas, porque el cero final también es una cifra: `0.670 m/s`, `5.97 s`, `0.500 m/s`; nunca `0.67` ni `0.5`. Un valor con más dígitos enteros que cifras se escribe entero completo, sin redondear ni notación exponencial (`4658 rpm`, `1790 ticks/m`). En `alrobot.ts` eso es `value.toPrecision(n)` si `|value| < 10ⁿ` y `Math.round(value).toString()` si no; nunca `String(Number(value.toPrecision(n)))`, que quita los ceros, ni `toFixed`, que fija decimales y no cifras. Un dato del perfil que aparece sustituido (masa, radio, rpm, dientes) se escribe tal como lo guarda el perfil, sin recortar.
   - **El caso «tu perfil no es un robot móvil»** (#653; #569.19, C-R2-M0 h. 1) se explica **una sola vez**, en Al robot de T1-0.1, donde se crea el perfil: «Mi robot» es un robot móvil de dos ruedas (`kind: 'mobile-diff'`, `ROBOT-SPEC.md` §1); cuando la plataforma admita otro tipo de perfil (un brazo), los temas de estas dos rutas calcularán con el robot de referencia. Ningún otro tema repite esa frase condicional. Lo que sí dice cada tema, en una frase, es qué valor del robot de referencia entra cuando **falta un campo** del perfil («si tu perfil no guarda el motor, el cálculo usa 0.012 N·m y η_caja = 0.6 del robot de referencia»).
6. **Verifica.** 3 a 5 ejercicios con `ExerciseWidget`. Los marcados como obligatorios (mínimo 3) cuentan para completar el tema.
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
- Valores por defecto de los widgets iguales a los del gancho, para que lo que el estudiante lee sea lo que ve, salvo que el temario fije otros o el control no los alcance; entonces Explora explica de dónde salen los suyos (aprobado por el humano en el chat, 2026-09-26).

## 8. Accesibilidad del texto

- Toda visualización va acompañada de una frase que describe lo que muestra.
- Las fórmulas tienen su lectura en texto alternativo generado por KaTeX (activado en `Formula`).
- Sin información transmitida solo por color: usar etiquetas.

## 9. Lo que no va

- Historia de la ciencia, biografías, curiosidades.
- Ejercicios de "verdadero o falso" o de opción múltiple (v1 es numérico).
- Enlaces externos en el cuerpo del tema (solo en Profundiza).
- Contenido que no se pueda verificar con el simulador o con una fórmula del tema.
