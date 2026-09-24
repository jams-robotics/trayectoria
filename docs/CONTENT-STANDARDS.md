# Estándares de contenido

Aplican a todo tema en `content/`. El auditor de coherencia revisa contra este documento y contra `GLOSSARY.md`.

## 1. Principio

Cada tema termina en el robot. Si la sección "Al robot" es decorativa o forzada, el tema está mal y se rehace. Se visualiza para entender la matemática, no para evitarla: el nivel es universitario y se muestran las ecuaciones completas.

## 2. Anatomía obligatoria (7 secciones, en este orden)

1. **Gancho.** Una pregunta robótica concreta en máximo 2 frases. Con números. ("Tu motor gira a 200 rpm y tu rueda mide 3 cm de radio. ¿A qué velocidad avanza tu robot?")
2. **Concepto.** 150 a 350 palabras. Explica la idea con la visualización al lado. Sin historia, sin anécdotas, sin "en este tema aprenderás".
3. **Fórmulas.** Cada fórmula en su propio bloque con `Formula`, seguida de la lista de variables: símbolo, nombre, unidad SI. Símbolos exclusivamente del glosario.
4. **Explora.** El widget interactivo con 2 a 4 experimentos guiados, cada uno con la forma exacta: **cambia X → observa Y → ¿por qué?**, y una respuesta desplegable de máximo 3 frases.
5. **Al robot.** 100 a 300 palabras. El mismo concepto aplicado con datos de "Mi robot" (`useMyRobot()`) o del robot de referencia cuando el perfil no aplica. Debe incluir al menos un cálculo con los números del perfil del usuario, mostrado con `Formula` sustituida: `<RobotFormula calc="<topicId>/<calcId>" />`, con el cálculo exportado desde `alrobot.ts` (`WIDGETS.md`, Componentes MDX).
6. **Verifica.** 3 a 5 ejercicios con `ExerciseWidget`. Los marcados como obligatorios (mínimo 3) cuentan para completar el tema.
7. **Profundiza.** 1 a 3 referencias en formato fijo (§6) y, opcionalmente, un enlace a un tema posterior que usa este.

## 3. Frontmatter

```yaml
id: ruta-1/m04-t02
title: "v = ω·r: la velocidad del robot"
module: 4
order: 2
estimatedMinutes: 25
prerequisites: [ruta-1/m04-t01, ruta-1/m00-t01]
objectives:
  - Convertir velocidad angular a lineal para una rueda sin deslizamiento
  - Calcular la velocidad de avance de un robot a partir de rpm, reducción y radio
widgets: [RotationWidget, ExerciseWidget, MyRobotWidget]
requiredExercises: [e1, e2, e3]
references: [young-freedman-9, siegwart-3]
status: draft | review | published
```

## 4. Tono y estilo

- Trato de **tú**, directo, sin exclamaciones ni emojis.
- Frases cortas. Un párrafo, una idea.
- Sin metáforas que no aporten cálculo; se permiten comparaciones físicas concretas ("la rueda avanza un perímetro completo por cada vuelta").
- Números con unidad siempre, separador decimal punto, espacio fino antes de la unidad: `0.3 m/s`, `200 rpm`, `9.81 m/s²`.
- Notación exactamente como `GLOSSARY.md`. Introducir un símbolo nuevo requiere añadirlo al glosario primero (ticket de docs).
- Negritas solo para el término que se define por primera vez.

## 5. Ejercicios

- Definidos en `ejercicios.ts` con `defineExercise` (sim-core). Valores generados con rangos **realistas para robots educativos** (por ejemplo, `r ∈ [0.015, 0.05] m`, `L ∈ [0.08, 0.25] m`, `rpm ∈ [60, 600]`, `m ∈ [0.2, 3] kg`).
- Tolerancia relativa del 2 % por defecto; absoluta solo para ángulos (0.5°) y tiempos cortos (0.01 s).
- En una respuesta vectorial, `tolerance` y `unit` admiten una lista con una entrada por componente, de la misma longitud que la respuesta (F1-10b #256, F1-10c #262); p. ej. magnitud y ángulo: `unit: ['m/s', '°']` con tolerancia relativa en la magnitud y absoluta de 0.5° en el ángulo. Un solo valor se aplica a todas las componentes.
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
- Valores por defecto de los widgets iguales a los del gancho, para que lo que el estudiante lee sea lo que ve.

## 8. Accesibilidad del texto

- Toda visualización va acompañada de una frase que describe lo que muestra.
- Las fórmulas tienen su lectura en texto alternativo generado por KaTeX (activado en `Formula`).
- Sin información transmitida solo por color: usar etiquetas.

## 9. Lo que no va

- Historia de la ciencia, biografías, curiosidades.
- Ejercicios de "verdadero o falso" o de opción múltiple (v1 es numérico).
- Enlaces externos en el cuerpo del tema (solo en Profundiza).
- Contenido que no se pueda verificar con el simulador o con una fórmula del tema.
