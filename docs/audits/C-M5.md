# Auditoría de coherencia — C-M5

2026-09-26 · auditor de coherencia / Claude Opus 5.5 · T-5.1 Pose y marcos de referencia (#413), T-5.2 Cinemática directa del robot diferencial (#412), T-5.3 Cinemática inversa del robot diferencial (#411), T-5.4 Odometría (#415) y T-5.5 Restricción no holonómica (#424), con la maniobra de `DiffDriveWidget` (M5-W, #414). Los cinco están en `status: review` sobre `main` (f2e9925).

## Método

Se leyeron completos los cinco temas: `content/es/ruta-1/m05-t0{1..5}/index.mdx`, `ejercicios.ts`, `alrobot.ts` y sus tests, y los enunciados de `packages/i18n/locales/es/content.json`. Se revisaron contra `CONTENT-STANDARDS.md`, `GLOSSARY.md`, `WIDGETS.md` (`DiffDriveWidget`, con la maniobra en tres movimientos), `REFERENCES.md` y `CURRICULUM.md` (Módulo 5 según #400 y la lista mínima de «Auditorías de coherencia»). Los cinco temas se fusionaron después de #400, y los lotes DOCS posteriores (#401, #438) solo tocan M6. También se comprobaron los rangos de los sliders en `packages/widgets/src/DiffDriveWidget/panels.tsx`. Después se compararon con M4 y con las líneas base de C-M4.

En cada tema y entre los cinco se revisó:

1. Símbolos: todos existen en el glosario con la misma unidad, y se usan los mismos para lo mismo.
2. Fórmulas: las de la spec aparecen tal cual, cada una con su lista de variables. Se comprobó por coincidencia exacta de cadenas.
3. Widgets: son los de la spec, con sus props exactas. Se comprobó que los valores de los experimentos caben en los sliders y si los valores por defecto reproducen el gancho.
4. Al robot: `RobotFormula` sobre `useMyRobot()`, con respaldo al robot de referencia, y el ejemplo de referencia de la spec.
5. Ejercicios: valores dorados y tolerancia en los tests, unidad en el enunciado, rejilla exacta y rangos realistas. Se estimó por simulación (10⁶ sorteos) qué fracción de instancias deja una componente cerca de cero con tolerancia relativa, o queda fuera de un rango realista.
6. Tono, longitudes y forma de Explora, con un recuento de palabras y de frases.
7. Nivel, progresión 5.1 → 5.5, prerrequisitos y comparación con M4.
8. Referencias.
9. Página generada: `pnpm build` en el worktree de la auditoría y búsqueda de las siete secciones en `apps/web/dist/ruta/ruta-1/m05/t0{1..5}/index.html`.

Cada hallazgo se clasifica según la decisión del humano en #445:

- **Técnico:** no cambia lo que ve el estudiante, o devuelve la página a lo que ya dicen la spec y los estándares sin cambiar su contenido. Si es bloqueante, se abre un ticket de corrección.
- **Visible:** cambia lo que ve el estudiante. Va a «Para la validación del humano» y no se corrige ahora.

Se revisó sin hallazgos:

- **Anatomía y frontmatter.** Las siete secciones están en orden en los cinco `index.mdx`. Título, tiempo, prerrequisitos, objetivos, widgets, ejercicios obligatorios y referencias coinciden con la spec. `ruta.json` los lista en orden. `pnpm content:check`: 22 temas, 0 incumplimientos. La página generada de T-5.2 pierde una sección (hallazgo 1).
- **Fórmulas.** Las 17 de la spec aparecen idénticas (4, 5, 3, 3 y 2), todas con su lista de variables. La primera de T-5.4 añade la mitad `Δs_R` que la spec resume como «ídem R». Todos los símbolos del texto, de los enunciados y de `alrobot.ts` están en `GLOSSARY.md` con la misma unidad. Eso incluye `R(θ)`, `p⃗_G`, `p⃗_{R,0}`, `θ_objetivo`, `(x_o, y_o)`, `CIR`, `Δs`, `Δθ`, `Δticks`, `N_e`, `ẋ`, `θ̇`, `N`, `e_s`, `d`, `D`, `ω_max` y `v_max`. T-5.2 e3 y e4 no usan `ω₀`, que en el glosario es «velocidad angular inicial» (#412).
- **Props de los widgets.** Los cinco `DiffDriveWidget` llevan las props exactas de la spec: T-5.1:82-87, T-5.2:90-95, T-5.3:75-80, T-5.4:81-86 y T-5.5:69-75, este con `maneuver={{ turn_deg: 90, distance_m: 0.2 }}`. Con el robot de referencia, todos los valores de los experimentos caben en los sliders:
  - ω_L = ±20 rad/s en [−20.9, 20.9], paso 0.1;
  - v = 0.15, 0.42 y > 0.558 m/s en [−0.67, 0.67], paso 0.01;
  - ω = 2 y 3 rad/s en [−5, 5], paso 0.05;
  - radio creído 0.033 m y L creída 0.155 m, con paso de 0.5 mm;
  - θ₀ = 45° y 90°, y giro de 90° y avance de 0.2 m en los sliders de la maniobra.
- **Longitudes.** Concepto tiene 305, 280, 279, 312 y 274 palabras (rango 150–350). Al robot tiene 195, 161, 158, 196 y 195 (rango 100–300). Cada tema tiene tres experimentos con la forma cambia → observa → ¿por qué?, y ninguna respuesta pasa de 3 frases. Los cinco ganchos tienen una o dos frases.
- **Tono.** Trato de tú, sin exclamaciones ni emojis, con punto decimal. Cada término en negrita (marco de referencia, marco global, marco del robot, pose, matriz de rotación, rumbo, cinemática directa, centro instantáneo de rotación, radio de giro, cinemática inversa, pivote, odometría, admisible y restricción no holonómica) se define una sola vez en la ruta. Ningún identificador de código aparece en el texto para el estudiante.
- **Valores dorados.** Los de los 18 ejercicios de la spec están en los tests con su tolerancia: 28 valores, contando cada componente de las respuestas vectoriales. Las tolerancias son las de la spec: 0.5° absoluta en T-5.1 e3 y T-5.4 e4, 0.01 m/s absoluta en T-5.5 e1 y 2 % relativa en el resto. Los ejemplos de Al robot coinciden con la spec:
  - T-5.1: (1.278, 0.545) y (1.266, 0.5658) m;
  - T-5.2: 0.56 m/s, 1.067 rad/s, 0.525 m y 4.267 rad/s;
  - T-5.3: 16.02 y 8.98 rad/s, y 0.75 frente a 0.670 m/s;
  - T-5.4: 0.2234, 0.2457 y 0.2346 m, 0.1489 rad, (0.2339, 0.01745, 0.1489) y 0.3125 m;
  - T-5.5: ±9.375 y 15.63 rad/s, y 1.185 s.

  Las cuentas del texto, de Explora y de las respuestas se rehicieron a mano y son correctas. Entre ellas: 8.533 rad/s, 0.558 m/s, 0.520 m/s, 0.736 s, 29.45 s, 3.1 %, −11.6° y 4.142 s. `vitest` sobre `m05`: 112 de 112.
- **Al robot.** Los cinco temas calculan con `RobotFormula` sobre el perfil y toman el robot de referencia si el perfil no es móvil. T-5.4 también usa N_e = 360 si falta `encoderTicksPerRev`. El tiempo de la maniobra de T-5.5 va en una `Formula` estática, como indica la spec (#394).
- **Rejilla exacta.** Los cinco `ejercicios.ts` sortean en rejillas que el enunciado muestra exactas: centésimas, décimas, grados enteros, décimas de milímetro y ticks enteros.
- **Líneas base de C-M4.**
  - «—» para las magnitudes sin dimensión (T-5.1 `R(θ)`, T-5.4 `Δticks` y `N_e`).
  - Ningún identificador de código en el texto.
  - Techo de 1.5 m/s: la mayor velocidad del módulo es 0.825 m/s (T-5.3 e1 y e2).
  - ω_max, y no ω_rueda, para la velocidad máxima de la rueda en T-5.3 y T-5.5.
  - Solo la línea base de subíndices con `\text{}` no se cumple (hallazgo 9).
- **Gancho respondido en Concepto.** T-5.1:38-39, T-5.2:25-38, T-5.3:37-38 y T-5.4:40-42 responden con los números del gancho. T-5.5 responde su pregunta en `:24-26` y `:37-39`.

## Hallazgos

| # | Tema/archivo | Tipo | Clase | Descripción | Severidad | Ticket |
|---|---|---|---|---|---|---|
| 1 | T-5.2 `index.mdx:84` | estilo (formato) | técnico | La etiqueta de cierre `</Formulas>` está sangrada con dos espacios justo después de la última leyenda. Es la causa de #349. En la página generada, T-5.2 no tiene `id="formulas"`, y los otros cuatro temas sí: la sección 03 no se genera y las fórmulas pierden la columna de lectura. `content:check` no lo detecta. El texto de `<Gancho>` (`:19-20`) y dos respuestas de Explora (`:102-103`, `:111-112`) también están sangrados, pero se ven bien. | bloqueante | [#448](https://github.com/jams-robotics/trayectoria/issues/448) |
| 2 | `REFERENCES.md`, «Capítulos confirmados» | referencia | técnico | M5 estrena `craig-2` y `corke-4`, y su capítulo no se ha confirmado. `siegwart-3` y `siegwart-4` siguen pendientes desde M4 (hallazgo 3 de C-M4). `REFERENCES.md:3` exige la confirmación al primer uso. Requiere un lote DOCS del humano. | mayor | — (DOCS) |
| 3 | T-5.1 `ejercicios.ts:108-136`; T-5.4 `ejercicios.ts:67-101`; T-5.2 `ejercicios.ts:71-84` | ejercicios (tolerancia) | visible | La tolerancia relativa del 2 % se aplica a cada componente, y algunas componentes salen casi nulas. En T-5.1 e1 y e2, una coordenada queda por debajo de 0.025 m en ≈ 2.5 % de las instancias, y por debajo de 5 mm en ≈ 0.5 %. En T-5.4 e2, la y queda por debajo de 0.025 m en ≈ 14 %, y por debajo de 5 mm en ≈ 3.2 %. En T-5.2 e1, ω queda por debajo de 0.05 rad/s en ≈ 2 %, y en T-5.4 e1 Δθ también, en ≈ 2.7 %. Por debajo de 0.025 m, una respuesta correcta redondeada al milímetro, como los valores dorados de la spec (1.278, 0.545), se califica como incorrecta. #259 evitó esto en T-0.2 e1 limitando θ. Los rangos salen de la spec. | mayor | — (validación) |
| 4 | T-5.4 `index.mdx:14`, `:158`; `REFERENCES.md` (`siegwart-4`) | referencia | visible | Profundiza de Odometría cita `siegwart-4`, «Perception». En la 2.ª edición de Siegwart, ese capítulo trata los sensores, encoders incluidos. La estimación de posición por odometría y su propagación de error están, probablemente, en el cap. 5, «Mobile Robot Localization». Hay que confirmarlo con el libro. La clave sale de la spec. | menor | — (validación) |
| 5 | `REFERENCES.md:21-25` | referencia | visible | Las filas de Siegwart, Corke y Craig no dan editorial, año ni ISBN, al contrario que las de Young y Freedman y de Serway. M5 muestra las tres en Profundiza. Es la continuación del hallazgo 4 de C-M4. | menor | — (validación) |
| 6 | T-5.4 `ejercicios.ts:67-101`; `content.json:124-125` | unidades (rangos) | visible | e1 y e2 hablan de «un paso de odometría», pero sortean los ticks de cada rueda por separado en [50, 1000]. El giro del paso pasa de 90° en ≈ 31 % de las instancias y llega a ≈ 203°. El Concepto presenta el paso como un intervalo corto. El rango sale de la spec. | menor | — (validación) |
| 7 | T-5.3 `ejercicios.ts:58-98`; `content.json:112-113` | nivel | visible | e1 y e2 fijan el robot de referencia y piden las velocidades de rueda de comandos que ese robot no puede seguir: v_R > 0.670 m/s en ≈ 11.1 % de las instancias de e1 y en ≈ 4.9 % de las de e2. El enunciado no lo menciona, aunque el tema enseña justo que esos comandos no son realizables. Además, en ≈ 7.4 % de las instancias de e1 la rueda interior gira hacia atrás (ω_L < 0), un caso que el Concepto no trata. Los rangos salen de la spec. | menor | — (validación) |
| 8 | T-5.1 `index.mdx:44-46` frente a T-5.4 `:35-37`, `:46`, T-5.5 `:26`, `:53`, `:61` y `content.json:130-131` | notación | visible | T-5.1 define «**rumbo**» como el ángulo hacia un objetivo (θ_objetivo). T-5.4 y T-5.5 llaman «rumbo» a la orientación θ del robot: «el rumbo pasa de θ a θ + Δθ», «orientación (rumbo) del robot», «Tu robot tiene rumbo θ». El glosario distingue θ, «orientación (heading)», de θ_objetivo, «rumbo hacia un objetivo». La spec usa la palabra en los dos sentidos. | menor | — (validación) |
| 9 | T-5.1 `:70` (`\theta_{objetivo}`); T-5.3 `:65` y `alrobot.ts` (`\omega_{max}`, `v_{max}`); T-5.5 `alrobot.ts` (`\omega_{max}`) frente a T-5.4 `:54` (`\Delta\text{ticks}_L`) | notación | visible | Los subíndices de palabra salen en cursiva en unas fórmulas y rectos en otras. La línea base de C-M4 pedía `\text{}`, pero las fórmulas de la spec escriben `\theta_{objetivo}` y `\omega_{max}` en cursiva. El tema las copia tal cual, como exige el punto 2 de la lista mínima. | menor | — (validación) |
| 10 | T-5.5 `index.mdx:18-21` | estilo (gancho) | visible | El gancho no lleva números, y `CONTENT-STANDARDS.md` §2.1 pide «con números». Es el único de M4–M5 sin ellos. El texto es literal de la spec. | menor | — (validación) |
| 11 | T-5.1 `:82-87` frente a `:18-21`; T-5.4 `:81-86` frente a `:18-21` | widget | visible | El widget no reproduce el gancho (`CONTENT-STANDARDS.md` §7). En T-5.1, el gancho pone el robot en (1.2, 0.5) m a 30°, y el widget arranca en el origen, con θ₀ = 0 y 6/8 rad/s. En T-5.4, el gancho da 400 y 440 ticks, y el widget corre 30 s a 12/13 rad/s. `initial` no admite una pose, y las props salen de la spec. | menor | — (validación) |
| 12 | T-5.2 `:111-112`; T-5.3 `:87-89`, `:107-109`; T-5.4 `:76-77`, `:99-115`; T-5.5 `:91-93` frente a T-5.1 `:78` | widget / nivel | visible | `DiffDriveWidget` usa el robot del perfil (`robot` por defecto `useMyRobot()`), pero las respuestas de Explora dan los números del robot de referencia sin decirlo: 8.533 rad/s, L = 0.15 m, 0.2133 rad/s y 29.45 s, «de 0.032 a 0.033 m» y «de 0.15 a 0.155 m». Solo T-5.1, en la frase descriptiva y en el experimento 2, y T-5.3, en el experimento 2, lo aclaran. Con otro perfil, los sliders arrancan en otros valores. Si ω_max es menor de 20 rad/s, los experimentos de T-5.2 ni siquiera caben en el slider (±ω_max). | menor | — (validación) |
| 13 | T-5.4 `index.mdx:70` | estilo | visible | La lista de variables escribe `{G}` entre comillas invertidas, así que se ve como código. T-5.1 (`:60-61`) y T-5.5 (`:52`) lo escriben como texto (`\{G\}`). | menor | — (validación) |
| 14 | T-5.5 `index.mdx:33-35` | estilo | visible | El párrafo dice dos veces lo mismo: «Ninguna pose queda prohibida […]. Lo que limita es el camino» y, justo después, «puede llegar a cualquier pose, pero no por cualquier camino». | menor | — (validación) |
| 15 | T-5.5 `ejercicios.ts:63-86`; `content.json:130` | nivel | visible | La respuesta de e1 es 0 con cualquier θ y v, porque el enunciado ya da (ẋ, ẏ) = v·(cosθ, sinθ). «Nuevos valores» no cambia la respuesta. Lo fija la spec. Es un caso parecido al de T-4.4 e4 (hallazgo 18 de C-M4). | menor | — (validación) |
| 16 | T-5.1 `ejercicios.ts:49`, `:142-160` | ejercicios | técnico | e3 vuelve a sortear si \|θ_objetivo\| > 170°, porque cerca de ±180° la misma dirección tendría dos respuestas. Lo decidió el orquestador en el QA de #413, pero no está en `CURRICULUM.md` § T-5.1, que solo pide volver a sortear si el objetivo queda a menos de 0.1 m. Falta anotarlo en un lote DOCS, como se hizo con #259 y #273. | menor | — (DOCS) |
| 17 | T-5.4 `index.mdx:9-11`; T-5.2 `:49`, `:148`; `content.json:111-122` | estilo (formato) | técnico | Los objetivos del frontmatter de T-5.4 no están sangrados, y en los otros cuatro temas sí. T-5.2 deja líneas en blanco antes de `</Concepto>` y de `</AlRobot>`. En `content.json`, las claves de T-5.3 van antes que las de T-5.2. No cambia lo que se ve. | menor | — |
| 18 | los cinco `alrobot.ts` y `ejercicios.ts` | estilo (código) | técnico | El formato de los números varía: T-5.1 y T-5.2 quitan los ceros finales (`Number(…toPrecision)`), T-5.4 y T-5.5 los conservan (`toPrecision`) y T-5.3 usa dos decimales (`toFixed`). `drawOnGrid` está copiada en T-5.1, T-5.3 y T-5.5. La repetición del sorteo es `do…while` en T-5.1, `while` en T-5.2 y `for (;;)` en T-5.5. Es terreno del auditor de código y aquí solo se anota. | menor | — |

Resumen: 1 bloqueante, 2 mayores y 15 menores. Hay 5 técnicos (1, 2, 16, 17 y 18). El 1 es bloqueante y tiene ticket (#448). Los otros 13 son visibles.

### Excepciones decididas por el orquestador o por la spec

- **#394 / #400 · huecos de la spec del Módulo 5.** Se aplican tal cual:
  - r = 0.032 m y L = 0.15 m fijos en T-5.2 a T-5.4.
  - Radio con signo en T-5.2 e2.
  - Giro en el lugar con ±10 rad/s en Al robot de T-5.2.
  - Tiempo de la maniobra en una `Formula` estática en T-5.5.
  - Tolerancia absoluta de 0.01 m/s en T-5.5 e1.
  - Maniobra en tres movimientos de `DiffDriveWidget` (M5-W, #414).
- **QA de #413 · \|θ_objetivo\| ≤ 170° en T-5.1 e3.** Se aplica, pero falta en `docs/` (hallazgo 16).
- **Decisiones dentro del alcance en los PR.** T-5.2 e3 y e4 no introducen ω₀ (#412). T-5.3 e2 fija el giro a la izquierda para que el orden L, R sea el de e1 (#411).

## Para la validación del humano

Son los hallazgos visibles. Ninguno se corrige ahora, y el módulo no se publica hasta la validación final.

1. **Componentes casi nulas con tolerancia relativa** en T-5.1 e1 y e2, T-5.2 e1 y T-5.4 e1 y e2 (hallazgo 3, mayor). Propuesta: añadir a la spec la regla de #259, volver a sortear si alguna componente con tolerancia relativa queda por debajo de 0.05 (m o rad/s, según la componente).
2. **Referencia de Odometría**: `siegwart-4` («Perception») frente al probable cap. 5 (hallazgo 4).
3. **Filas de Siegwart, Corke y Craig incompletas** en `REFERENCES.md` (hallazgo 5).
4. **Rangos:**
   - T-5.4: pasos de odometría con giros de más de 90° (hallazgo 6).
   - T-5.3 e1 y e2: comandos no realizables sin aviso, y rueda interior hacia atrás (hallazgo 7).
5. **Notación:**
   - «rumbo» como θ_objetivo y como θ (hallazgo 8).
   - subíndices en cursiva que vienen de la spec frente a la línea base `\text{}` (hallazgo 9).
6. **Gancho de T-5.5 sin números** (hallazgo 10).
7. **Widgets:**
   - valores iniciales distintos del gancho en T-5.1 y T-5.4 (hallazgo 11).
   - números de Explora del robot de referencia con el widget sobre el perfil (hallazgo 12).
8. **Presentación y estilo:**
   - `{G}` como código en T-5.4 (hallazgo 13).
   - frase repetida en T-5.5 (hallazgo 14).
9. **T-5.5 e1 con respuesta siempre 0** (hallazgo 15).

## Deriva detectada entre módulos

Frente a M4 y a las líneas base de C-M4:

- **Se mantiene:**
  - El gancho habla de tu robot, con números y pregunta, salvo T-5.5 (hallazgo 10), y se responde en Concepto.
  - Al robot usa `RobotFormula` con el perfil y respaldo al robot de referencia.
  - Los ejercicios se sortean en rejilla exacta.
  - Explora tiene frase descriptiva y tres experimentos con respuestas de 2–3 frases.
  - La longitud de Al robot es parecida: 132–202 palabras en M4, 158–196 en M5.
  - «—» para las magnitudes sin dimensión, ω_max y ningún identificador de código en el texto.
- **Ganchos.** Mejoran: M4 tenía tres de tres frases, y M5 tiene todos de una o dos. La recomendación 4 de C-M4 se cumplió en la spec.
- **Densidad de fórmulas.** Baja de 5, 5, 5, 4 y 4 en M4 a 4, 5, 3, 3 y 2 en M5. La marca la spec, y las fórmulas de M5 agrupan dos ecuaciones por bloque (v_L y v_R, Δs y Δθ, x, y y θ), así que el contenido matemático es parecido.
- **Longitud de Concepto.** Sube de 240–284 palabras en M4 a 274–312 en M5, dentro del rango. T-5.4 es el más largo de la ruta hasta ahora, y T-5.1 queda tercero, detrás de T-2.1.
- **Enlaces internos.** M4 tenía siete. M5 no tiene ninguno, aunque T-5.3 y T-5.4 remiten a la cinemática directa, y T-5.4, a los encoders de T-4.5.
- **Componentes casi nulas con tolerancia relativa.** Vuelven, después de #259 y #273 en M0 (hallazgo 3). C-M2 y C-M4 no las registraron.
- **Página generada.** Vuelve el cierre sangrado de `</Formulas>` que corrigió #349 en T-2.3 y T-4.4 (hallazgo 1). Es la tercera vez, y `content:check` sigue sin detectarlo.
- **Subíndices de palabra.** No hay regla en `docs/`, y la spec de M5 los escribe en cursiva (hallazgo 9). La línea base de C-M4 no se puede cumplir sin cambiar la spec.

Líneas base para C-M6:

- Ninguna etiqueta de cierre de sección sangrada. Se comprueba en la página generada, no solo en `content:check`.
- «rumbo» solo para θ_objetivo. θ es la «orientación».
- Ninguna componente con tolerancia relativa por debajo de 0.05 en su unidad.
- Si Explora da números del robot de referencia, lo dice.
- Siguen las de C-M4: «—», ningún identificador de código, techo de 1.5 m/s con «tu robot» y ω_max.

## Recomendaciones para el orquestador

Son cambios en `docs/`, o en la herramienta de validación, que evitarían repetir los hallazgos. Todos requieren al humano.

1. `CONTENT-STANDARDS.md` §5: generalizar #259. Si una componente de la respuesta tiene tolerancia relativa, se vuelve a sortear cuando queda por debajo de un umbral (p. ej. 0.05 en su unidad). Revisar con esa regla las specs de T-5.1, T-5.2, T-5.4 y M6 (hallazgo 3). Es la recomendación 1 de C-M0, que sigue pendiente.
2. Un ticket de código para `content:check`: fallar si una etiqueta de cierre de sección (`</Formulas>`, `</Concepto>`, `</AlRobot>`, …) no está en la columna 0. Así #349 no vuelve (hallazgo 1).
3. `REFERENCES.md`: confirmar en un solo lote DOCS los capítulos de `siegwart-3`, `siegwart-4`, `corke-4` y `craig-2`, revisar si Odometría debe citar el cap. 5 de Siegwart, y completar las filas de Siegwart, Corke y Craig con editorial, año e ISBN (hallazgos 2, 4 y 5). Las recomendaciones 3 de C-M4 y 7 de C-M0 siguen pendientes.
4. `CURRICULUM.md` § T-5.1: anotar la regla \|θ_objetivo\| ≤ 170° de e3 (hallazgo 16). En § T-5.4, decidir si los ticks de e1 y e2 se limitan para que el paso sea corto. En § T-5.3, decidir si e1 y e2 vuelven a sortear los comandos no realizables (hallazgos 6 y 7).
5. `GLOSSARY.md` y `CONTENT-STANDARDS.md` §4:
   - reservar «rumbo» para θ_objetivo y usar «orientación» para θ (hallazgo 8).
   - fijar si los subíndices de palabra van con `\text{}`, y actualizar en consecuencia las fórmulas de la spec de M5 y M6 (hallazgo 9). Es la recomendación 5 de C-M4.
6. `CONTENT-STANDARDS.md` §4 o §7: cuando Explora dé números de un widget que usa el perfil, indicar que son los del robot de referencia (hallazgo 12).

## Veredicto

**Módulo aprobado con tickets**, pendiente de la validación del humano. El único hallazgo bloqueante (1) es técnico y tiene ticket (#448): una línea de sangría que hoy borra la sección Fórmulas de T-5.2. El técnico mayor (2) necesita un lote DOCS del humano, y los otros tres técnicos son menores y sin ticket. El visible mayor (3) debería resolverse en la spec antes de publicar el módulo. Los 12 visibles menores pueden ir en un lote posterior o quedar como están, con las recomendaciones anotadas.
