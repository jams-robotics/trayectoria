# Auditoría de coherencia — C-M4

2026-09-26 · auditor de coherencia / Claude Opus 5.5 · T-4.1 Movimiento circular y velocidad angular (#322), T-4.2 v = ω·r: la velocidad del robot (#339), T-4.3 Aceleración angular y centrípeta (#340), T-4.4 Transmisión y reducción (#330, #354) y T-4.5 Encoders (#344). Los cinco están en `status: review` sobre `main` (6e3157e).

## Método

Se leyeron completos los cinco temas: `content/es/ruta-1/m04-t0{1..5}/index.mdx`, `ejercicios.ts`, `alrobot.ts` y sus tests, y los enunciados de `packages/i18n/locales/es/content.json`. Se revisaron contra `CONTENT-STANDARDS.md`, `GLOSSARY.md`, `WIDGETS.md`, `REFERENCES.md` y `CURRICULUM.md` (Módulo 4 y la lista mínima de «Auditorías de coherencia»). También se comprobaron los rangos de los sliders en `packages/widgets/src/{RotationWidget,GearWidget,DiffDriveWidget}/panels.tsx`. Después se compararon con M3 (`m03-t01`, `m03-t02`) y con las líneas base de C-M0. C-M0 es la única auditoría anterior.

En cada tema y entre los cinco se revisó:

1. Símbolos: todos existen en el glosario con la misma unidad, y se usan los mismos para lo mismo.
2. Fórmulas: las de la spec aparecen tal cual, cada una con su lista de variables.
3. Widgets: son los de la spec, con sus props exactas. Se comprobó que los valores de los experimentos caben en los sliders y que los valores por defecto reproducen el gancho.
4. Al robot: `RobotFormula` sobre `useMyRobot()`, con respaldo al robot de referencia, y el ejemplo de referencia de la spec.
5. Ejercicios: valores dorados y tolerancia en los tests, unidad en el enunciado, rejilla exacta y rangos realistas. Se estimó por simulación (10⁶ sorteos) qué fracción de instancias sale de los rangos realistas.
6. Tono, longitudes y forma de Explora, con un recuento de palabras y de frases.
7. Nivel, progresión 4.1 → 4.5, prerrequisitos y comparación con M3.
8. Referencias.

Cada hallazgo se clasifica según la decisión del humano en #429:

- **Técnico:** no cambia lo que ve el estudiante.
- **Visible:** cambia lo que ve el estudiante. Va a «Para la validación del humano» y no se corrige ahora.

Se revisó sin hallazgos:

- **Anatomía y frontmatter.** Las siete secciones están en orden en los cinco temas. Título, tiempo, prerrequisitos, objetivos, widgets, ejercicios obligatorios y referencias coinciden con la spec. `ruta.json` los lista en orden. `pnpm content:check`: 21 temas, 0 incumplimientos.
- **Fórmulas.** Las 23 de la spec aparecen idénticas (5, 5, 5, 4 y 4), todas con su lista de variables. Todos los símbolos, incluidos los de `alrobot.ts` (`ω_rueda`, `ω_max`, `v_max`, `τ_motor`, `τ_rueda`, `D`), están en `GLOSSARY.md` con la misma unidad.
- **Props de los widgets.** `RotationWidget` (T-4.1:89, T-4.2:91, T-4.3:93), `MyRobotWidget mode="card"` (T-4.2:126), `GearWidget` (T-4.4:80-83) y `DiffDriveWidget` (T-4.5:83-88) llevan las props exactas de la spec. Todos los valores de los experimentos caben en los sliders: 60 y 200 rpm; r = 0.064 m; v = 1 m/s; α = 83.78 rad/s²; R = 0.25 m; z = 12, 30 y 60; N_e = 20 y 2000, dentro de [16, 4096].
- **Longitudes.** Concepto tiene 284, 277, 274, 282 y 240 palabras (rango 150–350). Al robot tiene 154, 202, 179, 200 y 132 (rango 100–300). Cada tema tiene tres experimentos con la forma cambia → observa → ¿por qué?, y ninguna respuesta pasa de 3 frases.
- **Tono.** Trato de tú, sin exclamaciones ni emojis, con punto decimal. Cada término en negrita se define una sola vez en la ruta.
- **Valores dorados.** Los de los 20 ejercicios de la spec están en los tests con su tolerancia: 22 valores, contando las dos componentes de T-4.2 e2 y de T-4.5 e2. Los ejemplos de Al robot coinciden con la spec (20.94 rad/s y 0.3 s; 200 rpm, 0.670 m/s y 5.97 s; 1.28 m/s² y 0.94 m/s; 0.216 N·m, 240 rpm y 0.804 m/s; 0.5585 mm y 1790 ticks/m). Las cuentas del texto se rehicieron a mano y son correctas.
- **Rejilla exacta.** Los cinco `ejercicios.ts` sortean en rejillas que el enunciado muestra exactas: la línea base de C-M0 se cumple.
- **Gancho respondido en Concepto.** Los cinco temas lo responden con los números del gancho: T-4.1:48-49, T-4.2:40-45, T-4.3:31-41, T-4.4:45-46 y T-4.5:36-37.
- **Enlaces internos.** Los siete (`/ruta/ruta-1/mMM/tNN`) apuntan a temas existentes, con el mismo formato que M0–M3.

## Hallazgos

| # | Tema/archivo | Tipo | Clase | Descripción | Severidad | Ticket |
|---|---|---|---|---|---|---|
| 1 | T-4.2 `ejercicios.ts:29-30`, `:54-64`; `content.json:82` | unidades (rangos) | visible | e1 pregunta «¿a qué velocidad avanza tu robot?» con ω ∈ [5, 60] rad/s y r ∈ [0.015, 0.05] m. «Tu robot» supera 1.5 m/s en ≈ 24 % de las instancias y llega a 3 m/s. El techo de #274 se aplica a e3 del mismo tema y a T-4.5 e2, pero no a e1. Los rangos salen de la spec (`CURRICULUM.md` § T-4.2). | mayor | — (validación) |
| 2 | T-4.3 `index.mdx:88-91`, `:113-120` | widget / accesibilidad | visible | DOCS-UX3 (#385) cambió el experimento 3 después de que se fusionara T-4.3 (#340). Ahora dice: «en el panel de curva, reproduce y reduce R a la mitad → observa la flecha a_c de la vista de la curva y su valor». El tema sigue con el texto anterior: no pide reproducir ni mirar la flecha. La frase descriptiva de Explora tampoco menciona la vista animada de la curva (`CONTENT-STANDARDS.md` §8). | mayor | — (validación) |
| 3 | `REFERENCES.md`, «Capítulos confirmados» | referencia | técnico | Solo están confirmadas las claves de M0. M4 estrena `young-freedman-9`, `young-freedman-10`, `serway-10`, `siegwart-3` y `siegwart-4`, y su capítulo no se ha confirmado. `REFERENCES.md:3` exige la confirmación al primer uso. Los títulos coinciden con los índices de las ediciones citadas, pero falta registrarlo. Requiere un lote DOCS del humano. | mayor | — (DOCS) |
| 4 | `REFERENCES.md:21-23` | referencia | visible | La fila de Siegwart no da editorial, año ni ISBN, al contrario que las de Young y Freedman y de Serway. Profundiza la muestra tal cual en T-4.2 y T-4.5. | menor | — (validación) |
| 5 | T-4.2 `:18-20`, T-4.3 `:18-20`, T-4.5 `:18-20` | longitud | visible | Los tres ganchos tienen tres frases, y el máximo es dos (`CONTENT-STANDARDS.md:11`). El texto es literal de la spec. La recomendación 3 de C-M0 no llegó a las specs de M4. | menor | — (validación) |
| 6 | T-4.4 `:80-83` frente a `:18-20` | widget | visible | El gancho pide i = 30 (6000 → 200 rpm). El widget arranca con 12:60 y 10:50, que dan i_total = 25 y 240 rpm (`CONTENT-STANDARDS.md` §7). Esos valores los fija la spec. | menor | — (validación) |
| 7 | T-4.1 `:121-131` frente a T-4.2 `:134-137` | notación | visible | La velocidad de la rueda con el motor sin carga se llama ω_rueda en T-4.1 y ω_max en T-4.2. El glosario define ω_max justo para eso (`GLOSSARY.md`, Rotación). Es la misma deriva que el hallazgo 8 de C-M0 (T-0.1 frente a T-0.2). | menor | — (validación) |
| 8 | T-4.3 `:82`; T-4.4 `:53-72` frente a T-4.2 `:70`, `:77`, T-4.5 `:53-75` y M2 | notación (unidades) | visible | En la lista de variables, las magnitudes sin unidad llevan «adimensional» en T-4.3 y T-4.4, y «—» en T-4.2, T-4.5, T-2.2, T-2.3 y el glosario. | menor | — (validación) |
| 9 | T-4.1 `alrobot.ts` (`\omega_{\text{rueda}}`, `n_{\text{motor}}`), T-4.4 `alrobot.ts` (`\tau_{\text{rueda}}`, `n_{\text{motor}}`) frente a T-4.2 `index.mdx:60-72` y `alrobot.ts` (`n_{rueda}`, `n_{motor}`); T-4.3 `index.mdx:79` frente a `alrobot.ts` (`v_{\max,\text{curva}}`) | notación | visible | Los subíndices de palabra se escriben rectos (`\text{}`) en unas fórmulas y en cursiva en otras. Pasa también dentro de un mismo tema: en T-4.3, `v_max,curva` sale en cursiva en Fórmulas y en recta en Al robot. | menor | — (validación) |
| 10 | T-4.3 `content.json:91` | notación | visible | El enunciado de e4 escribe «μs». El tema (`index.mdx:82`, `:134`), el glosario y los enunciados de T-2.2 escriben μₛ. | menor | — (validación) |
| 11 | T-4.5 `ejercicios.ts:122` frente a T-4.1 `ejercicios.ts:70` y T-4.4 `ejercicios.ts:69`, `:102` | unidades | visible | e3 muestra el sufijo «ticks» junto al campo de respuesta. Los demás conteos y relaciones del módulo no llevan sufijo (`unit: ''`: vueltas, i, i_total), y el glosario da «—» como unidad de ticks. | menor | — (validación) |
| 12 | T-4.5 `index.mdx:45`, `:127` | estilo | visible | El texto para el estudiante usa el identificador de código `encoderTicksPerRev`. Es el único tema de la ruta que lo hace. El formulario de «Mi robot» lo llama «Pulsos de encoder por vuelta» (`widgets.json:453`). El de Concepto sale del guion de la spec. | menor | — (validación) |
| 13 | T-4.4 `index.mdx:134` | estilo | visible | Pone «0.67 m/s». T-4.2 (`:41`, `:145`) y T-3.1 escriben 0.670 m/s para el mismo valor. | menor | — (validación) |
| 14 | T-4.4 `index.mdx:30-31` frente a `:53` | notación | visible | La negrita define i como «**relación de transmisión**». La lista de variables y el glosario la llaman «relación de reducción». | menor | — (validación) |
| 15 | T-4.4 `ejercicios.ts:22-23`, `:67`, `:31` | unidades (rangos) | visible | En e1, n_motor = i·n_rueda llega a 60 000 rpm y pasa de 12 000 rpm en ≈ 59 % de las instancias. 12 000 rpm es el máximo de T-4.2 e3, y el robot de referencia va a 6000 rpm. En e3, los cuatro z ∈ [8, 80] se sortean independientes, así que i_total va de 0.01 a 100: muchas instancias son trenes multiplicadores. Los dos rangos salen de la spec. | menor | — (validación) |
| 16 | T-4.2 `:18-20`, `:122` frente a T-3.1 `AlRobot` y T-0.2 | nivel | visible | El gancho presenta v_max como «el cálculo al que apuntaba toda la ruta» y Al robot, como «el cálculo central de la ruta». Pero el estudiante ya calculó v_max = 0.670 m/s en T-0.2, y T-3.1 lo recuerda («la que calculaste en Vectores»). Lo nuevo de T-4.2 es la cadena desde n_motor, no el resultado. El texto es de la spec. | menor | — (validación) |
| 17 | T-4.3 `index.mdx:138-141` | nivel | visible | Al robot pide comparar v_max,curva con «v_max de tu perfil», pero el tema no muestra ese valor. La spec da la conclusión («mayor que v_max del perfil: no patina»), y el texto la deja a cargo del estudiante sin darle el número. | menor | — (validación) |
| 18 | T-4.4 `ejercicios.ts:108-118`; `index.mdx:133` | nivel | visible | e4 no genera valores, así que «Nuevos valores» repite la misma instancia. Además, su respuesta (0.804 m/s) ya aparece en Al robot. Lo fija la spec. Es el mismo caso que T-0.2 e4 en C-M0 (hallazgo 16). | menor | — (validación) |
| 19 | T-4.3 `index.mdx:28`, `:40-41`, `:59-77` | notación | visible | En el mismo tema, ω es la velocidad angular de la rueda (ω = ω₀ + α·t) y la del robot en la curva (a_c = ω²·R). La lista de variables las nombra igual. El glosario admite los dos usos y Concepto (`:40`) aclara el segundo, así que no hay error. | menor | — (validación) |
| 20 | T-4.4 `index.mdx:19-20`, `:90-91`, `:99-100`, `:47`, `:137`; T-4.4 `:30` y T-4.5 `:28` | estilo (formato) | técnico | Hay texto sangrado con dos espacios dentro de `<Gancho>` y de dos `<Experimento>`, líneas en blanco antes de `</Concepto>` y `</AlRobot>`, y dos líneas más largas que el resto del archivo. No cambia lo que se ve: ninguna etiqueta de cierre está sangrada ni sigue a una lista, que fue la causa de #349. | menor | — |
| 21 | los cinco `alrobot.ts` y `ejercicios.ts` | estilo (código) | técnico | El formato de los números varía: T-4.2 conserva ceros finales (`toPrecision`) y T-4.1, T-4.3 y T-4.4 los quitan (`Number(…)`). `drawOnGrid` está copiada en tres temas. La repetición del sorteo es `do…while` en T-4.2 y `for (;;)` en T-4.5. Es terreno del auditor de código y aquí solo se anota. | menor | — |

Resumen: 0 bloqueantes, 3 mayores y 18 menores. Hay 3 técnicos (3, 20 y 21), ninguno bloqueante, así que no se abre ningún issue. Los otros 18 son visibles.

### Excepciones decididas por el orquestador

- **#301 · huecos de la spec del Módulo 4.** Se aplican tal cual. Los rangos de T-4.1 a T-4.5 y el respaldo al robot de referencia cuando falta un campo están en los `alrobot.ts`: `maxAccel_radps2` → 40 rad/s², `motor` → 0.012 N·m y η = 0.6, `encoderTicksPerRev` → 360. También se aplican el control v del modo rodadura (T-4.2) y el slider de ticks en [16, 4096] (T-4.5).
- **#274 · techo de 1.5 m/s.** Se aplica en T-4.2 e3 y e4 y en T-4.5 e2, con un nuevo sorteo. No se aplica en T-4.2 e1, porque la spec no lo pide (hallazgo 1).
- **#306 · velocidad estimada por encoders.** T-4.5 la usa en los tres experimentos, como indica la spec.

## Para la validación del humano

Son los hallazgos visibles. Ninguno se corrige ahora, y el módulo no se publica hasta la validación final.

1. **T-4.2 e1 supera 1.5 m/s** (hallazgo 1, mayor). Propuesta: volver a sortear si v > 1.5 m/s, como ya hace e3 (cambio en `CURRICULUM.md` § T-4.2).
2. **T-4.3 no sigue el experimento 3 actualizado por DOCS-UX3** (hallazgo 2, mayor). Propuesta: reescribir el experimento 3 según la spec vigente y añadir a la frase descriptiva de Explora una mención a la vista animada de la curva.
3. **Fila de Siegwart incompleta** (hallazgo 4).
4. **Ganchos de tres frases** en T-4.2, T-4.3 y T-4.5 (hallazgo 5).
5. **Valores iniciales de GearWidget distintos del gancho** en T-4.4 (hallazgo 6).
6. **Notación:**
   - ω_rueda frente a ω_max (hallazgo 7).
   - «adimensional» frente a «—» (hallazgo 8).
   - subíndices rectos o en cursiva (hallazgo 9).
   - «μs» frente a μₛ (hallazgo 10).
   - «relación de transmisión» frente a «relación de reducción» (hallazgo 14).
   - ω de la rueda y ω del robot en T-4.3 (hallazgo 19).
7. **Presentación:**
   - sufijo «ticks» en T-4.5 e3 (hallazgo 11).
   - `encoderTicksPerRev` en el texto (hallazgo 12).
   - «0.67» frente a «0.670» (hallazgo 13).
8. **Rangos poco realistas de T-4.4** e1 y e3 (hallazgo 15).
9. **Nivel y narrativa:**
   - «cálculo central de la ruta» cuando v_max ya se calculó en T-0.2 (hallazgo 16).
   - comparación con un v_max que T-4.3 no muestra (hallazgo 17).
   - T-4.4 e4 fijo y con la respuesta en Al robot (hallazgo 18).

## Deriva detectada entre módulos

Frente a M3 y a las líneas base de C-M0:

- **Se mantiene:**
  - El gancho habla de tu robot, con números y pregunta, y se responde en Concepto.
  - Al robot usa `RobotFormula` con el perfil y respaldo al robot de referencia.
  - Los ejercicios se sortean en rejilla exacta.
  - Explora tiene frase descriptiva y tres experimentos con respuestas de 2–3 frases.
  - La densidad de fórmulas es parecida: 6 y 7 en M3; 5, 5, 5, 4 y 4 en M4.
  - La longitud de Al robot también (145–173 palabras en M3, 132–202 en M4).
- **Techo de 1.5 m/s.** Se rompe en T-4.2 e1 (hallazgo 1). En M3 se cumplía en todos los ejercicios con «tu robot».
- **Unidad de las magnitudes sin dimensión.** M2 y los demás temas de M4 usan «—», y T-4.3 y T-4.4 introducen «adimensional» (hallazgo 8).
- **Ganchos de tres frases.** Pasan de uno en M3 (T-3.2) a tres en M4 (hallazgo 5).
- **Formato de números en `alrobot.ts`.** Sigue sin regla común, como ya señaló C-M0: M3 y M4 alternan entre conservar y quitar los ceros finales (hallazgo 21).
- **Specs cambiadas después de fusionar el tema.** Es la primera vez que un DOCS de widgets (DOCS-UX3) cambia un experimento de un tema ya fusionado sin un ticket de contenido asociado (hallazgo 2).

Líneas base para C-M5:

- «—» para las magnitudes sin dimensión.
- Subíndices de palabra con `\text{}`.
- μₛ con subíndice también en los enunciados.
- Techo de 1.5 m/s en todo ejercicio que hable de «tu robot».
- Ningún identificador de código en el texto para el estudiante.

## Recomendaciones para el orquestador

Son cambios en `docs/` que evitarían repetir los hallazgos. Todos requieren al humano.

1. `CONTENT-STANDARDS.md` §5: el techo de 1.5 m/s, con un nuevo sorteo, vale para todo ejercicio cuyo enunciado hable de «tu robot», no solo para los que la spec marca. Revisar con esa regla las specs de M5 y M6 (hallazgo 1).
2. Proceso DOCS: cuando un ticket DOCS cambie un experimento, una prop o un texto de la spec de un tema ya fusionado, abrir en el mismo lote el ticket de contenido que lo alinea (hallazgo 2).
3. `REFERENCES.md`: confirmar en un solo lote DOCS los capítulos de las claves de M1–M4 que faltan y completar la fila de Siegwart con editorial, año e ISBN (hallazgos 3 y 4). La recomendación 7 de C-M0 sigue pendiente.
4. `CURRICULUM.md`: acortar a dos frases los ganchos de M5 y M6 antes de abrir sus tickets. También fijar que los valores iniciales del widget reproduzcan el gancho, o anotar la excepción (hallazgos 5 y 6). La recomendación 3 de C-M0 sigue pendiente.
5. `CONTENT-STANDARDS.md` §3–§4:
   - «—» como unidad de las magnitudes sin dimensión en la lista de variables.
   - `unit: ''` para los conteos en `ejercicios.ts`.
   - subíndices de palabra con `\text{}` en `Formula` y `RobotFormula`.
   - ningún identificador de código en el texto: se usa la etiqueta del campo de «Mi robot».

   Cubre los hallazgos 8 a 12.
6. `GLOSSARY.md`: anotar que ω_max es el nombre de ω_rueda con el motor sin carga y que se prefiere en Al robot, para que M5 no repita la deriva de T-0.1/T-0.2 y T-4.1/T-4.2 (hallazgo 7).

## Veredicto

**Módulo aprobado**, pendiente de la validación del humano. No hay hallazgos bloqueantes. De los tres técnicos, el único mayor (hallazgo 3) necesita un lote DOCS del humano, y los otros dos son menores y sin ticket. Los dos visibles mayores (hallazgos 1 y 2) deberían resolverse antes de publicar el módulo. Los 16 visibles menores pueden ir en un lote posterior o quedar como están, con las recomendaciones anotadas.
