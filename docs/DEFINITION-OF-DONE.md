# Definición de terminado

Un ticket está terminado cuando cumple **todo** lo de "Común" más lo de su tipo, QA reporta PASS y el auditor aprueba. Nada se mergea antes.

## Común (todo ticket)

- [ ] Todos los entregables del ticket existen en las rutas indicadas; ningún archivo fuera de los entregables fue modificado.
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm content:check` en verde en CI.
- [ ] Cada criterio de aceptación del ticket tiene evidencia en el PR (comando + salida, o captura).
- [ ] Sin dependencias nuevas.
- [ ] Sin `TODO`, `FIXME`, código comentado ni `console.log`.
- [ ] La plantilla de PR está completa, incluida la sección "Qué NO se hizo".
- [ ] Si se abrió un spec gap, está resuelto y enlazado.

## Tipo `infra`

- [ ] Documentación operativa en `docs/ops/` actualizada.
- [ ] Reproducible desde cero siguiendo solo el documento.
- [ ] Sin secretos en el repo; variables documentadas en `.env.example`.
- [ ] Mergea el humano.

## Tipo `core` (sim-core, robot-spec)

- [ ] Funciones puras; sin DOM, sin `Math.random`, sin `Date.now`.
- [ ] Tests con los valores dorados del ticket, nombrados con el ID.
- [ ] Cobertura del archivo ≥ 90 %.
- [ ] API pública documentada con JSDoc en inglés (una línea por función más unidades de cada parámetro).
- [ ] Si cambia una API que otro paquete consume: ADR o ticket explícito.

## Tipo `widget`

- [ ] Entrada en `WIDGETS.md` coincide con las props implementadas.
- [ ] `X.stories.tsx` con al menos 2 configuraciones en `/dev/widgets`.
- [ ] Test de comportamiento con Testing Library.
- [ ] Captura de regresión visual guardada y aprobada.
- [ ] Operable con teclado; `aria-label` en cada control; `aria-live` para el estado.
- [ ] Textos por claves i18n; ningún literal en español dentro del componente.
- [ ] Valores dorados del ticket verificados en test.

## Tipo `sim`

- [ ] Todo número mostrado sale de `sim-core` (no de three ni de cálculo en el componente).
- [ ] e2e Playwright del flujo principal del ticket.
- [ ] Determinismo verificado: misma semilla y parámetros, mismo resultado en test.
- [ ] Si toca auth, base o subidas: revisión de seguridad aprobada.

## Tipo `content` (tema)

- [ ] Las 7 secciones presentes en orden; frontmatter válido; `status: review`.
- [ ] Solo widgets del catálogo; props exactamente como `CURRICULUM.md` indica.
- [ ] Fórmulas con variables listadas; símbolos del glosario; sin símbolos nuevos.
- [ ] Ejercicios en `ejercicios.ts` con `defineExercise`; test con valor dorado de `CURRICULUM.md` por ejercicio.
- [ ] Sección "Al robot" usa `useMyRobot()` y muestra la fórmula sustituida con los valores del perfil.
- [ ] Referencias con clave existente en `docs/REFERENCES.md`.
- [ ] Longitudes dentro de los límites de `CONTENT-STANDARDS.md`.
- [ ] Captura visual de la página completa guardada.
- [ ] Revisión del auditor de contenido registrada en el PR.

## Tipo `qa`

- [ ] Informe en `docs/audits/` con fecha, alcance, método, hallazgos con severidad y tickets creados.

## Tipo `docs`

- [ ] Enlaces internos válidos (`pnpm docs:check`).
- [ ] Mergea el humano.

## Rúbrica de calificación (la aplica el humano en cada PR, en `docs/agent-scorecard.md`)

| Criterio | 0 | 1 | 2 |
|---|---|---|---|
| Apego a la spec | Hizo otra cosa o más de lo pedido | Cumple con desviaciones menores | Exactamente lo pedido, nada más |
| Calidad | Auditor pidió cambios mayores | Cambios menores | Sin cambios |
| Tests | Faltan o son triviales | Cubren lo básico | Valores dorados y casos límite |
| Autonomía | Inventó ante un vacío | Preguntó de más | Levantó los spec gaps justos con default propuesto |
| Reporte de PR | Incompleto | Completo | Completo y con evidencia clara |

Formato de registro: `fecha · ticket · agente/modelo · puntuación por criterio · nota de una línea`.
